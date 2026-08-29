import { describe, expect, it } from "vitest";

import {
  FREE_SOUND_PROFILE_IDS,
  FALLBACK_SOUND_PROFILE_ID,
  isEssentialSoundProfile,
  isSoundProfileEntitled,
  isSoundProfilePreviewAllowed,
} from "@/lib/entitlements/catalog";

describe("sound profile catalog entitlements", () => {
  it("marks configurable free profiles as drive-ready on free tier", () => {
    for (const id of FREE_SOUND_PROFILE_IDS) {
      expect(isEssentialSoundProfile(id)).toBe(true);
      expect(isSoundProfileEntitled(id, false)).toBe(true);
    }
  });

  it("locks drive_plus profiles without all_sound_profiles", () => {
    expect(isSoundProfileEntitled("dragon", false)).toBe(false);
    expect(isSoundProfileEntitled("dragon", true)).toBe(true);
  });

  it("allows preview for premium profiles without entitlement", () => {
    expect(isSoundProfilePreviewAllowed("dragon")).toBe(true);
  });

  it("uses a stable fallback profile id", () => {
    expect(FALLBACK_SOUND_PROFILE_ID).toBe("gt-v8");
  });
});
