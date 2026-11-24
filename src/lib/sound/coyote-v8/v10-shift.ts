/**
 * Racing V10 gear shift and race-mode overrun, applied to the Coyote V8 (Nov 2026).
 *
 * The Racing V10 (HybridCombustionSynth, src/lib/sound/realism/v2/hybrid-combustion-synth.ts)
 * plays every gear change as one choreography on the audio clock
 * (src/lib/sound/realism/shift-events/choreography.ts, engagement "racing-v10" in
 * engagement-presets.ts):
 *   torque cut -> gear engagement (pink noise through a wide 880 Hz band-pass, soft 32 ms
 *   attack, ~130 ms decay) -> driveline thump 12 ms later (brown noise under a 230 Hz
 *   low-pass) -> recovery bark (the engine note snaps back for ~160 ms).
 * No ringing filters and nothing above ~1.5 kHz to speak of: it is heard as a muted
 * mechanical "chunk" through the engine, not as struck metal.
 *
 * Race mode adds (updateRacePops / updateRaceGate / liftPops in the same file):
 *   - an ignition cut through each upshift (output gate to 0.3),
 *   - the rev-limiter bounce as an 11 Hz ignition-cut gate on the engine note,
 *   - a pop on the upshift crack (high rpm, 50 %), pops on limiter cuts (40 %),
 *   - lift-off / downshift overrun pops (60 %, 1.6 s apart) with a crackle tail.
 *
 * This module holds the same numbers and the pure scheduling maths; coyote-synth.ts plays
 * them on the Coyote's loop bank (crackle1-3 one-shots are the V10 crackle rendered
 * offline through the V10 pop chain, so no extra live filter chain runs on the car).
 */
import type { DrivetrainShiftEvent } from "@/lib/powertrain/types";
import { getDrivetrainPersonality } from "@/lib/drive/drivetrain-personalities";
import { buildShiftChoreography } from "@/lib/sound/realism/shift-events/choreography";
import { shiftEngagementForProfile } from "@/lib/sound/realism/shift-events/engagement-presets";
import type { ShiftChoreographyPlan } from "@/lib/sound/realism/shift-events/types";

/** The profile whose gearbox the V8 borrows. */
export const V10_SHIFT_SOURCE_PROFILE = "racing-v10";
const V10_PERSONALITY = "high-rev-v10";

/** Transient voices of the Racing V10 (hybrid-combustion-synth.ts makeVoice / firePulse). */
export const V10_SHIFT_VOICES = {
  shift: { color: "pink", type: "bandpass", q: 0.75, peak: 0.7, attackS: 0.024 },
  thump: { color: "brown", type: "lowpass", q: 1.0, peak: 0.45, attackS: 0.026 },
} as const;
export type V10VoiceId = keyof typeof V10_SHIFT_VOICES;
/** Variant intensity x strength scales a pulse 40-100 % (V10 PULSE_FLOOR). */
export const V10_PULSE_FLOOR = 0.4;
/** Filter settles this long before the gain ramp (V10 click fix). */
export const V10_FILTER_WARMUP_S = 0.008;
/** Recovery bark length (V10 BARK_SECONDS). */
export const V10_BARK_S = 0.16;
/** Upshift reengage: the V10 scheduler's "thump-firm" driveline take-up (pool variant). */
export const V10_REENGAGE_THUMP = { filterHz: 185, decayMs: 170, intensity: 0.62 } as const;
/** The V10's default shift-sound setting (SoundEngine shiftIntensity 0.72) = Coyote 1.0. */
export const V10_DEFAULT_SHIFT_INTENSITY = 0.72;

/** Race mode (hybrid-combustion-synth.ts RACE_* constants). */
export const V10_RACE = {
  liftPops: { probability: 0.6, level: 0.55 },
  liftPopGapS: 1.6,
  shiftCrackProbability: 0.5,
  shiftCrackLevel: 0.5,
  /** Upshift crack only near the top (rpm / redline). */
  shiftCrackRpmNorm: 0.78,
  limiterPopProbability: 0.4,
  limiterPopLevel: 0.22,
  limiterPopGapS: 0.22,
  limiterGateHz: 11,
  limiterGateFloor: 0.12,
  /** Share of each limiter period the ignition is cut. */
  limiterCutShare: 0.42,
  shiftGateFloor: 0.3,
} as const;

