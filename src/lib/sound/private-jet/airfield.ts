/**
 * Private Jet Oberpfaffenhofen = Ge-Squared O))) sound, unchanged, with an airfield frame:
 *
 * - Parked / idle: the original Private Jet turbofan wind bed (the ImprovedSynth
 *   "private-jet" strategy, exactly as the old profile built it) plus pre-flight wing checks.
 *   No Ge-Squared (V8-based) idle at all: its buses are gated to silence.
 * - Moving / accelerating / cruising: Ge-Squared takes over (equal-power crossfade).
 * - Take-off (strong launch from slow): turbo whistle on top.
 *
 * The Ge-Squared synth is built by the engine as usual (alias base) on the gated buses
 * returned here; nothing inside it is changed.
 */
import type { DriveState } from "@/lib/drive/model";
import { scaleStrategyBuses, disposeGainNodes } from "@/lib/sound/engine-layers";
import type { SoundProfile } from "@/lib/sound/profiles";
import { ImprovedSynth } from "@/lib/sound/realism/improved-synth";
import { audioRandomState, seedAudioRandom } from "@/lib/sound/rng";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import { createAfterburnerVoice, type AfterburnerVoice } from "./afterburner";
import {
  PRIVATE_JET_WHISTLE,
  createTakeoffWhistleVoice,
  type TakeoffWhistleParams,
  type TakeoffWhistleVoice,
} from "./takeoff-whistle";
import {
  PRIVATE_JET_WING_CHECK,
  createWingCheckVoice,
  type WingCheckStyle,
  type WingCheckVoice,
} from "./wing-check";

/** Speeds up to this (km/h) count as parked (GPS jitter). */
export const JET_PARKED_JITTER_KMH = 2;
/** Ge-Squared fully in from this speed (km/h) on. */
export const JET_ENGINE_FULL_KMH = 12;
/** Launch acceleration (m/s²) that brings Ge-Squared in before the car has speed. */
export const JET_ENGINE_ACCEL_ON = 0.35;
export const JET_ENGINE_ACCEL_FULL = 1.2;
export const JET_ENGINE_ATTACK_S = 0.3;
export const JET_ENGINE_RELEASE_S = 0.5;
/**
 * Idle wind bed level vs the old Private Jet: the old profile ran with +12.2 dB catalog
 * makeup (loudness.ts PROFILE_MAKEUP_DB), Ge-Squared runs with 0 dB, so the bed carries
 * the difference itself (calibrated with the offline drive harness against main).
 */
export const JET_IDLE_BED_TRIM = 10 ** (12.2 / 20) * 0.98;

/**
 * Per-aircraft airfield frame. The moving sound is the alias base (SOUND_ALIASES in
 * engine.ts); the parked bed is the aircraft's own ImprovedSynth strategy.
 */
export interface AirfieldConfig {
  /** Parked bed level, carrying the old profile's loudness/makeup vs the base profile. */
  bedTrim: number;
  /**
   * When set, the parked bed draws from its own audioRandom stream (this seed), so the base
   * profile's random draws (crackle, bursts, noise buffers) are exactly those of the base
   * sound on its own. Unset = shared stream (Private Jet, unchanged since PR #37).
   */
  bedRandomSeed?: number;
  whistle: TakeoffWhistleParams;
  wingCheck: WingCheckStyle;
  wingSeed: number;
  /** Fighter Jet: afterburner light + reheat roar on take-off. */
  afterburner: boolean;
}

export const PRIVATE_JET_AIRFIELD: AirfieldConfig = {
  bedTrim: JET_IDLE_BED_TRIM,
  whistle: PRIVATE_JET_WHISTLE,
  wingCheck: PRIVATE_JET_WING_CHECK,
  wingSeed: 20261124,
  afterburner: false,
};

