import {
  createBassEnhancer,
  getBassEnhancerConfig,
  type BassEnhancer,
} from "@/lib/sound/dsp/bass-enhancer";
import type { DriveState } from "@/lib/drive/model";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import { createDriveEnergyTracker } from "@/lib/symphony";
import type { DriveEnergyTracker } from "@/lib/symphony/drive-energy";
import { getWorldPack } from "./experience-pack";
import { createWorldLayerPlayer } from "./layer-player";
import type { WorldDiagnostics, WorldMotionState, WorldPack } from "./types";
import { deriveWorldState } from "./world-state";

export class WorldSynth {
  private pack: WorldPack | null = null;
  private energy: DriveEnergyTracker | null = null;
  private layers: ReturnType<typeof createWorldLayerPlayer> | null = null;
  private worldState: WorldMotionState = "idle";
  private lastTs = 0;
  private built = false;
  private seed = 1;
  private bass: BassEnhancer | null = null;

  build(
    ctx: BaseAudioContext,
    profile: SoundProfile,
    buses: StrategyBuses,
    seed?: number,
  ): boolean {
    this.dispose();
    const pack = getWorldPack(profile.id);
    if (!pack) return false;

    this.seed = seed ?? Date.now() & 0xffff;
    this.pack = pack;
    this.energy = createDriveEnergyTracker();
    const bassCfg = getBassEnhancerConfig(profile.id);
    this.bass = bassCfg ? createBassEnhancer(ctx, buses.body, bassCfg) : null;
    this.layers = createWorldLayerPlayer(ctx, this.bass ? this.bass.input : buses.body, pack, this.seed);
    const start = "currentTime" in ctx ? ctx.currentTime : 0;
    this.layers.start(start + 0.02);
    const idle = pack.stateRules.find((r) => r.state === "idle");
    if (idle) this.layers.setGains(idle.gains, start + 0.02);
    this.built = true;
    return true;
  }

  update(state: DriveState, audioTime: number) {
    if (!this.built || !this.energy || !this.layers || !this.pack) return;

    const dt =
      this.lastTs > 0
        ? Math.min(0.1, Math.max(0.001, (state.timestamp - this.lastTs) / 1000))
        : 1 / 60;
    this.lastTs = state.timestamp || this.lastTs;

    const energy = this.energy.update(state, dt);
    // Presence fades in with motion (idle stays exactly as authored).
    const presence = state.speed > 0.5 ? Math.min(1, Math.max(0, (state.speed * 3.6 - 4) / 16, energy.driverDemand)) : 0;
    this.bass?.setDrive(Math.max(energy.driverDemand, energy.energy * 0.8), 0, audioTime, presence);
    this.worldState = deriveWorldState(energy, this.worldState, state.speed);

    const rule =
      this.pack.stateRules.find((r) => r.state === this.worldState) ??
      this.pack.stateRules.find((r) => r.state === "motion");
    if (rule) this.layers.setGains(rule.gains, audioTime);

    if (this.pack.id === "world-storm-run" && this.worldState === "high_energy") {
      this.layers.maybeThunder(audioTime, energy.energy);
    }
  }

  getDiagnostics(): WorldDiagnostics {
    return {
      packId: this.pack?.id ?? null,
      worldState: this.worldState,
      energy: this.energy?.snapshot().energy ?? 0,
      activeLayers: this.layers?.activeLayers() ?? [],
      pendingEvents: this.layers?.pendingEvents ?? 0,
      transitionGain: this.layers?.getTransitionGain() ?? 0,
    };
  }

  getEnergy() {
    return this.energy?.snapshot() ?? null;
  }

  dispose() {
    this.bass?.dispose();
    this.bass = null;
    this.layers?.dispose();
    this.layers = null;
    this.energy = null;
    this.pack = null;
    this.built = false;
    this.lastTs = 0;
    this.worldState = "idle";
  }
}
