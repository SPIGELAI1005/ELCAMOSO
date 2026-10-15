import { beforeEach, describe, expect, it } from "vitest";

import {
  resolveCapabilityAccess,
  resolveEffectiveEntitlements,
  resolveProfileDriveAccess,
} from "@/lib/entitlements/access-resolver";
import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import {
  resetEntitlementGrantsForTests,
  seedGrandfatheredProfileGrant,
  upsertEntitlementGrant,
} from "@/lib/entitlements/grants";
import {
  beginOfflineAccessLease,
  invalidateOfflineLeaseOnAccountSwitch,
  isOfflineAccessLeaseValid,
  OFFLINE_LEASE_EXPIRY_POLICY,
  resetOfflineLeaseForTests,
  resolveOfflineLeaseExpiryAction,
} from "@/lib/entitlements/offline-lease";
import { FREE_SOUND_PROFILE_IDS } from "@/lib/sound/profile-access-config";
import type { EntitlementUser } from "@/lib/entitlements/types";

const NOW = Date.parse("2026-10-11T12:00:00.000Z");

function user(partial: Partial<EntitlementUser> = {}): EntitlementUser {
  return { ...DEFAULT_ENTITLEMENT_USER, ...partial };
}

describe("Prompt 11 free trio", () => {
  it("exposes exactly three permanent free profiles with required roles", () => {
    expect(FREE_SOUND_PROFILE_IDS).toHaveLength(3);
    expect(FREE_SOUND_PROFILE_IDS).toEqual([
      "american-muscle-v8",
      "gt-v8",
      "racing-v10",
    ]);
  });
});