/** Seconds a branch must be fully silent before it is disconnected. */
const BRANCH_PARK_S = 0.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0 = parked (jet wind bed only) .. 1 = moving (Ge-Squared only). Pure target, unsmoothed. */
export function jetEngineGateTarget(state: DriveState): number {
  const kmh = Math.max(0, state.speed || 0) * 3.6;
  const acc = state.accelerationEstimated ?? state.acceleration ?? 0;
  const demand = state.powertrain?.driverDemand ?? state.throttle ?? 0;
  return clamp01(
    Math.max(
      // Deadband: parked GPS jitter (0-2 km/h) must not leak the V8-based sound into idle.
      (kmh - JET_PARKED_JITTER_KMH) / (JET_ENGINE_FULL_KMH - JET_PARKED_JITTER_KMH),
      kmh >= JET_PARKED_JITTER_KMH
        ? (acc - JET_ENGINE_ACCEL_ON) / (JET_ENGINE_ACCEL_FULL - JET_ENGINE_ACCEL_ON)
        : 0,
      // Hold-to-rev while parked is a deliberate rev, not idle.
      (demand - 0.3) / 0.35,
    ),
  );
}

/** Continuous-drive view of the frame for the old turbofan bed (no gears, no rpm). */
export function turbofanBedState(state: DriveState): DriveState {
  const kmh = Math.max(0, state.speed || 0) * 3.6;
  const roadLoad = clamp01((kmh / 160) * 0.08 + (kmh / 220) ** 2 * 0.06);
  const throttle = state.throttle ?? 0;
  const { powertrain: _pt, ...rest } = state;
  void _pt;
  return {
    ...rest,
    rpm: 0,
    gear: 0,
    isShifting: false,
    load: clamp01(throttle * 0.65 + roadLoad * 0.35 - (state.regen ?? 0) * 0.25),
  };
}

export interface JetAirfield {
  /** Buses for the Ge-Squared synth (gated). */
  engineBuses: StrategyBuses;
  update(state: DriveState, t: number): void;
  dispose(): void;
  diagnostics(): {
    engineGate: number;
    engineConnected: boolean;
    bedConnected: boolean;
    bedGain: number;
    bedLayers: number;
    whistle: ReturnType<TakeoffWhistleVoice["diagnostics"]>;
    wingChecks: ReturnType<WingCheckVoice["diagnostics"]>;
    afterburner: ReturnType<AfterburnerVoice["diagnostics"]> | null;
  };
}

