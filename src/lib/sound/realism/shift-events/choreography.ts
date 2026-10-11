import type { DrivetrainShiftEvent } from "@/lib/powertrain/types";
import type {
  ShiftChoreographyPlan,
  ShiftChoreographyStep,
  ShiftEngagementPreset,
} from "@/lib/sound/realism/shift-events/types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface BuildShiftChoreographyInput {
  event: DrivetrainShiftEvent;
  engagement: ShiftEngagementPreset;
  /** User shift intensity 0..1 — separate from master volume. */
  shiftIntensity: number;
  /** AudioContext.currentTime (seconds). */
  audioNowSec: number;
  /** Audio clock ms (audioNowSec * 1000) for mapping event.atMs. */
  audioNowMs: number;
  /** Optional torque-cut duration from VT recipe / personality (ms). */
  torqueCutMs?: number;
  recoveryMs?: number;
}

/**
 * Build one synchronized shift: torque-cut → mechanical → ratio hold → recovery.
 * Scheduled on the audio clock; telemetry `atMs` is mapped explicitly (not UI frames).
 *
 * Documented original procedural transients — licensed samples may replace the
 * mechanical step later without changing phase timing.
 */
export function buildShiftChoreography(input: BuildShiftChoreographyInput): ShiftChoreographyPlan {
  const {
    event,
    engagement,
    shiftIntensity,
    audioNowSec,
    audioNowMs,
    torqueCutMs = 90,
    recoveryMs = 120,
  } = input;
  const intensity = clamp01(shiftIntensity);
  const mechanicalMuted =
    intensity <= 0.001 || !engagement.allowMechanicalTransient || engagement.style === "none";

  // Map telemetry timestamp → audio time. Cap catch-up so we never dump a backlog.
  const lagSec = (audioNowMs - event.atMs) / 1000;
  const t0 = audioNowSec - Math.min(Math.max(lagSec, 0), 0.04);

  const cutDur = Math.max(0.04, Math.min(0.22, torqueCutMs / 1000));
  const recoverDur = Math.max(0.05, Math.min(0.25, recoveryMs / 1000));
  const mechDelay =
    engagement.style === "sports-precise" ? 0.018 : engagement.style === "muscle-heavy" ? 0.032 : 0.024;

  const steps: ShiftChoreographyStep[] = [];

  steps.push({
    phase: "torque-cut",
    audioTime: t0,
    kind: null,
    intensity: 0,
    filterHz: engagement.thumpFilterHz,
    decayMs: cutDur * 1000,
    envelopeScale: engagement.torqueCutEnvelope * (0.55 + intensity * 0.45),
  });

  if (!mechanicalMuted) {
    const kind = event.direction === "up" ? "upshift" : "downshift";
    const mechScale = engagement.shiftIntensity * intensity;
    steps.push({
      phase: "mechanical",
      audioTime: t0 + mechDelay,
      kind,
      intensity: mechScale,
      filterHz: engagement.shiftFilterHz,
      decayMs: engagement.shiftDecayMs,
      envelopeScale: 0,
    });
    steps.push({
      phase: "mechanical",
      audioTime: t0 + mechDelay + 0.012,
      kind: "drivetrain-thump",
      intensity: engagement.thumpIntensity * intensity,
      filterHz: engagement.thumpFilterHz,
      decayMs: engagement.thumpDecayMs,
      envelopeScale: 0,
    });
  }

  steps.push({
    phase: "ratio-hold",
    audioTime: t0 + cutDur * 0.55,
    kind: null,
    intensity: 0,
    filterHz: engagement.shiftFilterHz,
    decayMs: cutDur * 400,
    envelopeScale: engagement.torqueCutEnvelope * 0.35 * (0.5 + intensity * 0.5),
  });

  steps.push({
    phase: "recovery",
    audioTime: t0 + cutDur * 0.85,
    kind: null,
    intensity: 0,
    filterHz: engagement.shiftFilterHz,
    decayMs: recoverDur * 1000,
    envelopeScale: engagement.recoveryBarkScale * (0.4 + intensity * 0.6),
  });

  return {
    sequenceId: event.sequenceId,
    direction: event.direction,
    steps,
    mechanicalMuted,
  };
}

/** Peak mechanical transient level at intensity 1.0 (for tests / matrix). */
export function maxMechanicalTransientLevel(engagement: ShiftEngagementPreset): number {
  if (!engagement.allowMechanicalTransient || engagement.style === "none") return 0;
  return Math.max(engagement.shiftIntensity, engagement.thumpIntensity);
}
