import { describe, expect, it } from "vitest";

import {
  evaluateSubscriptionAccess,
  hasDrivePlusSubscriptionAccess,
} from "@/lib/billing/subscription-access-policy";

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const config = { pastDueGraceMs: GRACE_MS };

describe("subscription access policy", () => {
  it("grants Drive+ for active and trialing subscriptions", () => {
    expect(
      hasDrivePlusSubscriptionAccess({ plan: "DRIVE_PLUS", status: "active" }, Date.now(), config),
    ).toBe(true);
    expect(
      hasDrivePlusSubscriptionAccess(
        { plan: "DRIVE_PLUS", status: "trialing" },
        Date.now(),
        config,
      ),
    ).toBe(true);
  });

  it("grants Drive+ during past_due grace period", () => {
    const now = Date.UTC(2026, 0, 15);
    const decision = evaluateSubscriptionAccess(
      {
        plan: "DRIVE_PLUS",
        status: "past_due",
        pastDueSince: new Date(now - 2 * 24 * 60 * 60 * 1000),
      },
      now,
      config,
    );
    expect(decision.hasDrivePlusAccess).toBe(true);
    expect(decision.reason).toBe("past_due_grace");
  });

  it("revokes Drive+ after past_due grace expires", () => {
    const now = Date.UTC(2026, 0, 15);
    const decision = evaluateSubscriptionAccess(
      {
        plan: "DRIVE_PLUS",
        status: "past_due",
        pastDueSince: new Date(now - GRACE_MS - 1),
      },
      now,
      config,
    );
    expect(decision.hasDrivePlusAccess).toBe(false);
    expect(decision.reason).toBe("past_due_grace_expired");
  });

  it("keeps Drive+ until currentPeriodEnd when cancelAtPeriodEnd is true", () => {
    const now = Date.UTC(2026, 0, 10);
    const periodEnd = new Date(Date.UTC(2026, 0, 20));
    expect(
      evaluateSubscriptionAccess(
        {
          plan: "DRIVE_PLUS",
          status: "active",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: periodEnd,
        },
        now,
        config,
      ).hasDrivePlusAccess,
    ).toBe(true);

    expect(
      evaluateSubscriptionAccess(
        {
          plan: "DRIVE_PLUS",
          status: "canceled",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: periodEnd,
        },
        now,
        config,
      ).hasDrivePlusAccess,
    ).toBe(true);

    expect(
      evaluateSubscriptionAccess(
        {
          plan: "DRIVE_PLUS",
          status: "canceled",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(Date.UTC(2026, 0, 5)),
        },
        now,
        config,
      ).hasDrivePlusAccess,
    ).toBe(false);
  });

  it("returns FREE entitlements for canceled or expired subscriptions", () => {
    expect(
      hasDrivePlusSubscriptionAccess(
        { plan: "DRIVE_PLUS", status: "canceled" },
        Date.now(),
        config,
      ),
    ).toBe(false);
    expect(
      hasDrivePlusSubscriptionAccess({ plan: "FREE", status: "free" }, Date.now(), config),
    ).toBe(false);
  });
});
