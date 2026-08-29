/**
 * Product-configurable FREE Sound Profile ids.
 * Adjust this list to change the free tier without touching UI components.
 */
export const FREE_SOUND_PROFILE_IDS: readonly string[] = [
  "gt-v8",
  "racing-v10",
  "cyber-pulse",
  "zen-drive",
  "open-wind",
] as const;

/** Max seconds for a non-driving preview of a Drive+ profile without entitlement. */
export const LOCKED_PROFILE_PREVIEW_SECONDS = 20;