export function v10TorqueCutMs(): number {
  return getDrivetrainPersonality(V10_PERSONALITY).transmission.shift.upshiftDurationMs * 0.45;
}

export function v10RecoveryMs(): number {
  return getDrivetrainPersonality(V10_PERSONALITY).transmission.shift.upshiftDurationMs * 0.35;
}

/** Coyote shift setting (1 = default) -> the V10's 0..1 shift intensity. */
export function v10ShiftIntensity(coyoteIntensity: number): number {
  return Math.min(1, Math.max(0, coyoteIntensity * V10_DEFAULT_SHIFT_INTENSITY));
}

/** The Racing V10's choreography for one shift event, on the audio clock. */
export function coyoteV10ShiftPlan(
  event: DrivetrainShiftEvent,
  coyoteIntensity: number,
  audioNowSec: number,
): ShiftChoreographyPlan {
  return buildShiftChoreography({
    event,
    engagement: shiftEngagementForProfile(V10_SHIFT_SOURCE_PROFILE),
    shiftIntensity: v10ShiftIntensity(coyoteIntensity),
    audioNowSec,
    audioNowMs: audioNowSec * 1000,
    torqueCutMs: v10TorqueCutMs(),
    recoveryMs: v10RecoveryMs(),
  });
}

/** Peak gain of a V10 pulse (firePulse): voice peak x (floor .. 1) by intensity. */
export function v10PulsePeak(voice: V10VoiceId, intensity: number): number {
  const v = Math.min(1, Math.max(0, intensity));
  return V10_SHIFT_VOICES[voice].peak * (V10_PULSE_FLOOR + (1 - V10_PULSE_FLOOR) * v);
}

/** Recovery bark level `ts` seconds after it was armed (linear fall over 160 ms). */
export function v10BarkLevel(amount: number, ts: number): number {
  if (ts < 0 || ts >= V10_BARK_S || amount <= 0) return 0;
  return amount * Math.min(1, Math.max(0, (V10_BARK_S - ts) / V10_BARK_S));
}

export interface PopStep {
  /** pop1-3 (bang) or crackle1-3 (tail). */
  id: string;
  /** Seconds after the sequence start. */
  at: number;
  level: number;
  rate: number;
}

/**
 * The Racing V10's exhaust pop sequence (firePopSequence): one to three bangs, then a
 * crackle tail of three to seven. "rev-match" (downshift / upshift crack / limiter) mostly
 * gives a single bang; "overrun" (lift-off) more often two or three.
 */
export function v10PopSequence(
  kind: "rev-match" | "overrun",
  peak: number,
  rand: () => number,
): PopStep[] {
  const steps: PopStep[] = [];
  let t = 0.004;
  const multi = kind === "rev-match" ? 0.25 : 0.6;
  const r = rand();
  const count = r < multi * 0.35 ? 3 : r < multi ? 2 : 1;
  let level = peak;
  for (let k = 0; k < count; k += 1) {
    const variant = 1 + Math.floor(rand() * 3);
    steps.push({
      id: `pop${variant}`,
      at: t,
      level: level * (0.75 + rand() * 0.4),
      rate: 0.85 + rand() * 0.3,
    });
    t += 0.045 + rand() * 0.07;
    level *= 0.62 + rand() * 0.25;
  }
  const tail = 3 + Math.floor(rand() * 5);
  let cl = peak * 0.32;
  for (let k = 0; k < tail; k += 1) {
    t += 0.018 + rand() * 0.045;
    const variant = 1 + Math.floor(rand() * 3);
    steps.push({
      id: `crackle${variant}`,
      at: t,
      level: cl * (0.5 + rand() * 0.7),
      rate: 0.8 + rand() * 0.5,
    });
    cl *= 0.8;
  }
  return steps;
}

/**
 * Rev-limiter ignition-cut gate (updateRaceGate): square cut cycles scheduled ahead from
 * `from` until `until`. Returns [cutStart, refireStart] pairs.
 */
export function v10LimiterGateCycles(from: number, until: number): Array<[number, number]> {
  const period = 1 / V10_RACE.limiterGateHz;
  const out: Array<[number, number]> = [];
  for (let t = from; t < until; t += period) out.push([t, t + period * V10_RACE.limiterCutShare]);
  return out;
}
