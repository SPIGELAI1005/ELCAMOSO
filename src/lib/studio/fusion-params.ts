import { DEFAULT_FUSION_PARAMS, type FusionStudioParams } from "./types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function normalizeFusionParams(partial?: Partial<FusionStudioParams>): FusionStudioParams {
  return {
    ...DEFAULT_FUSION_PARAMS,
    ...partial,
    mix: clamp01(partial?.mix ?? DEFAULT_FUSION_PARAMS.mix),
    machinePresence: clamp01(partial?.machinePresence ?? DEFAULT_FUSION_PARAMS.machinePresence),
    musicEnergy: clamp01(partial?.musicEnergy ?? DEFAULT_FUSION_PARAMS.musicEnergy),
    shiftEmphasis: clamp01(partial?.shiftEmphasis ?? DEFAULT_FUSION_PARAMS.shiftEmphasis),
    harmonicResonance: clamp01(
      partial?.harmonicResonance ?? DEFAULT_FUSION_PARAMS.harmonicResonance,
    ),
  };
}

/** Effective fusion mix after Machine presence / Music energy dials. */
export function effectiveFusionMix(params: FusionStudioParams): number {
  const base = clamp01(params.mix);
  // Presence pulls toward machine; music energy toward music
  const pull = (params.musicEnergy - params.machinePresence) * 0.2;
  return clamp01(base + pull);
}
