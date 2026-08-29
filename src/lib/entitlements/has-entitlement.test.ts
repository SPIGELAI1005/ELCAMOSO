import { describe, expect, it } from "vitest";

import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import {
  ALL_ENTITLEMENTS,
  PREMIUM_ENTITLEMENTS,
  TRIAL_DRIVE_PLUS_ENTITLEMENTS,
} from "@/lib/entitlements/plans";
import {
  buildEntitlementSnapshot,
  hasEntitlement,
  resolveEntitlements,
} from "@/lib/entitlements/resolve";
import { effectiveTrialStatus, isTrialActive } from "@/lib/entitlements/trial";
import type { EntitlementUser } from "@/lib/entitlements/types";

const NOW = 1_700_000_000_000;

describe("hasEntitlement", () => {
  it("grants FREE basics to default user", () => {
    expect(hasEntitlement(DEFAULT_ENTITLEMENT_USER, "basic_drive")).toBe(true);
    expect(hasEntitlement(DEFAULT_ENTITLEMENT_USER, "basic_sound_profiles")).toBe(true);
    expect(hasEntitlement(DEFAULT_ENTITLEMENT_USER, "dynamic_drive")).toBe(false);
  });

  it("grants all entitlements for DRIVE_PLUS", () => {
    const user: EntitlementUser = {
      ...DEFAULT_ENTITLEMENT_USER,
      plan: "DRIVE_PLUS",
      subscriptionStatus: "active",
    };
    for (const entitlement of ALL_ENTITLEMENTS) {
      expect(hasEntitlement(user, entitlement)).toBe(true);
    }
  });

  it("never references billing provider — plan field drives access", () => {
    const user: EntitlementUser = {
      accountId: "acct_1",
      plan: "DRIVE_PLUS",
      subscriptionStatus: "canceled",
      trialStatus: "none",
    };
    expect(hasEntitlement(user, "dynamic_drive")).toBe(true);
  });

  it("merges trial entitlements onto FREE plan", () => {
    const user: EntitlementUser = {
      ...DEFAULT_ENTITLEMENT_USER,
      trialStatus: "active",
      trialEndsAt: NOW + 86_400_000,
      trialEntitlements: TRIAL_DRIVE_PLUS_ENTITLEMENTS,
    };
    expect(hasEntitlement(user, "dynamic_drive", NOW)).toBe(true);
    expect(hasEntitlement(user, "vehicle_telemetry", NOW)).toBe(true);
    expect(hasEntitlement(user, "basic_drive", NOW)).toBe(true);
  });

  it("does not grant trial entitlements after expiry", () => {
    const user: EntitlementUser = {
      ...DEFAULT_ENTITLEMENT_USER,
      trialStatus: "active",
      trialEndsAt: NOW - 1,
      trialEntitlements: TRIAL_DRIVE_PLUS_ENTITLEMENTS,
    };
    expect(isTrialActive(user, NOW)).toBe(false);
    expect(effectiveTrialStatus(user, NOW)).toBe("expired");
    for (const entitlement of PREMIUM_ENTITLEMENTS) {
      expect(hasEntitlement(user, entitlement, NOW)).toBe(false);
    }
  });

  it("resolveEntitlements returns a stable set", () => {
    const user: EntitlementUser = {
      ...DEFAULT_ENTITLEMENT_USER,
      plan: "FREE",
      trialStatus: "active",
      trialEndsAt: NOW + 60_000,
      trialEntitlements: ["dynamic_drive"],
    };
    const set = resolveEntitlements(user, NOW);
    expect(set.has("basic_drive")).toBe(true);
    expect(set.has("dynamic_drive")).toBe(true);
    expect(set.has("rev_match")).toBe(false);
  });

  it("buildEntitlementSnapshot lists sorted entitlements", () => {
    const snapshot = buildEntitlementSnapshot({
      ...DEFAULT_ENTITLEMENT_USER,
      plan: "DRIVE_PLUS",
      subscriptionStatus: "active",
    });
    expect(snapshot.plan).toBe("DRIVE_PLUS");
    expect(snapshot.trialActive).toBe(false);
    expect(snapshot.entitlements).toEqual([...ALL_ENTITLEMENTS].sort());
  });
});
