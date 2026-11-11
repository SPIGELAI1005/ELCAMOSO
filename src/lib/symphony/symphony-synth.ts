import type { DriveState } from "@/lib/drive/model";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import { createArrangementEngine, type ArrangementEngine } from "./arrangement-engine";
import { createDriveEnergyTracker, type DriveEnergyTracker } from "./drive-energy";
import { createSymphonyEventBus, type SymphonyEventBus } from "./events";
import { getSymphonyPack } from "./experience-pack";
import { createMusicClock, type MusicClock } from "./music-clock";
import { createStemPlayer, type StemPlayer } from "./stem-player";
import type { DriveEnergyState, SymphonyDiagnostics, SymphonyPack } from "./types";
import { getCachedSymphonyBuffers } from "./pack-loader";
import { isSymphonyPackProductionReady } from "./asset-manifest";
import { createViralTechno, electronicGainsFromDrive, type ViralTechno } from "./viral-techno";
import { createViralEdm, type ViralEdm } from "./viral-edm";
import {
  applyStemScale,
  createEdmMachine,
  type EdmMachine,
  type EdmSnapshot,
} from "./viral-edm-machine";

export class SymphonySynth {
  private pack: SymphonyPack | null = null;
  private clock: MusicClock | null = null;
  private energy: DriveEnergyTracker | null = null;
  private events: SymphonyEventBus | null = null;
  private arrangement: ArrangementEngine | null = null;
  private stems: StemPlayer | null = null;
  private techno: ViralTechno | null = null;
  private edm: ViralEdm | null = null;
  private edmMachine: EdmMachine | null = null;
  private seed = 1;
  private lastTs = 0;
  private lastEnergy: DriveEnergyState | null = null;
  private lastEdmSnap: EdmSnapshot | null = null;
  private built = false;

  build(
    ctx: BaseAudioContext,
    profile: SoundProfile,
    buses: StrategyBuses,
    seed?: number,
  ): boolean {
    this.dispose();
    const pack = getSymphonyPack(profile.id);
    if (!pack) return false;
    if (import.meta.env.PROD && !isSymphonyPackProductionReady(pack)) return false;

    const buffers = getCachedSymphonyBuffers(pack.id)?.buffers;
    if (pack.licensing.source === "licensed") {
      const missing = pack.stems.some((stem) => !buffers?.get(stem.id));
      if (missing) return false;
    }

    this.seed = seed ?? Date.now() & 0xffff;
    this.pack = pack;
    const start = "currentTime" in ctx ? ctx.currentTime : 0;
    const clockConfig = {
      bpm: pack.bpm,
      beatsPerBar: pack.beatsPerBar,
      barsPerLoop: pack.barsPerLoop,
    };
    // Clock start is set after we know whether a one-shot intro will delay the loop.
    const bootstrapClock = createMusicClock(clockConfig, start);
    this.energy = createDriveEnergyTracker();
    this.events = createSymphonyEventBus({ seed: this.seed });
    // Feed body bus → cabin → master (same path as other synths)
    this.stems = createStemPlayer(ctx, buses.body, pack, bootstrapClock, this.seed, buffers);
    const introDur = this.stems.introDuration();
    this.clock = createMusicClock(clockConfig, start + 0.02 + introDur);
    this.arrangement = createArrangementEngine(pack, this.clock, this.seed, {
      profileId: profile.id,
    });
    if (pack.electronicLayers) {
      this.techno = createViralTechno(ctx, this.stems.bus, this.clock, this.stems.ducks);
      this.techno.start(start + 0.02);
    }
    if (pack.edmArrangement) {
      this.edmMachine = createEdmMachine();
      this.edm = createViralEdm(ctx, this.stems, this.clock, buffers, this.stems.ducks);
      this.edm.start(start + 0.02);
    }
    this.stems.start(start + 0.02);
    this.arrangement.setMovementState("stopped");
    this.stems.setTargets(this.arrangement.snapshot().targets, start + 0.02);
    this.built = true;
    return true;
  }

