import type { MovementState, StemGainTargets, StemId } from "@/lib/symphony/types";
import {
  DEFAULT_SYMPHONY_PARAMS,
  type InstrumentFocusId,
  type SymphonyStudioParams,
} from "./types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const STEM_GROUPS: Record<InstrumentFocusId, StemId[]> = {
  atmosphere: ["atmosphere"],
  drums: ["drumsLow", "drumsHigh"],
  bass: ["bass"],
  guitar: ["rhythm"],
  strings: ["strings", "cello", "brass", "piano"],
  lead: ["lead"],
};

/** Ensure at least atmosphere (and bass when motion) so arrangement never goes silent. */
export function ensureViableInstruments(
  instruments: Record<InstrumentFocusId, boolean>,
): Record<InstrumentFocusId, boolean> {
  const next = { ...instruments };
  if (!Object.values(next).some(Boolean)) {
    next.atmosphere = true;
    next.bass = true;
  }
  if (!next.atmosphere) next.atmosphere = true;
  return next;
}

/**
 * Transform arrangement stem gains using Studio Symphony dials.
 * Does not expose raw stem faders in the basic UI path.
 */
export function applySymphonyStudioToGains(
  gains: StemGainTargets,
  params: SymphonyStudioParams,
  movement: MovementState,
): StemGainTargets {
  const p = { ...DEFAULT_SYMPHONY_PARAMS, ...params };
  const instruments = ensureViableInstruments(p.instruments);
  const out: StemGainTargets = { ...gains };

  // Instrument focus - mute groups, keep viable base
  for (const [group, stems] of Object.entries(STEM_GROUPS) as [InstrumentFocusId, StemId[]][]) {
    if (!instruments[group]) {
      for (const id of stems) out[id] = 0;
    }
  }

  const energyScale = 0.55 + p.energy * 0.7;
  const rhythmBoost = 0.75 + p.rhythm * 0.55;
  const melodyBoost = 0.7 + p.melody * 0.65;
  const dramaBoost =
    movement === "peak" || movement === "energetic" ? 0.7 + p.drama * 0.8 : 0.85 + p.drama * 0.2;
  const buildGate =
    movement === "calm" || movement === "cruise"
      ? 0.65 + (1 - p.build) * 0.25
      : 0.75 + p.build * 0.35;

  for (const id of Object.keys(out) as StemId[]) {
    let g = out[id] ?? 0;
    if (id === "drumsLow" || id === "drumsHigh") g *= rhythmBoost;
    if (id === "lead" || id === "strings" || id === "brass" || id === "piano") g *= melodyBoost;
    if (id === "fx" || id === "strings") g *= dramaBoost;
    if (id === "lead" || id === "drumsHigh") g *= buildGate;
    g *= energyScale;
    const mixOverride = p.stemMix[id];
    if (typeof mixOverride === "number") g *= 0.35 + mixOverride * 0.9;
    out[id] = clamp01(g);
  }

  // Climax sensitivity - open lead/fx sooner when high
  if (p.climaxSensitivity > 0.55 && (movement === "building" || movement === "energetic")) {
    out["lead"] = clamp01((out["lead"] ?? 0) + (p.climaxSensitivity - 0.55) * 0.5);
    out["fx"] = clamp01((out["fx"] ?? 0) + (p.climaxSensitivity - 0.55) * 0.25);
  }

  // Never fully silent
  const sum = Object.values(out).reduce((a, b) => a + (b ?? 0), 0);
  if (sum < 0.08) {
    out["atmosphere"] = Math.max(out["atmosphere"] ?? 0, 0.4);
    out["bass"] = Math.max(out["bass"] ?? 0, 0.25);
  }
  return out;
}

/** Fill cooldown scale - higher fillFrequency → shorter cooldown. */
export function fillCooldownScale(params: SymphonyStudioParams): number {
  return 1.6 - clamp01(params.fillFrequency) * 1.1;
}

/** Transition preference - higher → prefer beat over bar (caller maps). */
export function prefersFasterTransitions(params: SymphonyStudioParams): boolean {
  return params.transitionFrequency > 0.6 || params.build > 0.65;
}

export function variationSeedOffset(params: SymphonyStudioParams, baseSeed: number): number {
  return (baseSeed + Math.round(params.variation * 97)) & 0xffff;
}
