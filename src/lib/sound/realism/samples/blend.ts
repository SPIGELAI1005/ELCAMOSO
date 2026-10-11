import type { HybridSampleBlendMode } from "@/lib/sound/realism/samples/types";

/**
 * Two-way crossfade weights.
 * Equal-power is a starting option — it does not guarantee absence of comb
 * filtering or level peaks for correlated engine loops.
 */
export function crossfadeWeights(
  blend01: number,
  mode: HybridSampleBlendMode = "linear",
): { a: number; b: number } {
  const t = Math.min(1, Math.max(0, blend01));
  if (mode === "equal-power") {
    const a = Math.cos(t * (Math.PI / 2));
    const b = Math.sin(t * (Math.PI / 2));
    return { a, b };
  }
  return { a: 1 - t, b: t };
}

/** Renormalize positive weights so they sum to 1 (linear amplitude mix). */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (sum <= 0) return weights.map(() => 0);
  return weights.map((w) => Math.max(0, w) / sum);
}

/**
 * Apply equal-power shaping to an already-normalized multi-target weight list.
 * Used optionally after linear RPM/load selection — not a comb-filter cure.
 */
export function applyEqualPowerShape(weights: number[]): number[] {
  const shaped = weights.map((w) => Math.sqrt(Math.max(0, w)));
  return normalizeWeights(shaped);
}
