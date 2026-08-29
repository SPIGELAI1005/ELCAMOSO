import { beforeEach, describe, expect, it } from "vitest";

import { resetAccountAuthStoreForTests, saveAccountSession } from "@/lib/account/session-store";
import { setSubscriptionForUser } from "@/lib/billing/subscription-store";
import {
  memoryDynamicDriveTrialRepository,
  resetDynamicDriveTrialStoreForTests,
} from "@/lib/dynamic-drive-trial/repository-memory";
import {
  DynamicDriveTrialService,
  resetDynamicDriveTrialServiceForTests,
} from "@/lib/dynamic-drive-trial/service";
import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import { hasEntitlement } from "@/lib/entitlements/resolve";
import {
  requireEntitlement,
  resolveEntitlementUser,
  trialGrantsDrivePlusEntitlements,
} from "@/lib/entitlements/service";
import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_TOKEN = "session-token";

describe("entitlement service", () => {
  beforeEach(() => {
    resetAccountAuthStoreForTests();
    resetDynamicDriveTrialStoreForTests();
    resetDynamicDriveTrialServiceForTests();
    saveAccountSession({
      token: SESSION_TOKEN,
      userId: USER_ID,
      email: "driver@example.com",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
  });

  it("returns FREE entitlements for anonymous users", async () => {
    const user = await resolveEntitlementUser({ sessionToken: null });
    expect(hasEntitlement(user, "basic_drive")).toBe(true);
    expect(hasEntitlement(user, "dynamic_drive")).toBe(false);
    expect(hasEntitlement(user, "phone_sensor")).toBe(false);
  });

  it("grants DRIVE+ entitlements for active subscription", async () => {
    setSubscriptionForUser({
      userId: USER_ID,
      plan: "DRIVE_PLUS",
      status: "active",
      interval: "month",
    });
    const user = await resolveEntitlementUser({ sessionToken: SESSION_TOKEN });
    expect(user.plan).toBe("DRIVE_PLUS");
    expect(hasEntitlement(user, "dynamic_drive")).toBe(true);
    expect(hasEntitlement(user, "all_sound_profiles")).toBe(true);
  });

  it("grants DRIVE+ entitlements during valid Dynamic Drive preview trial", async () => {
    const service = new DynamicDriveTrialService(memoryDynamicDriveTrialRepository);
    await service.startPreview(USER_ID);
    const user = await resolveEntitlementUser({ sessionToken: SESSION_TOKEN });
    expect(user.trialStatus).toBe("active");
    expect(hasEntitlement(user, "dynamic_drive")).toBe(true);
    expect(hasEntitlement(user, "rev_match")).toBe(true);
    expect(hasEntitlement(user, "phone_sensor")).toBe(true);
  });

  it("denies premium entitlements when trial is exhausted", async () => {
    const snapshot: DynamicDriveTrialSnapshot = {
      userId: USER_ID,
      status: "exhausted",
      startedAt: Date.now() - 86_400_000,
      expiresAt: Date.now() + 86_400_000,
      allocatedSeconds: 1800,
      usedSeconds: 1800,
      remainingSeconds: 0,
      allocatedSessions: 3,
      usedSessions: 3,
      remainingSessions: 0,
      canStartPreview: false,
      canUseDynamicDrive: false,
      activeDriveSessionId: null,
    };
    expect(trialGrantsDrivePlusEntitlements(snapshot)).toBe(false);
  });

  it("denies premium entitlements when trial time is exhausted even if sessions remain", async () => {
    const snapshot: DynamicDriveTrialSnapshot = {
      userId: USER_ID,
      status: "exhausted",
      startedAt: Date.now() - 86_400_000,
      expiresAt: Date.now() + 86_400_000,
      allocatedSeconds: 1800,
      usedSeconds: 1800,
      remainingSeconds: 0,
      allocatedSessions: 3,
      usedSessions: 1,
      remainingSessions: 2,
      canStartPreview: false,
      canUseDynamicDrive: false,
      activeDriveSessionId: null,
    };
    expect(trialGrantsDrivePlusEntitlements(snapshot)).toBe(false);
  });

  it("requireEntitlement throws for denied access", async () => {
    await expect(
      requireEntitlement({ sessionToken: null, entitlement: "phone_sensor" }),
    ).rejects.toThrow(/Entitlement required/);
  });

  it("requireEntitlement passes for subscribed users", async () => {
    setSubscriptionForUser({
      userId: USER_ID,
      plan: "DRIVE_PLUS",
      status: "active",
      interval: "month",
    });
    const user = await requireEntitlement({
      sessionToken: SESSION_TOKEN,
      entitlement: "phone_sensor",
    });
    expect(user.plan).toBe("DRIVE_PLUS");
  });

  it("grants DRIVE+ during past_due grace per access policy", async () => {
    setSubscriptionForUser({
      userId: USER_ID,
      plan: "DRIVE_PLUS",
      status: "past_due",
      interval: "month",
      pastDueSince: new Date(),
    });
    const user = await resolveEntitlementUser({ sessionToken: SESSION_TOKEN });
    expect(user.plan).toBe("DRIVE_PLUS");
    expect(hasEntitlement(user, "dynamic_drive")).toBe(true);
  });

  it("denies DRIVE+ when past_due grace has expired", async () => {
    setSubscriptionForUser({
      userId: USER_ID,
      plan: "DRIVE_PLUS",
      status: "past_due",
      interval: "month",
      pastDueSince: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });
    const user = await resolveEntitlementUser({ sessionToken: SESSION_TOKEN });
    expect(user.plan).toBe("FREE");
    expect(hasEntitlement(user, "dynamic_drive")).toBe(false);
  });

  it("anonymous default matches DEFAULT_ENTITLEMENT_USER shape", async () => {
    const user = await resolveEntitlementUser({});
    expect(user.plan).toBe(DEFAULT_ENTITLEMENT_USER.plan);
    expect(user.accountId).toBeNull();
  });
});
