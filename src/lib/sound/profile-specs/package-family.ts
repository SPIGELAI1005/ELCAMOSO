import type { ProfileFamily } from "@/lib/sound/realism/families";
import { familyForProfile } from "@/lib/sound/realism/families";
import type { AcousticFamilyMismatch } from "@/lib/sound/profile-specs/types";

/**
 * Package INDEX / per-profile Markdown "Technical family" labels.
 * Only entries that differ from runtime familyForProfile() are listed.
 * See docs/FAMILY_CLASSIFICATION_MISMATCHES.md.
 */
export const PACKAGE_FAMILY_OVERRIDES: Readonly<Record<string, ProfileFamily>> = {
  "neon-drive": "musical",
  dragon: "environmental",
  "thunder-beast": "environmental",
};

const DEFERRED_REASON =
  "Changing familyForProfile would alter motionFromDrive speed/throttle taus, RPM/fundamental path, and bodyLevel mixes; not metadata-only. Deferred to a sound-improvement prompt.";

const DOCUMENTATION = "docs/FAMILY_CLASSIFICATION_MISMATCHES.md";

/** Package design-intent family (INDEX/Markdown). Falls back to runtime when aligned. */
export function packageFamilyForProfile(profileId: string): ProfileFamily {
  return PACKAGE_FAMILY_OVERRIDES[profileId] ?? familyForProfile(profileId);
}

export function familyMismatchForProfile(profileId: string): AcousticFamilyMismatch | null {
  const runtimeFamily = familyForProfile(profileId);
  const packageFamily = packageFamilyForProfile(profileId);
  if (runtimeFamily === packageFamily) return null;
  return {
    runtimeFamily,
    packageFamily,
    deferredReason: DEFERRED_REASON,
    documentation: DOCUMENTATION,
  };
}

export function mismatchedPackageFamilyIds(): string[] {
  return Object.keys(PACKAGE_FAMILY_OVERRIDES);
}
