import { describe, expect, it } from "vitest";

import { entitlementsForPlan } from "@/lib/entitlements/plans";
import { canDriveProfileWithAccess } from "@/lib/entitlements/drive-profile-access";
import type { Entitlement } from "@/lib/entitlements/types";

function hasFromPlan(plan: "FREE" | "DRIVE_PLUS") {
  const set = new Set(entitlementsForPlan(plan));
  return (e: Entitlement) => set.has(e);
}

describe("canDriveProfileWithAccess", () => {
  it("allows free trio without all_sound_profiles", () => {
    expect(
      canDriveProfileWithAccess({
        profileId: "american-muscle-v8",
        hasAllSoundProfiles: false,
        grantedProfileIds: [],
        hasEntitlement: hasFromPlan("FREE"),
      }),
    ).toBe(true);
  });

  it("allows FREE symphony_essential / worlds_sampler experiences only", () => {
    expect(
      canDriveProfileWithAccess({
        profileId: "symphony-cinematic-rock",
        hasAllSoundProfiles: false,
        grantedProfileIds: [],
        hasEntitlement: hasFromPlan("FREE"),
      }),
    ).toBe(true);
    expect(
      canDriveProfileWithAccess({
        profileId: "symphony-neon-run",
        hasAllSoundProfiles: false,
        grantedProfileIds: [],
        hasEntitlement: hasFromPlan("FREE"),
      }),
    ).toBe(false);
    expect(
      canDriveProfileWithAccess({
        profileId: "fusion-road-anthem",
        hasAllSoundProfiles: false,
        grantedProfileIds: [],
        hasEntitlement: hasFromPlan("FREE"),
      }),
    ).toBe(false);
  });

  it("allows Drive+ fusion and premium symphony", () => {
    expect(
      canDriveProfileWithAccess({
        profileId: "fusion-road-anthem",
        hasAllSoundProfiles: false,
        grantedProfileIds: [],
        hasEntitlement: hasFromPlan("DRIVE_PLUS"),
      }),
    ).toBe(true);
    expect(
      canDriveProfileWithAccess({
        profileId: "symphony-neon-run",
        hasAllSoundProfiles: false,
        grantedProfileIds: [],
        hasEntitlement: hasFromPlan("DRIVE_PLUS"),
      }),
    ).toBe(true);
  });
});
