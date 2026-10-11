import type { RawMechanicalQualityTier } from "@/lib/sound/realism/v3/pulse-primitives";

/**
 * Per-pilot raw-mechanical overlays (Prompt 04).
 * Distinct identities — never apply the same bass boost / octave-down to every profile.
 */

export const RAW_MECHANICAL_PILOT_IDS = ["american-muscle-v8", "flat-six-sport"] as const;
export type RawMechanicalPilotId = (typeof RAW_MECHANICAL_PILOT_IDS)[number];

export function isRawMechanicalPilotId(id: string): id is RawMechanicalPilotId {
  return (RAW_MECHANICAL_PILOT_IDS as readonly string[]).includes(id);
}

export interface RawMechanicalPreset {
  profileId: RawMechanicalPilotId;
  /** Deterministic seed for cycle variation / diagnostics. */
  seed: number;
  quality: RawMechanicalQualityTier;
  /**
   * Low-order body peaking (Hz) in the 60–180 diagnostic region.
   * Muscle uses lower centers; flat-six stays higher / leaner.
   */
  bodyOrderHz: number[];
  bodyOrderGainDb: number[];
  /** Mechanical bandpass center/Q — 150–600 region. */
  mechanicalCenterHz: number;
  mechanicalQ: number;
  mechanicalGainScale: number;
  /** Exhaust / intake / combustion bus scalars relative to V2 baseline. */
  combustionGainScale: number;
  intakeGainScale: number;
  supportGainScale: number;
  /** High-shelf anti-harshness (2–5 kHz inspection). */
  harshnessShelfHz: number;
  harshnessGainDb: number;
  /** Mild WaveShaper drive 0..1. */
  saturationDrive: number;
  /** DC / rumble high-pass (Hz) — remove inaudible energy that eats headroom. */
  rumbleHpHz: number;
  /** Extra idle irregularity scale (on top of AcousticEngineConfig). */
  idleIrregularityScale: number;
  /** How strongly load opens intake vs exhaust at fixed RPM (0..1). */
  loadBalanceBias: number;
  notes: string;
}

const MUSCLE: RawMechanicalPreset = {
  profileId: "american-muscle-v8",
  seed: 0x4d55534c, // "MUSL"
  quality: "high",
  // Deep cross-plane body — not a disconnected sub sine.
  bodyOrderHz: [72, 118, 165],
  bodyOrderGainDb: [5.5, 3.8, 2.2],
  mechanicalCenterHz: 280,
  mechanicalQ: 1.05,
  mechanicalGainScale: 0.85,
  combustionGainScale: 1.18,
  intakeGainScale: 0.78,
  supportGainScale: 1.12,
  harshnessShelfHz: 3200,
  harshnessGainDb: -3.2,
  saturationDrive: 0.42,
  rumbleHpHz: 38,
  idleIrregularityScale: 1.15,
  loadBalanceBias: 0.72,
  notes:
    "Lope-forward exhaust body; restrained intake; load opens exhaust pulse pressure more than pitch.",
};

const FLAT_SIX: RawMechanicalPreset = {
  profileId: "flat-six-sport",
  seed: 0x46365358, // "F6SX"
  quality: "high",
  // Leaner, higher body centers — contrast to muscle rumble, not the same shelf.
  bodyOrderHz: [95, 145, 195],
  bodyOrderGainDb: [2.4, 3.6, 2.8],
  mechanicalCenterHz: 420,
  mechanicalQ: 1.35,
  mechanicalGainScale: 1.35,
  combustionGainScale: 0.95,
  intakeGainScale: 1.28,
  supportGainScale: 1.05,
  harshnessShelfHz: 3800,
  harshnessGainDb: -2.4,
  saturationDrive: 0.28,
  rumbleHpHz: 48,
  idleIrregularityScale: 0.92,
  loadBalanceBias: 0.38,
  notes:
    "Intake/mechanical-forward flat character; load opens intake stacks and mid orders, not a V8 bass clone.",
};

const BY_ID: Record<RawMechanicalPilotId, RawMechanicalPreset> = {
  "american-muscle-v8": MUSCLE,
  "flat-six-sport": FLAT_SIX,
};

export function rawMechanicalPresetFor(
  profileId: string,
  quality: RawMechanicalQualityTier = "high",
): RawMechanicalPreset | null {
  if (!isRawMechanicalPilotId(profileId)) return null;
  const base = BY_ID[profileId];
  if (quality === "high") return { ...base };
  // Low-cost: shorter lists, milder saturation, simpler mechanical.
  return {
    ...base,
    quality: "low-cost",
    bodyOrderHz: base.bodyOrderHz.slice(0, 2),
    bodyOrderGainDb: base.bodyOrderGainDb.slice(0, 2),
    saturationDrive: Math.min(0.22, base.saturationDrive),
    mechanicalGainScale: base.mechanicalGainScale * 0.85,
  };
}

/** Reusable foundation for future pilots — clone + override, never copy muscle bass. */
export function extendRawMechanicalPreset(
  foundation: RawMechanicalPreset,
  overrides: Partial<RawMechanicalPreset> & { profileId: RawMechanicalPilotId },
): RawMechanicalPreset {
  return { ...foundation, ...overrides };
}
