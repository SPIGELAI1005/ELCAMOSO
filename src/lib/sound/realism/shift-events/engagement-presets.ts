import { getAcousticProfileSpec } from "@/lib/sound/profile-specs";
import type { ShiftEngagementPreset, ShiftEngagementStyle } from "@/lib/sound/realism/shift-events/types";

const NONE: ShiftEngagementPreset = {
  style: "none",
  allowMechanicalTransient: false,
  allowRevBlip: false,
  allowLiftOffPop: false,
  allowOverrun: false,
  thumpFilterHz: 160,
  thumpDecayMs: 120,
  thumpIntensity: 0,
  shiftFilterHz: 700,
  shiftDecayMs: 100,
  shiftIntensity: 0,
  recoveryBarkScale: 0,
  torqueCutEnvelope: 0,
  notes: "No forced clacks — gearless / continuous / accents disabled.",
};

const MUSCLE: ShiftEngagementPreset = {
  style: "muscle-heavy",
  allowMechanicalTransient: true,
  allowRevBlip: true,
  allowLiftOffPop: true,
  allowOverrun: true,
  thumpFilterHz: 155,
  thumpDecayMs: 220,
  thumpIntensity: 0.58,
  shiftFilterHz: 620,
  shiftDecayMs: 210,
  shiftIntensity: 0.7,
  recoveryBarkScale: 0.22,
  torqueCutEnvelope: 0.55,
  notes: "Muted heavy engagement — low-mid thump, no piercing click.",
};

const SPORTS: ShiftEngagementPreset = {
  style: "sports-precise",
  allowMechanicalTransient: true,
  allowRevBlip: true,
  allowLiftOffPop: false,
  allowOverrun: true,
  thumpFilterHz: 210,
  thumpDecayMs: 140,
  thumpIntensity: 0.48,
  shiftFilterHz: 880,
  shiftDecayMs: 130,
  shiftIntensity: 0.78,
  recoveryBarkScale: 0.16,
  torqueCutEnvelope: 0.42,
  notes: "Short precise engagement — compact body, restrained highs.",
};

const RESTRAINED: ShiftEngagementPreset = {
  style: "restrained",
  allowMechanicalTransient: true,
  allowRevBlip: true,
  allowLiftOffPop: false,
  allowOverrun: true,
  thumpFilterHz: 175,
  thumpDecayMs: 170,
  thumpIntensity: 0.42,
  shiftFilterHz: 760,
  shiftDecayMs: 160,
  shiftIntensity: 0.62,
  recoveryBarkScale: 0.14,
  torqueCutEnvelope: 0.38,
  notes: "Road GT restraint — soft engagement under procedural body.",
};

/** Explicit Sound Profile id → engagement (catalog IDs only). */
const BY_PROFILE: Record<string, ShiftEngagementPreset> = {
  "american-muscle-v8": MUSCLE,
  "big-twin": { ...MUSCLE, allowLiftOffPop: false, thumpIntensity: 0.52, notes: "Cruiser heavy thump; no pop spray." },
  "flat-six-sport": SPORTS,
  "race-car": { ...SPORTS, shiftFilterHz: 960, shiftDecayMs: 110, notes: "Track precise engagement." },
  "racing-v10": { ...SPORTS, thumpFilterHz: 230, allowLiftOffPop: false },
  "motorcycle-superbike": {
    ...SPORTS,
    thumpFilterHz: 260,
    thumpDecayMs: 110,
    shiftIntensity: 0.7,
    notes: "Quick gearbox nibble — short, not a car clack.",
  },
  "gt-v8": RESTRAINED,
  "turbo-inline-6": { ...RESTRAINED, allowOverrun: true, allowLiftOffPop: false },
  "rally-car": {
    ...SPORTS,
    allowLiftOffPop: true,
    thumpFilterHz: 200,
    notes: "Rally engagement with gated lift-off only when load history allows.",
  },
};

export function shiftEngagementStyleForProfile(profileId: string): ShiftEngagementStyle {
  return shiftEngagementForProfile(profileId).style;
}

/**
 * Resolve engagement preset. Gearless / accents-disabled recipes force `none`
 * even if a combustion id somehow reaches the hybrid path.
 */
export function shiftEngagementForProfile(profileId: string): ShiftEngagementPreset {
  try {
    const spec = getAcousticProfileSpec(profileId);
    const vt = spec.recipe?.virtualTransmission;
    if (vt && (!vt.enabled || !vt.allowCombustionShiftAccents)) {
      return { ...NONE, notes: `${NONE.notes} (recipe accents off)` };
    }
  } catch {
    /* unknown id → fall through */
  }
  return BY_PROFILE[profileId] ?? RESTRAINED;
}

export function listShiftEngagementMatrixRows(): Array<{
  profileId: string;
  style: ShiftEngagementStyle;
  allowMechanicalTransient: boolean;
  allowRevBlip: boolean;
  allowLiftOffPop: boolean;
  allowOverrun: boolean;
}> {
  return Object.entries(BY_PROFILE).map(([profileId, preset]) => ({
    profileId,
    style: preset.style,
    allowMechanicalTransient: preset.allowMechanicalTransient,
    allowRevBlip: preset.allowRevBlip,
    allowLiftOffPop: preset.allowLiftOffPop,
    allowOverrun: preset.allowOverrun,
  }));
}
