import { describe, expect, it } from "vitest";

import {
  buildSubscriptionSummary,
  buildTrialBillingState,
} from "@/lib/billing/subscription-summary";
import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";

const NOW = Date.parse("2026-08-15T12:00:00.000Z");

const trialSnapshot = (
  overrides: Partial<DynamicDriveTrialSnapshot>,
): DynamicDriveTrialSnapshot => ({
  userId: "user_1",
  status: "available",
  startedAt: null,
  expiresAt: null,
  allocatedSeconds: 1800,
  usedSeconds: 0,
  remainingSeconds: 1800,
  allocatedSessions: 3,
  usedSessions: 0,
  remainingSessions: 3,
  canStartPreview: true,
  canUseDynamicDrive: false,
  activeDriveSessionId: null,
  ...overrides,
});

describe("buildSubscriptionSummary", () => {
  it("returns Free when there is no subscription", () => {
    expect(buildSubscriptionSummary(null, false, NOW)).toEqual({
      planLabel: "Free",
      intervalLabel: null,
      statusHeadline: null,
      statusDetail: null,
      actionHint: null,
      canManageSubscription: false,
      canUpgrade: true,
      trial: null,
    });
  });

  it("describes active monthly Drive+ with renewal date", () => {
    const summary = buildSubscriptionSummary(
      {
        userId: "user_1",
        plan: "DRIVE_PLUS",
        status: "active",
        interval: "month",
        currentPeriodEnd: new Date("2026-09-15T12:00:00.000Z"),
      },
      true,
      NOW,
      "en-US",
    );

    expect(summary.planLabel).toBe("Drive+");
    expect(summary.intervalLabel).toBe("Monthly");
    expect(summary.statusHeadline).toBe("Active");
    expect(summary.statusDetail).toMatch(/^Renews Sep 15, 2026$/);
    expect(summary.actionHint).toBeNull();
    expect(summary.canManageSubscription).toBe(true);
    expect(summary.canUpgrade).toBe(false);
  });

  it("describes annual Drive+ scheduled to cancel at period end", () => {
    const summary = buildSubscriptionSummary(
      {
        userId: "user_1",
        plan: "DRIVE_PLUS",
        status: "active",
        interval: "year",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
      },
      true,
      NOW,
      "en-US",
    );

    expect(summary.intervalLabel).toBe("Annual");
    expect(summary.statusHeadline).toBe("Ending soon");
    expect(summary.statusDetail).toBe("Available until Jan 1, 2027");
  });

  it("shows payment issue copy during past_due grace", () => {
    const summary = buildSubscriptionSummary(
      {
        userId: "user_1",
        plan: "DRIVE_PLUS",
        status: "past_due",
        interval: "month",
        pastDueSince: new Date("2026-08-10T12:00:00.000Z"),
      },
      true,
      NOW,
      "en-US",
    );

    expect(summary.planLabel).toBe("Drive+");
    expect(summary.statusHeadline).toBe("Payment issue");
    expect(summary.actionHint).toBe("Update payment in plan settings");
    expect(summary.statusDetail).toMatch(/^Access until /);
  });

  it("returns Free after access ends", () => {
    const summary = buildSubscriptionSummary(
      {
        userId: "user_1",
        plan: "DRIVE_PLUS",
        status: "canceled",
        interval: "month",
      },
      true,
      NOW,
    );

    expect(summary.planLabel).toBe("Free");
    expect(summary.canUpgrade).toBe(true);
  });
});

describe("buildTrialBillingState", () => {
  it("shows preview availability on Free", () => {
    expect(buildTrialBillingState(trialSnapshot({ status: "available" }), false)).toEqual({
      label: "Dynamic Drive preview",
      detail: "30 min · up to 3 drives · no card",
    });
  });

  it("hides preview when Drive+ is active", () => {
    expect(
      buildTrialBillingState(
        trialSnapshot({ status: "active", canUseDynamicDrive: true, remainingSeconds: 900 }),
        true,
      ),
    ).toBeNull();
  });
});
