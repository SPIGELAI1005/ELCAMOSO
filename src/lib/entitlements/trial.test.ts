import { describe, expect, it } from "vitest";

import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import { effectiveTrialStatus, isTrialActive } from "@/lib/entitlements/trial";
import type { EntitlementUser } from "@/lib/entitlements/types";

const NOW = 1_700_000_000_000;

describe("trial helpers", () => {
  it("isTrialActive is false for none/expired status", () => {
    expect(isTrialActive(DEFAULT_ENTITLEMENT_USER, NOW)).toBe(false);
    expect(isTrialActive({ ...DEFAULT_ENTITLEMENT_USER, trialStatus: "expired" }, NOW)).toBe(false);
  });

  it("isTrialActive respects trialEndsAt", () => {
    const active: EntitlementUser = {
      ...DEFAULT_ENTITLEMENT_USER,
      trialStatus: "active",
      trialEndsAt: NOW + 1,
    };
    const expired: EntitlementUser = {
      ...active,
      trialEndsAt: NOW,
    };
    expect(isTrialActive(active, NOW)).toBe(true);
    expect(isTrialActive(expired, NOW)).toBe(false);
  });

  it("effectiveTrialStatus maps expiry without mutating user", () => {
    const user: EntitlementUser = {
      ...DEFAULT_ENTITLEMENT_USER,
      trialStatus: "active",
      trialEndsAt: NOW - 1,
    };
    expect(effectiveTrialStatus(user, NOW)).toBe("expired");
    expect(user.trialStatus).toBe("active");
  });
});
