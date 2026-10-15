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

  it("ignores access:free outside the free trio (no Symphony/World/Fusion bypass)", () => {
    expect(
      resolveProfileAccess({ id: "symphony-cinematic-rock", access: "free" }),
    ).toBe("drive_plus");
    expect(resolveProfileAccess({ id: "world-cyber-city", access: "free" })).toBe("drive_plus");
    expect(resolveProfileAccess({ id: "fusion-road-anthem", access: "free" })).toBe("drive_plus");
    expect(canDriveWithSoundProfile(getProfile("symphony-cinematic-rock"), false)).toBe(false);
  });

  it("keeps the free trio free even if a profile field says drive_plus", () => {
    expect(
      resolveProfileAccess({ id: "american-muscle-v8", access: "drive_plus" }),
    ).toBe("free");
    const overridden = applyResolvedAccessToProfiles([
      { ...getProfile("american-muscle-v8"), access: "drive_plus" },
      ...SOUND_PROFILES.filter((p) => p.id !== "american-muscle-v8"),
    ]);
    expect(overridden.find((p) => p.id === "american-muscle-v8")!.access).toBe("free");
  });

  it("limits locked profile previews to a short window", () => {
    expect(lockedProfilePreviewSeconds(getProfile("dragon"), false)).toBe(20);
    expect(lockedProfilePreviewSeconds(getProfile("american-muscle-v8"), false)).toBeNull();
    expect(lockedProfilePreviewSeconds(getProfile("gt-v8"), false)).toBeNull();
    expect(lockedProfilePreviewSeconds(getProfile("racing-v10"), false)).toBeNull();
    expect(lockedProfilePreviewSeconds(getProfile("flat-six-sport"), false)).toBe(20);
    expect(lockedProfilePreviewSeconds(getProfile("cyber-pulse"), false)).toBe(20);
    expect(lockedProfilePreviewSeconds(getProfile("dragon"), true)).toBeNull();
  });

  it("allows granted premium profiles without all_sound_profiles", () => {
    expect(canDriveWithSoundProfile(getProfile("dragon"), false, undefined, ["dragon"])).toBe(true);
  });

  it("assigns resolved access on every built-in profile", () => {
    for (const profile of SOUND_PROFILES) {
      expect(profile.access).toMatch(/^(free|drive_plus)$/);
    }
  });
});
