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
import type { StrategyBuses } from "@/lib/sound/realism/types";
import { createTakeoffWhistleVoice, type TakeoffWhistleVoice } from "./takeoff-whistle";
import { createWingCheckVoice, type WingCheckVoice } from "./wing-check";

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
  };
}

export function createJetAirfield(
  ctx: BaseAudioContext,
  buses: StrategyBuses,
  turbofanProfile: SoundProfile,
  overlayDestination: AudioNode,
  options?: { experienceTuning?: boolean },
): JetAirfield {
  const engine = scaleStrategyBuses(ctx, buses, 0);
  const bed = scaleStrategyBuses(ctx, buses, JET_IDLE_BED_TRIM);
  const nodes: GainNode[] = [...engine.nodes, ...bed.nodes];
  const turbofan = new ImprovedSynth();
  turbofan.setExperienceEnabled(options?.experienceTuning ?? true);
  const bedOk = turbofan.build(ctx, turbofanProfile, bed.buses);
  const whistle = createTakeoffWhistleVoice(ctx, overlayDestination);
  const wings = createWingCheckVoice(ctx, overlayDestination);
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
    for (const n of bed.nodes) n.gain.setTargetAtTime(b * JET_IDLE_BED_TRIM, t, 0.03);
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
      if (bedOk && gate < 0.999) turbofan.update(turbofanBedState(state), t);
      whistle.update(state, t);
      wings.update(state, t);
    },
    diagnostics: () => ({
      engineGate: gate,
      engineConnected: engineBranch.connected,
      bedConnected: bedBranch.connected,
      bedGain: Math.cos((gate * Math.PI) / 2) * JET_IDLE_BED_TRIM,
      bedLayers: bedOk ? turbofan.listLayers().length : 0,
      whistle: whistle.diagnostics(),
      wingChecks: wings.diagnostics(),
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      turbofan.dispose();
      whistle.dispose();
      wings.dispose();
      disposeGainNodes(nodes);
    },
  };
}
