import { describe, expect, it } from "vitest";

import {
  FREE_SOUND_PROFILE_IDS,
  applyResolvedAccessToProfiles,
  canDriveWithSoundProfile,
  lockedProfilePreviewSeconds,
  resolveProfileAccess,
} from "@/lib/sound/profile-access";
import { SOUND_PROFILES, getProfile } from "@/lib/sound/profiles";

describe("sound profile access", () => {
  it("resolves free tier from configurable ids", () => {
    for (const id of FREE_SOUND_PROFILE_IDS) {
      expect(resolveProfileAccess(getProfile(id))).toBe("free");
      expect(canDriveWithSoundProfile(getProfile(id), false)).toBe(true);
    }
  });

  it("defaults built-ins outside the free list to drive_plus", () => {
    expect(resolveProfileAccess(getProfile("dragon"))).toBe("drive_plus");
    expect(canDriveWithSoundProfile(getProfile("dragon"), false)).toBe(false);
    expect(canDriveWithSoundProfile(getProfile("dragon"), true)).toBe(true);
  });

  it("honours explicit access overrides on profiles", () => {
    const [first, ...rest] = SOUND_PROFILES;
    const overridden = applyResolvedAccessToProfiles([
      { ...first!, access: "drive_plus" },
      ...rest,
    ]);
    expect(overridden[0]!.access).toBe("drive_plus");
  });

  it("limits locked profile previews to a short window", () => {
    expect(lockedProfilePreviewSeconds(getProfile("dragon"), false)).toBe(20);
    expect(lockedProfilePreviewSeconds(getProfile("gt-v8"), false)).toBeNull();
    expect(lockedProfilePreviewSeconds(getProfile("dragon"), true)).toBeNull();
  });

  it("assigns resolved access on every built-in profile", () => {
    for (const profile of SOUND_PROFILES) {
      expect(profile.access).toMatch(/^(free|drive_plus)$/);
    }
  });
});
