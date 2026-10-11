/**
 * Versioned combustion architecture contract shared by the host and
 * `public/audio/combustion-processor.js`.
 *
 * The worklet cannot import TypeScript. Keep numeric codes and labels in sync:
 * this module is the host source of truth; the worklet embeds the same table
 * under `ARCHITECTURE_CONTRACT_VERSION`. Tests assert both sides match.
 */

/** Bump when codes or semantics change; mirror in combustion-processor.js. */
export const ARCHITECTURE_CONTRACT_VERSION = 1 as const;

export type FiringOrderArchetype =
  | "cross-plane-v8"
  | "cross-plane-v8-lope"
  | "flat-plane-v8"
  | "flat-six"
  | "inline-6"
  | "inline-3"
  | "v10-even"
  | "inline-4"
  | "v-twin"
  | "single";

/**
 * 0 even · 1 lope · 2 flat-six · 3 cross-plane refined · 4 v-twin · 5 single · 6 flat-plane-v8
 *
 * Code 5 is single only. Flat-plane V8 must use 6 (never 5).
 */
export type ArchitectureCodeV1 = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const ARCHITECTURE_CODE_MIN = 0;
export const ARCHITECTURE_CODE_MAX = 6;

export const ARCHITECTURE_LABELS_V1: Readonly<Record<ArchitectureCodeV1, string>> = {
  0: "even",
  1: "lope",
  2: "flat-six",
  3: "cross-plane-refined",
  4: "v-twin",
  5: "single",
  6: "flat-plane-v8",
};

/** Archetype → worklet architecture AudioParam. */
export const ARCHETYPE_TO_ARCHITECTURE_CODE_V1: Readonly<
  Record<FiringOrderArchetype, ArchitectureCodeV1>
> = {
  "cross-plane-v8": 3,
  "cross-plane-v8-lope": 1,
  "flat-plane-v8": 6,
  "flat-six": 2,
  "inline-6": 0,
  "inline-3": 1, // see RALLY_TURBO_3_LOPE_SHORTCUT
  "v10-even": 0,
  "inline-4": 0,
  "v-twin": 4,
  single: 5,
};

/**
 * Rally Turbo 3 (`inline-3` / `rally-car`) currently reuses the V8-lope worklet
 * branch (code 1) as an artistic irregularity shortcut. This is NOT an explicit
 * three-cylinder firing schedule. Resolve with a topology prompt later.
 */
export const RALLY_TURBO_3_LOPE_SHORTCUT = {
  profileId: "rally-car",
  personalityId: "rally-turbo-3",
  architecture: "inline-3" as const,
  architectureCode: 1 as ArchitectureCodeV1,
  status: "unresolved-tuning-decision" as const,
  note: "Uses lope (code 1) for uneven pulse feel until an explicit 3-cylinder topology ships.",
};

export function isArchitectureCodeV1(value: number): value is ArchitectureCodeV1 {
  return Number.isInteger(value) && value >= ARCHITECTURE_CODE_MIN && value <= ARCHITECTURE_CODE_MAX;
}

export function clampArchitectureCodeV1(value: number, fallback: ArchitectureCodeV1 = 0): ArchitectureCodeV1 {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (!isArchitectureCodeV1(rounded)) return fallback;
  return rounded;
}

export function architectureCodeForArchetype(architecture: FiringOrderArchetype): ArchitectureCodeV1 {
  return ARCHETYPE_TO_ARCHITECTURE_CODE_V1[architecture];
}

/**
 * Half-order resonator weight. Strong for uneven firing (lope, twin, single);
 * moderate for refined cross-plane; low for even / flat-six / flat-plane-v8.
 */
export function halfOrderWeightForArchitectureCode(architectureCode: number): number {
  const code = clampArchitectureCodeV1(architectureCode, 0);
  if (code === 1 || code === 4 || code === 5) return 0.75;
  if (code === 3) return 0.5;
  // 0 even · 2 flat-six · 6 flat-plane-v8
  return 0.18;
}