  update(state: DriveState, audioTime: number) {
    if (
      !this.built ||
      !this.clock ||
      !this.energy ||
      !this.events ||
      !this.arrangement ||
      !this.stems
    ) {
      return;
    }
    const dt =
      this.lastTs > 0
        ? Math.min(0.1, Math.max(0.001, (state.timestamp - this.lastTs) / 1000))
        : 1 / 60;
    this.lastTs = state.timestamp || this.lastTs;

    const energy = this.energy.update(state, dt);
    this.lastEnergy = energy;
    this.events.observe(state, energy, audioTime);
    const drained = this.events.drain();
    this.arrangement.setDrive(state.speed * 3.6, energy);
    this.arrangement.setMovementState(energy.movementState);
    if (drained.length) {
      this.arrangement.ingestEvents(drained, audioTime, energy.movementState);
      const grid = this.pack?.gainTauSeconds ? "beat" : "bar";
      for (const ev of drained) {
        const at = this.clock.nextBoundary(audioTime, grid === "beat" ? "beat" : "bar");
        this.stems.triggerOneShots(ev.type, at);
      }
    }
    let targets = this.arrangement.tick(audioTime);
    let edmSnap = null;
    if (this.edm && this.edmMachine && this.clock) {
      const kmh = state.speed * 3.6;
      edmSnap = this.edmMachine.tick({
        kmh,
        throttle: state.throttle,
        movement: energy.movementState,
        audioTime,
        clockOrigin: this.clock.origin,
        barDuration: this.clock.snapshot(audioTime).barDuration,
      });
      targets = applyStemScale(targets, edmSnap.stemScale);
      this.lastEdmSnap = edmSnap;
      this.edm.update(
        {
          kmh,
          throttle: state.throttle,
          movement: energy.movementState,
          audioTime,
          clockOrigin: this.clock.origin,
          barDuration: this.clock.snapshot(audioTime).barDuration,
        },
        edmSnap,
        audioTime,
      );
    }
    this.stems.setTargets(targets, audioTime);
    if (this.techno) {
      const kmh = state.speed * 3.6;
      this.techno.setGains(
        electronicGainsFromDrive(kmh, energy.movementState, energy.energy),
        audioTime,
      );
      this.techno.schedule(audioTime);
    }
  }

  getEnergy(): DriveEnergyState | null {
    return this.lastEnergy ?? this.energy?.snapshot() ?? null;
  }

  getDiagnostics(): SymphonyDiagnostics {
    const snap = this.clock?.snapshot(this.clock ? this.clock.snapshot(0).audioTime : 0);
    // Prefer last known audio time from energy path - diagnostics callers pass via getDiagnosticsAt
    return this.getDiagnosticsAt(snap?.audioTime ?? 0);
  }

  getDiagnosticsAt(audioTime: number): SymphonyDiagnostics {
    const clockSnap = this.clock?.snapshot(audioTime);
    const arr = this.arrangement?.snapshot();
    return {
      packId: this.pack?.id ?? null,
      bpm: clockSnap?.bpm ?? 0,
      bar: clockSnap?.bar ?? 0,
      beat: clockSnap?.beat ?? 0,
      energy: this.lastEnergy?.energy ?? 0,
      movementState: this.lastEnergy?.movementState ?? "stopped",
      activeStems: this.stems?.activeStems() ?? [],
      nextTransitionAt: arr?.scheduled?.at ?? null,
      pendingEvents: this.events?.pendingCount() ?? 0,
      bufferReady: Boolean(this.stems),
      seed: this.seed,
      lateEvents:
        (this.stems?.lateEvents ?? 0) +
        (this.techno?.lateEvents ?? 0) +
        (this.edm?.lateEvents ?? 0),
      lookaheadSec: 0.1,
      techno: this.techno?.gains,
      edm: this.lastEdmSnap
        ? {
            phase: this.lastEdmSnap.phase,
            barsIntoPhase: this.lastEdmSnap.barsIntoPhase,
            buildProgress: this.lastEdmSnap.buildProgress,
            scheduledAt: this.lastEdmSnap.scheduledAt,
            phaseEndsAt: this.lastEdmSnap.phaseEndsAt,
          }
        : undefined,
    };
  }

  dispose() {
    this.edm?.dispose();
    this.edm = null;
    this.edmMachine = null;
    this.lastEdmSnap = null;
    this.techno?.dispose();
    this.techno = null;
    this.stems?.dispose();
    this.stems = null;
    this.arrangement = null;
    this.events = null;
    this.energy = null;
    this.clock = null;
    this.pack = null;
    this.built = false;
    this.lastEnergy = null;
    this.lastTs = 0;
  }
}
