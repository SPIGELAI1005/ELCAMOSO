import { createDebrisBurst, type DebrisBurst } from "@/lib/sound/dsp/debris-layer";
import {
  createBassEnhancer,
  getBassEnhancerConfig,
  type BassEnhancer,
} from "@/lib/sound/dsp/bass-enhancer";
import { createLiftOffThunder, type LiftOffThunder } from "@/lib/sound/dsp/liftoff-thunder";
import { createThrustBass, type ThrustBass } from "@/lib/sound/dsp/rocket-layer";
import { createWhistleGovernor, type WhistleGovernor } from "@/lib/sound/dsp/whistle-governor";
import type { DriveState } from "@/lib/drive/model";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import { createDriveEnergyTracker } from "@/lib/symphony";
import type { DriveEnergyTracker } from "@/lib/symphony/drive-energy";
import { getWorldPack } from "./experience-pack";
import { createWorldLayerPlayer } from "./layer-player";
import type { WorldDiagnostics, WorldLayerId, WorldMotionState, WorldPack } from "./types";
import { deriveWorldState } from "./world-state";

/**
 * Worlds react to the GPS-derived acceleration estimate when nothing measured is available
 * (in the car the measured value is always 0), so build / high-energy / coast / regen states
 * are reachable. Decel also feeds regen the same way the powertrain adapter does.
 */
export function worldDriveState(state: DriveState): DriveState {
  const est = state.accelerationEstimated;
  if (est === undefined || Math.abs(state.acceleration) > 0.05) return state;
  return {
    ...state,
    acceleration: est,
    accelerationNormalized: Math.min(1, Math.abs(est) / 4.5),
    regen: Math.max(state.regen, Math.min(1, Math.max(0, -est) / 4.2)),
  };
}

export class WorldSynth {
  private pack: WorldPack | null = null;
  private energy: DriveEnergyTracker | null = null;
  private layers: ReturnType<typeof createWorldLayerPlayer> | null = null;
  private worldState: WorldMotionState = "idle";
  private lastTs = 0;
  private built = false;
  private seed = 1;
  private bass: BassEnhancer | null = null;
  private thunder: LiftOffThunder | null = null;
  private thrust: ThrustBass | null = null;
  private thrustLoad = 0;
  private debris: DebrisBurst | null = null;
  private whistle: WhistleGovernor | null = null;
  private whistleIds: WorldLayerId[] = [];

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
    // Decel power-down thump, routed through the bass enhancer (30 Hz high-pass when moving).
    this.thunder = pack.liftOffThunder
      ? createLiftOffThunder(ctx, this.bass ? this.bass.input : buses.body, pack.liftOffThunder)
      : null;
    this.thrust = pack.thrust
      ? createThrustBass(ctx, this.bass ? this.bass.input : buses.body, pack.thrust)
      : null;
    this.thrustLoad = 0;
    this.debris = pack.debris ? createDebrisBurst(ctx, buses.accents, pack.debris) : null;
    this.whistle = pack.whistle ? createWhistleGovernor(pack.whistle) : null;
    this.whistleIds = pack.whistle
      ? [
          ...new Set([
            ...pack.layers.filter((l) => l.kind === "shimmer").map((l) => l.id),
            ...(pack.whistle.layers ?? []),
          ]),
        ]
      : [];
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

    const driveState = worldDriveState(state);
    const energy = this.energy.update(driveState, dt);
    // Presence fades in with motion (idle stays exactly as authored).
    const presence = state.speed > 0.5 ? Math.min(1, Math.max(0, (state.speed * 3.6 - 4) / 16, energy.driverDemand)) : 0;
    const liftOff = this.thunder ? this.thunder.update(energy.driverDemand, state.speed, audioTime) : 0;
    this.bass?.setDrive(Math.max(energy.driverDemand, energy.energy * 0.8), liftOff, audioTime, presence);
    const prevState = this.worldState;
    this.worldState = deriveWorldState(energy, this.worldState, state.speed);

    // Thrust bass: follows demand and the (GPS-estimated) acceleration; silent at rest.
    const thrustTarget = Math.min(1, Math.max(energy.driverDemand, driveState.acceleration / 3, 0));
    this.thrustLoad +=
      (thrustTarget - this.thrustLoad) * (1 - Math.exp(-dt / (thrustTarget > this.thrustLoad ? 0.18 : 0.9)));
    const thrustPresence = Math.max(presence, Math.min(1, this.thrustLoad * 2));
    this.thrust?.update(this.thrustLoad, Math.min(1, state.speed * 3.6 / 160), thrustPresence, audioTime);
    // Debris pings only on a hard launch (estimated accel well above gentle driving).
    this.debris?.update(driveState.acceleration, state.speed * 3.6, audioTime);

    let scale: Partial<Record<WorldLayerId, number>> | undefined;
    if (this.whistle) {
      const surging = this.worldState === "build" || this.worldState === "high_energy";
      const wasSurging = prevState === "build" || prevState === "high_energy";
      if (surging && !wasSurging) this.whistle.trigger(audioTime, 1);
      const moving = Math.min(1, Math.max(0, (state.speed * 3.6 - 3) / 10));
      const f = this.whistle.factor(audioTime, this.thrustLoad, moving);
      scale = {};
      for (const id of this.whistleIds) scale[id] = f;
    }

    const rule =
      this.pack.stateRules.find((r) => r.state === this.worldState) ??
      this.pack.stateRules.find((r) => r.state === "motion");
    if (rule) this.layers.setGains(rule.gains, audioTime, scale);

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
    this.thunder = null;
    this.thrust?.dispose();
    this.thrust = null;
    this.debris?.dispose();
    this.debris = null;
    this.whistle = null;
    this.layers?.dispose();
    this.layers = null;
    this.energy = null;
    this.pack = null;
    this.built = false;
    this.lastTs = 0;
    this.worldState = "idle";
  }
}
