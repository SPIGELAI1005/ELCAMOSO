import { CORE_SOUND_PROFILE_IDS } from "@/lib/sound/profile-specs/core-ids";
import { buildAcousticProfileSpec } from "@/lib/sound/profile-specs/build";
import type { AcousticProfileSpec } from "@/lib/sound/profile-specs/types";
import { validateAcousticProfileSpec } from "@/lib/sound/profile-specs/validate";

export type { AcousticProfileSpec, AcousticFamilyMismatch } from "@/lib/sound/profile-specs/types";
export {
  packageFamilyForProfile,
  familyMismatchForProfile,
  mismatchedPackageFamilyIds,
  PACKAGE_FAMILY_OVERRIDES,
} from "@/lib/sound/profile-specs/package-family";
export { CORE_SOUND_PROFILE_IDS, isCoreSoundProfileId } from "@/lib/sound/profile-specs/core-ids";
export { validateAcousticProfileSpec } from "@/lib/sound/profile-specs/validate";

const cache = new Map<string, AcousticProfileSpec>();

function fallbackSpec(id: string): AcousticProfileSpec {
  return validateAcousticProfileSpec(buildAcousticProfileSpec(id));
}

/**
 * Resolve typed acoustic metadata for a Sound Profile id.
 * Does not alter audible routing: consumers of familyForProfile / strategies are unchanged.
 * Unknown ids receive a validated safe fallback; family still mirrors familyForProfile().
 */
export function getAcousticProfileSpec(id: string): AcousticProfileSpec {
  const key = id || "unknown";
  const hit = cache.get(key);
  if (hit) return hit;
  const spec = fallbackSpec(key);
  cache.set(key, spec);
  return spec;
}

/** All 47 core Sound Profile specs (validated). */
export function allCoreAcousticProfileSpecs(): AcousticProfileSpec[] {
  return CORE_SOUND_PROFILE_IDS.map((id) => getAcousticProfileSpec(id));
}

/** Test helper: drop memoized specs after intentional catalog changes in tests. */
export function clearAcousticProfileSpecCache(): void {
  cache.clear();
}
