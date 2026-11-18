/**
 * Profiles that are playable only for signed-in admins (allowlist or role=admin).
 * Same gate as /admin and RUMOSO: requireAdmin / the admin role.
 *
 * Caravan Carriage is in this set while its street-call audio is a TEST ONLY
 * Suno free-plan overlay, not licensed for public use.
 */
import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";

export const ADMIN_ONLY_PROFILE_IDS = ["caravan-carriage"] as const;

const ADMIN_ONLY = new Set<string>(ADMIN_ONLY_PROFILE_IDS);

export function isAdminOnlyProfile(id: string | null | undefined): boolean {
  return typeof id === "string" && ADMIN_ONLY.has(id);
}

/** Built-in catalog shown to logged-out and regular users. */
export function visibleProfileList<T extends { id: string }>(
  profiles: readonly T[],
  isAdmin: boolean,
): T[] {
  return isAdmin ? [...profiles] : profiles.filter((p) => !isAdminOnlyProfile(p.id));
}

/**
 * Profile id that may be shown or played for this user.
 * Admin-only ids fall back to the default (Racing V10) when the user is not an admin.
 * Unknown ids are returned unchanged so existing fallbacks still apply.
 */
export function resolveVisibleProfileId(
  id: string | null | undefined,
  isAdmin: boolean,
  fallback: string = FALLBACK_SOUND_PROFILE_ID,
): string {
  if (!id) return fallback;
  if (isAdminOnlyProfile(id) && !isAdmin) return fallback;
  return id;
}
