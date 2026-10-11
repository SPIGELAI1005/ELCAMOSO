import type { TransientKind } from "@/lib/sound/dynamic-drive/transient-scheduler";

/** Per-profile mechanical engagement character (Prompt 06). */
export type ShiftEngagementStyle =
  | "muscle-heavy"
  | "sports-precise"
  | "restrained"
  | "none";

export interface ShiftEngagementPreset {
  style: ShiftEngagementStyle;
  /** When false, no mechanical clacks/thumps (gearless / futuristic). */
  allowMechanicalTransient: boolean;
  allowRevBlip: boolean;
  allowLiftOffPop: boolean;
  allowOverrun: boolean;
  /** Procedural thump body (Hz) — keep low-mid, not piercing. */
  thumpFilterHz: number;
  thumpDecayMs: number;
  thumpIntensity: number;
  shiftFilterHz: number;
  shiftDecayMs: number;
  shiftIntensity: number;
  recoveryBarkScale: number;
  /** Torque-cut duck amount for the synchronized envelope (0..1). */
  torqueCutEnvelope: number;
  notes: string;
}

export type ShiftChoreographyPhase =
  | "torque-cut"
  | "mechanical"
  | "ratio-hold"
  | "recovery";

export interface ShiftChoreographyStep {
  phase: ShiftChoreographyPhase;
  /** Absolute AudioContext time. */
  audioTime: number;
  /** Optional audible transient; omitted for envelope-only phases. */
  kind: TransientKind | null;
  intensity: number;
  filterHz: number;
  decayMs: number;
  /** Recovery bark / torque envelope scale (independent of master volume). */
  envelopeScale: number;
}

export interface ShiftChoreographyPlan {
  sequenceId: number;
  direction: "up" | "down";
  steps: ShiftChoreographyStep[];
  /** True when mechanical steps were omitted (intensity 0 or style none). */
  mechanicalMuted: boolean;
}

export interface ShiftConsumeResult {
  accepted: boolean;
  reason:
    | "accepted"
    | "duplicate"
    | "stale"
    | "timeline-gap"
    | "null-event"
    | "invalid-id";
  sequenceId: number | null;
}