export function createJetAirfield(
  ctx: BaseAudioContext,
  buses: StrategyBuses,
  turbofanProfile: SoundProfile,
  overlayDestination: AudioNode,
  options?: { experienceTuning?: boolean; config?: AirfieldConfig },
): JetAirfield {
  const cfg = options?.config ?? PRIVATE_JET_AIRFIELD;
  const engine = scaleStrategyBuses(ctx, buses, 0);
  const bed = scaleStrategyBuses(ctx, buses, cfg.bedTrim);
  const nodes: GainNode[] = [...engine.nodes, ...bed.nodes];
  let bedRandom = cfg.bedRandomSeed;
  const onBedRandom = <T>(fn: () => T): T => {
    if (bedRandom === undefined) return fn();
    const outer = audioRandomState();
    seedAudioRandom(bedRandom);
    try {
      return fn();
    } finally {
      bedRandom = audioRandomState();
      seedAudioRandom(outer);
    }
  };
  const turbofan = new ImprovedSynth();
  turbofan.setExperienceEnabled(options?.experienceTuning ?? true);
  // With its own stream the bed is also built on the first update, after the base profile's
  // strategy, so the base sound creates (and draws) its shared noise buffers itself.
  let bedOk = false;
  let bedBuilt = false;
  const buildBed = () => {
    bedBuilt = true;
    bedOk = onBedRandom(() => turbofan.build(ctx, turbofanProfile, bed.buses));
  };
  if (bedRandom === undefined) buildBed();
  const whistle = createTakeoffWhistleVoice(ctx, overlayDestination, cfg.whistle);
  const wings = createWingCheckVoice(ctx, overlayDestination, cfg.wingSeed, cfg.wingCheck);
  const afterburner: AfterburnerVoice | null = cfg.afterburner
    ? createAfterburnerVoice(ctx, overlayDestination)
    : null;
  let gate = 0;
  let lastT: number | null = null;
  let disposed = false;

  // Tesla CPU: a branch that is fully faded out is also disconnected, so the browser stops
  // pulling (rendering) it - the Ge-Squared graph while parked, the wind bed while driving.
  const dests = [buses.body, buses.accents, buses.beds, buses.profile];
  const branch = (gains: GainNode[]) => {
    let connected = true;
    return {
      set(on: boolean) {
        if (on === connected) return;
        connected = on;
        gains.forEach((g, i) => {
          try {
            if (on) g.connect(dests[i]!);
            else g.disconnect();
          } catch {
            /* closed context */
          }
        });
      },
      get connected() {
        return connected;
      },
    };
  };
  // Offline lab renders schedule every frame before rendering, so connect/disconnect cannot be
  // timed there: the harness sets this flag and relies on the gains alone.
  const parkBranches = !(globalThis as { __ELC_JET_NO_BRANCH_PARK?: boolean })
    .__ELC_JET_NO_BRANCH_PARK;
  const engineBranch = branch(engine.nodes);
  const bedBranch = branch(bed.nodes);
  if (parkBranches) engineBranch.set(false);
  let engineSilentFor = 0;
  let bedSilentFor = 0;

  const setGains = (t: number, target: number, dt: number) => {
    const e = Math.sin((gate * Math.PI) / 2);
    const b = Math.cos((gate * Math.PI) / 2);
    // Reconnect before the fade-in starts; disconnect after ~0.5 s fully silent.
    engineSilentFor = gate <= 0.001 && target <= 0 ? engineSilentFor + dt : 0;
    bedSilentFor = gate >= 0.999 && target >= 1 ? bedSilentFor + dt : 0;
    if (parkBranches) {
      engineBranch.set(engineSilentFor < BRANCH_PARK_S);
      bedBranch.set(bedSilentFor < BRANCH_PARK_S);
    }
    for (const n of engine.nodes) n.gain.setTargetAtTime(e, t, 0.03);
    for (const n of bed.nodes) n.gain.setTargetAtTime(b * cfg.bedTrim, t, 0.03);
  };

  return {
    engineBuses: engine.buses,
    update(state, t) {
      if (disposed) return;
      const dt = lastT === null ? 0 : Math.min(0.25, Math.max(0, t - lastT));
      lastT = t;
      const target = jetEngineGateTarget(state);
      const tau = target > gate ? JET_ENGINE_ATTACK_S : JET_ENGINE_RELEASE_S;
      gate += (target - gate) * (dt > 0 ? 1 - Math.exp(-dt / tau) : 0);
      if (target >= 0.999 && gate > 0.995) gate = 1;
      if (target <= 0 && gate < 0.01) gate = 0;
      setGains(t, target, dt);
      // The bed only matters while it is audible.
      if (!bedBuilt && !disposed) buildBed();
      if (bedOk && gate < 0.999) onBedRandom(() => turbofan.update(turbofanBedState(state), t));
      whistle.update(state, t);
      wings.update(state, t);
      afterburner?.update(whistle.diagnostics().gate, Math.max(0, state.speed || 0) * 3.6, t);
    },
    diagnostics: () => ({
      engineGate: gate,
      engineConnected: engineBranch.connected,
      bedConnected: bedBranch.connected,
      bedGain: Math.cos((gate * Math.PI) / 2) * cfg.bedTrim,
      bedLayers: bedOk ? turbofan.listLayers().length : 0,
      whistle: whistle.diagnostics(),
      wingChecks: wings.diagnostics(),
      afterburner: afterburner?.diagnostics() ?? null,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      turbofan.dispose();
      whistle.dispose();
      wings.dispose();
      afterburner?.dispose();
      disposeGainNodes(nodes);
    },
  };
}
