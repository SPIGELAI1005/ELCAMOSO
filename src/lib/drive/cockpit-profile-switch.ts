/**
 * Latest-wins Drive profile selection shared by Settings and the Drive Cockpit.
 * Entitlement gating happens before apply; locked choices never start premium playback.
 */

export type ProfileSwitchOutcome =
  | "applied"
  | "locked"
  | "same"
  | "stale"
  | "failed";

export interface ProfileSwitchController {
  /** Monotonic generation; bump on every user selection. */
  readonly generation: number;
  request(profileId: string): number;
  isCurrent(generation: number): boolean;
  cancel(): void;
}

/** Pure generation tracker for rapid favourite taps. */
export function createProfileSwitchController(): ProfileSwitchController {
  let generation = 0;
  return {
    get generation() {
      return generation;
    },
    request(_profileId: string) {
      generation += 1;
      return generation;
    },
    isCurrent(gen: number) {
      return gen === generation;
    },
    cancel() {
      generation += 1;
    },
  };
}

/**
 * Apply a Drive profile change when entitled. Cancels stale work when a newer
 * selection supersedes this generation before apply completes.
 */
export async function applyCockpitProfileSwitch(input: {
  profileId: string;
  activeProfileId: string;
  generation: number;
  isCurrent: (generation: number) => boolean;
  canDriveWithProfile: (profileId: string) => boolean;
  apply: (profileId: string) => void | Promise<void>;
}): Promise<ProfileSwitchOutcome> {
  const { profileId, activeProfileId, generation, isCurrent, canDriveWithProfile, apply } =
    input;

  if (!canDriveWithProfile(profileId)) return "locked";
  if (profileId === activeProfileId) return "same";
  if (!isCurrent(generation)) return "stale";

  try {
    await apply(profileId);
  } catch {
    return "failed";
  }

  if (!isCurrent(generation)) return "stale";
  return "applied";
}

/** Keep favourite slot ids even when Drive access expires (buttons stay, playback blocked). */
export function favouriteSlotAccess(
  profileId: string,
  canDriveWithProfile: (profileId: string) => boolean,
): "ready" | "locked" {
  return canDriveWithProfile(profileId) ? "ready" : "locked";
}
