import { beforeEach, describe, expect, it } from "vitest";

import { resetAccountAuthStoreForTests, saveAccountSession } from "@/lib/account/session-store";
import { resetDynamicDriveTrialStoreForTests } from "@/lib/dynamic-drive-trial/repository-memory";
import { resetDynamicDriveTrialServiceForTests } from "@/lib/dynamic-drive-trial/service";
import { ALL_ENTITLEMENTS } from "@/lib/entitlements/plans";
import { resolveEntitlementSnapshot, resolveEntitlementUser } from "@/lib/entitlements/service";
import { canDriveWithSoundProfile } from "@/lib/sound/profile-access";

function session(token: string, userId: string, email: string) {
  saveAccountSession({ token, userId, email, expiresAt: Date.now() + 60_000, createdAt: Date.now() });
}

describe("admin sound unlock", () => {
  beforeEach(() => {
    resetAccountAuthStoreForTests();
    resetDynamicDriveTrialStoreForTests();
    resetDynamicDriveTrialServiceForTests();
    session("admin-tok", "22222222-2222-4222-8222-222222222222", "George.M.Neacsu@googlemail.com");
    session("user-tok", "33333333-3333-4333-8333-333333333333", "driver@example.com");
  });

  it("admin gets every entitlement and can drive any profile", async () => {
    const snap = await resolveEntitlementSnapshot({ sessionToken: "admin-tok" });
    for (const e of ALL_ENTITLEMENTS) expect(snap.entitlements).toContain(e);
    const has = snap.entitlements.includes("all_sound_profiles");
    expect(canDriveWithSoundProfile({ id: "space-drive", access: "drive_plus" }, has)).toBe(true);
    const user = await resolveEntitlementUser({ sessionToken: "admin-tok" });
    expect(user.plan).toBe("FREE");
  });

  it("non-admin stays on free list", async () => {
    const snap = await resolveEntitlementSnapshot({ sessionToken: "user-tok" });
    expect(snap.entitlements).not.toContain("all_sound_profiles");
    const has = snap.entitlements.includes("all_sound_profiles");
    expect(canDriveWithSoundProfile({ id: "space-drive", access: "drive_plus" }, has)).toBe(false);
    expect(canDriveWithSoundProfile({ id: "american-muscle-v8" }, has)).toBe(true);
  });

  it("signed-out stays on free list", async () => {
    const snap = await resolveEntitlementSnapshot({ sessionToken: null });
    expect(snap.entitlements).not.toContain("all_sound_profiles");
  });
});