describe("resolveProfileDriveAccess", () => {
  beforeEach(() => {
    resetEntitlementGrantsForTests();
    resetOfflineLeaseForTests();
  });

  it("allows permanent free profiles without subscription", () => {
    for (const id of FREE_SOUND_PROFILE_IDS) {
      const decision = resolveProfileDriveAccess(id, { user: user(), now: NOW });
      expect(decision.allowed).toBe(true);
      expect(decision.source).toBe("permanent_free");
    }
  });

  it("denies premium catalog without grant or subscription", () => {
    const decision = resolveProfileDriveAccess("dragon", { user: user(), now: NOW });
    expect(decision.allowed).toBe(false);
    expect(decision.source).toBe("denied");
    expect(decision.fallbackProfileId).toBe("american-muscle-v8");
  });

  it("preserves grandfathered ownership when free set differs", () => {
    seedGrandfatheredProfileGrant("acct-1", "dragon");
    const decision = resolveProfileDriveAccess("dragon", {
      user: user({ accountId: "acct-1", grantedProfileIds: ["dragon"] }),
      grantedProfileIds: ["dragon"],
      grantKindsByProfileId: new Map([["dragon", "grandfathered_grant"]]),
      now: NOW,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe("grandfathered_grant");
  });

  it("honours temporary reward grants until UTC expiry", () => {
    const expires = NOW + 60_000;
    upsertEntitlementGrant({
      accountId: "acct-2",
      kind: "reward_profile",
      profileId: "dragon",
      entitlement: null,
      expiresAt: expires,
      source: "test_reward",
    });
    expect(
      resolveProfileDriveAccess("dragon", {
        user: user({ accountId: "acct-2", grantedProfileIds: ["dragon"] }),
        grantedProfileIds: ["dragon"],
        grantKindsByProfileId: new Map([["dragon", "reward_grant"]]),
        now: NOW,
      }).allowed,
    ).toBe(true);

    // Expired grant list omitted by caller → denied
    expect(
      resolveProfileDriveAccess("dragon", {
        user: user({ accountId: "acct-2", grantedProfileIds: [] }),
        grantedProfileIds: [],
        now: expires + 1,
      }).allowed,
    ).toBe(false);
  });

  it("allows all profiles during active trial", () => {
    const decision = resolveProfileDriveAccess("dragon", {
      user: user({
        trialStatus: "active",
        trialEndsAt: NOW + 120_000,
        trialEntitlements: ["all_sound_profiles"],
      }),
      now: NOW,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe("trial");
    expect(decision.expiresAtUtc).toBe(NOW + 120_000);
  });

  it("allows via past_due grace subscription input", () => {
    const decision = resolveProfileDriveAccess("dragon", {
      user: user({ plan: "DRIVE_PLUS", subscriptionStatus: "past_due" }),
      subscription: {
        plan: "DRIVE_PLUS",
        status: "past_due",
        pastDueSince: new Date(NOW - 2 * 24 * 60 * 60 * 1000),
      },
      now: NOW,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe("past_due_grace");
  });

  it("denies after past_due grace expires", () => {
    const decision = resolveProfileDriveAccess("dragon", {
      user: user({ plan: "DRIVE_PLUS", subscriptionStatus: "past_due" }),
      subscription: {
        plan: "DRIVE_PLUS",
        status: "past_due",
        pastDueSince: new Date(NOW - 10 * 24 * 60 * 60 * 1000),
      },
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
  });
});

describe("resolveCapabilityAccess / effective set", () => {
  it("keeps free-tier capabilities without Drive+", () => {
    expect(resolveCapabilityAccess("basic_drive", { user: user(), now: NOW }).allowed).toBe(true);
    expect(
      resolveCapabilityAccess("virtual_transmission", { user: user(), now: NOW }).allowed,
    ).toBe(true);
    expect(resolveCapabilityAccess("dynamic_drive", { user: user(), now: NOW }).allowed).toBe(
      false,
    );
  });

  it("unions reward entitlement grants", () => {
    const set = resolveEffectiveEntitlements({
      user: user({ grantedEntitlements: ["experience_drops"] }),
      grantedEntitlements: ["experience_drops"],
      now: NOW,
    });
    expect(set.has("experience_drops")).toBe(true);
    expect(set.has("basic_drive")).toBe(true);
  });
});

describe("offline lease", () => {
  beforeEach(() => {
    resetOfflineLeaseForTests();
  });

  it("expires and recommends fade_to_free", () => {
    beginOfflineAccessLease({
      accountId: "acct-a",
      entitlements: ["all_sound_profiles"],
      now: NOW,
      maxMs: 1_000,
    });
    expect(isOfflineAccessLeaseValid(NOW + 500, "acct-a")).toBe(true);
    expect(isOfflineAccessLeaseValid(NOW + 2_000, "acct-a")).toBe(false);
    const action = resolveOfflineLeaseExpiryAction(NOW + 2_000, "acct-a");
    expect(action.expired).toBe(true);
    expect(action.policy).toBe(OFFLINE_LEASE_EXPIRY_POLICY);
    expect(action.fallbackProfileId).toBe("american-muscle-v8");
  });

  it("invalidates prior-user lease on account switch", () => {
    beginOfflineAccessLease({
      accountId: "acct-a",
      entitlements: ["all_sound_profiles"],
      now: NOW,
    });
    invalidateOfflineLeaseOnAccountSwitch("acct-b");
    expect(isOfflineAccessLeaseValid(NOW + 10, "acct-a")).toBe(false);
  });

  it("does not treat lease as unlimited rights after expiry", () => {
    beginOfflineAccessLease({
      accountId: "acct-a",
      entitlements: ["all_sound_profiles"],
      grantedProfileIds: ["dragon"],
      now: NOW,
      maxMs: 100,
    });
    const decision = resolveProfileDriveAccess("dragon", {
      user: user({ accountId: "acct-a" }),
      leaseEntitlements: ["all_sound_profiles"],
      leaseProfileIds: ["dragon"],
      leaseAccountId: "acct-a",
      leaseExpiresAtUtc: NOW + 100,
      now: NOW + 1_000,
    });
    expect(decision.allowed).toBe(false);
  });
});
