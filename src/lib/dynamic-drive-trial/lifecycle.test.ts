import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetAccountAuthStoreForTests, saveAccountSession } from "@/lib/account/session-store";
import { provisionEntitlementsFromSubscription } from "@/lib/billing/provision-entitlements";
import { resetSubscriptionStoreForTests } from "@/lib/billing/subscription-store";
import type { Subscription } from "@/lib/billing/types";
import { DYNAMIC_DRIVE_SESSION_STALE_MS } from "@/lib/dynamic-drive-session/config";
import {
  DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS,
  DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS,
  DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS,
} from "@/lib/dynamic-drive-trial/config";
import {
  memoryDynamicDriveTrialRepository,
  resetDynamicDriveTrialStoreForTests,
} from "@/lib/dynamic-drive-trial/repository-memory";
import {
  DynamicDriveTrialSessionConflictError,
  DynamicDriveTrialService,
  getDynamicDriveTrialService,
  resetDynamicDriveTrialServiceForTests,
} from "@/lib/dynamic-drive-trial/service";
import {
  advanceTrialMs,
  assertEntitlementsForTrial,
  assertTrialAllocations,
  assertTrialExpiryWindow,
  assertTrialNeverNegative,
  TRIAL_SESSION_TOKEN,
  TRIAL_TEST_BASE,
  TRIAL_TEST_USER_ID,
} from "@/lib/dynamic-drive-trial/test-fixtures";
import { syncStripeSubscriptionRecord } from "@/lib/billing/stripe/subscription-sync";
import { resetSubscriptionRepositoryStoreForTests } from "@/lib/billing/subscription-repository-memory";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";
import { resolveEntitlementUser } from "@/lib/entitlements/service";
import { hasEntitlement } from "@/lib/entitlements/resolve";

const subscriptionsRetrieve = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    subscriptions: { retrieve: subscriptionsRetrieve, list: vi.fn() },
  }),
  resetStripeClientForTests: vi.fn(),
}));

function baseSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-trial-test",
    userId: TRIAL_TEST_USER_ID,
    provider: "stripe",
    providerCustomerId: "cus_trial_test",
    providerSubscriptionId: "sub_trial_test",
    plan: "DRIVE_PLUS",
    interval: "month",
    status: "active",
    currentPeriodStart: new Date("2026-08-01"),
    currentPeriodEnd: new Date("2026-09-01"),
    cancelAtPeriodEnd: false,
    createdAt: new Date("2026-08-01"),
    updatedAt: new Date("2026-08-01"),
    ...overrides,
  };
}

describe("Dynamic Drive trial lifecycle", () => {
  let service: DynamicDriveTrialService;

  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    resetDynamicDriveTrialStoreForTests();
    resetDynamicDriveTrialServiceForTests();
    resetAccountAuthStoreForTests();
    resetSubscriptionStoreForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetUserBillingRepositoryForTests();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";

    service = getDynamicDriveTrialService();
    saveAccountSession({
      token: TRIAL_SESSION_TOKEN,
      userId: TRIAL_TEST_USER_ID,
      email: "trial@example.com",
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      createdAt: TRIAL_TEST_BASE.getTime(),
    });
    await memoryUserBillingRepository.setStripeCustomerId(TRIAL_TEST_USER_ID, "cus_trial_test");
  });

  async function activateTrial(at = TRIAL_TEST_BASE) {
    return service.startPreview(TRIAL_TEST_USER_ID, at);
  }

  it("new user starts with available trial - no entitlements until activation", async () => {
    const status = await service.getStatus(TRIAL_TEST_USER_ID, TRIAL_TEST_BASE);
    expect(status.status).toBe("available");
    assertTrialAllocations(status);

    await assertEntitlementsForTrial(TRIAL_SESSION_TOKEN, false, TRIAL_TEST_BASE.getTime());
  });

  it("trial starts on explicit preview activation with 14-day expiry", async () => {
    const started = await activateTrial();
    expect(started.status).toBe("active");
    expect(started.startedAt).toBe(TRIAL_TEST_BASE.getTime());
    assertTrialExpiryWindow(started.startedAt!, started.expiresAt!);
    assertTrialNeverNegative(started);

    await assertEntitlementsForTrial(TRIAL_SESSION_TOKEN, true, started.expiresAt! - 86_400_000);
  });

  it("allocates 30 minutes of Dynamic Drive time", async () => {
    const started = await activateTrial();
    expect(started.allocatedSeconds).toBe(DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS);
    expect(started.remainingSeconds).toBe(DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS);
  });

  it("allocates 3 preview sessions", async () => {
    const started = await activateTrial();
    expect(started.allocatedSessions).toBe(DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS);
    expect(started.remainingSessions).toBe(DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS);
  });

  it("time expires after allocated seconds are consumed", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();
    await service.startDriveSession(TRIAL_TEST_USER_ID, driveSessionId, TRIAL_TEST_BASE);

    let at = TRIAL_TEST_BASE;
    const chunkMs = DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS;
    const ticks = Math.ceil(DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS / (chunkMs / 1000)) + 2;

    for (let i = 0; i < ticks; i += 1) {
      at = advanceTrialMs(TRIAL_TEST_BASE, (i + 1) * chunkMs);
      const beat = await service.heartbeat(TRIAL_TEST_USER_ID, driveSessionId, true, at);
      assertTrialNeverNegative(beat.snapshot);
      if (beat.snapshot.remainingSeconds <= 0) break;
    }

    const status = await service.getStatus(TRIAL_TEST_USER_ID, at);
    expect(status.remainingSeconds).toBe(0);
    expect(status.status).toBe("exhausted");

    await service.endDriveSession(TRIAL_TEST_USER_ID, driveSessionId, true, at);
    const afterEnd = await service.getStatus(TRIAL_TEST_USER_ID, at);
    expect(afterEnd.canUseDynamicDrive).toBe(false);
    await assertEntitlementsForTrial(TRIAL_SESSION_TOKEN, false, at.getTime());
  });

  it("session count expires after 3 drives", async () => {
    await activateTrial();

    for (let i = 0; i < DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS; i += 1) {
      const id = randomUUID();
      const at = advanceTrialMs(TRIAL_TEST_BASE, i * 60_000);
      const started = await service.startDriveSession(TRIAL_TEST_USER_ID, id, at);
      assertTrialNeverNegative(started.snapshot);
      await service.endDriveSession(TRIAL_TEST_USER_ID, id, true, advanceTrialMs(at, 1_000));
    }

    const status = await service.getStatus(
      TRIAL_TEST_USER_ID,
      advanceTrialMs(TRIAL_TEST_BASE, 300_000),
    );
    expect(status.remainingSessions).toBe(0);
    expect(status.usedSessions).toBe(DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS);

    await expect(
      service.startDriveSession(
        TRIAL_TEST_USER_ID,
        randomUUID(),
        advanceTrialMs(TRIAL_TEST_BASE, 310_000),
      ),
    ).rejects.toThrow(/sessions exhausted/i);
  });

  it("14-day expiry revokes trial entitlements", async () => {
    await activateTrial(TRIAL_TEST_BASE);
    const expiredAt = advanceTrialMs(TRIAL_TEST_BASE, 15 * 24 * 60 * 60 * 1000);
    const status = await service.getStatus(TRIAL_TEST_USER_ID, expiredAt);
    expect(status.status).toBe("expired");
    expect(status.canUseDynamicDrive).toBe(false);
    await assertEntitlementsForTrial(TRIAL_SESSION_TOKEN, false, expiredAt.getTime());
  });

  it("page reload resumes same drive session without double-counting", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();

    const first = await service.startDriveSession(
      TRIAL_TEST_USER_ID,
      driveSessionId,
      TRIAL_TEST_BASE,
    );
    expect(first.resumed).toBe(false);
    expect(first.snapshot.usedSessions).toBe(1);

    const reload = await service.startDriveSession(
      TRIAL_TEST_USER_ID,
      driveSessionId,
      advanceTrialMs(TRIAL_TEST_BASE, 5_000),
    );
    expect(reload.resumed).toBe(true);
    expect(reload.snapshot.usedSessions).toBe(1);
    assertTrialNeverNegative(reload.snapshot);
  });

  it("browser disconnect ends session without driving trial negative", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();
    await service.startDriveSession(TRIAL_TEST_USER_ID, driveSessionId, TRIAL_TEST_BASE);
    await service.heartbeat(
      TRIAL_TEST_USER_ID,
      driveSessionId,
      true,
      advanceTrialMs(TRIAL_TEST_BASE, 30_000),
    );

    const before = await service.getStatus(
      TRIAL_TEST_USER_ID,
      advanceTrialMs(TRIAL_TEST_BASE, 30_000),
    );
    const usedBefore = before.usedSeconds;

    const ended = await service.endDriveSession(
      TRIAL_TEST_USER_ID,
      driveSessionId,
      false,
      advanceTrialMs(TRIAL_TEST_BASE, 35_000),
    );
    assertTrialNeverNegative(ended.snapshot);
    expect(ended.snapshot.usedSeconds).toBeGreaterThanOrEqual(usedBefore);
  });

  it("session heartbeat lost caps credit to server gap - never negative", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();
    await service.startDriveSession(TRIAL_TEST_USER_ID, driveSessionId, TRIAL_TEST_BASE);

    const beat = await service.heartbeat(
      TRIAL_TEST_USER_ID,
      driveSessionId,
      true,
      advanceTrialMs(TRIAL_TEST_BASE, 10 * 60_000),
    );
    expect(beat.creditedSeconds).toBe(Math.floor(DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS / 1000));
    assertTrialNeverNegative(beat.snapshot);
  });

  it("double browser rejects fresh conflict on second device", async () => {
    await activateTrial();
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    await service.startDriveSession(TRIAL_TEST_USER_ID, sessionA, TRIAL_TEST_BASE);
    await service.heartbeat(
      TRIAL_TEST_USER_ID,
      sessionA,
      true,
      advanceTrialMs(TRIAL_TEST_BASE, 30_000),
    );

    await expect(
      service.startDriveSession(
        TRIAL_TEST_USER_ID,
        sessionB,
        advanceTrialMs(TRIAL_TEST_BASE, 60_000),
      ),
    ).rejects.toBeInstanceOf(DynamicDriveTrialSessionConflictError);
  });

  it("simultaneous Tesla + phone share one driveSessionId without extra session charge", async () => {
    await activateTrial();
    const sharedDriveSessionId = randomUUID();

    const phone = await service.startDriveSession(
      TRIAL_TEST_USER_ID,
      sharedDriveSessionId,
      TRIAL_TEST_BASE,
    );
    expect(phone.snapshot.usedSessions).toBe(1);

    const tesla = await service.startDriveSession(
      TRIAL_TEST_USER_ID,
      sharedDriveSessionId,
      advanceTrialMs(TRIAL_TEST_BASE, 2_000),
    );
    expect(tesla.resumed).toBe(true);
    expect(tesla.snapshot.usedSessions).toBe(1);
    expect(tesla.snapshot.activeDriveSessionId).toBe(sharedDriveSessionId);
  });

  it("upgrade during trial converts trial and preserves consumed balance", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();
    await service.startDriveSession(TRIAL_TEST_USER_ID, driveSessionId, TRIAL_TEST_BASE);
    await service.heartbeat(
      TRIAL_TEST_USER_ID,
      driveSessionId,
      true,
      advanceTrialMs(TRIAL_TEST_BASE, 60_000),
    );

    const beforeUpgrade = await service.getStatus(
      TRIAL_TEST_USER_ID,
      advanceTrialMs(TRIAL_TEST_BASE, 60_000),
    );
    const usedBefore = beforeUpgrade.usedSeconds;

    await syncStripeSubscriptionRecord({
      id: "sub_trial_test",
      object: "subscription",
      customer: "cus_trial_test",
      status: "active",
      cancel_at_period_end: false,
      current_period_start: 1_700_000_000,
      current_period_end: 1_700_086_400,
      metadata: {
        userId: TRIAL_TEST_USER_ID,
        elcamosoPlan: "DRIVE_PLUS",
        billingInterval: "month",
      },
      items: { object: "list", data: [{ price: { id: "price_month_test" } }] },
    } as never);

    const converted = await service.getStatus(
      TRIAL_TEST_USER_ID,
      advanceTrialMs(TRIAL_TEST_BASE, 65_000),
    );
    expect(converted.status).toBe("converted");
    expect(converted.usedSeconds).toBe(usedBefore);
    expect(converted.canUseDynamicDrive).toBe(false);

    const user = await resolveEntitlementUser({
      sessionToken: TRIAL_SESSION_TOKEN,
      now: advanceTrialMs(TRIAL_TEST_BASE, 65_000).getTime(),
    });
    expect(user.plan).toBe("DRIVE_PLUS");
    expect(user.trialStatus).toBe("none");
    expect(hasEntitlement(user, "dynamic_drive")).toBe(true);
  });

  it("upgrade after trial expiry grants Drive+ without reactivating trial", async () => {
    await activateTrial(TRIAL_TEST_BASE);
    const expiredAt = advanceTrialMs(TRIAL_TEST_BASE, 15 * 24 * 60 * 60 * 1000);
    const expired = await service.getStatus(TRIAL_TEST_USER_ID, expiredAt);
    expect(expired.status).toBe("expired");

    provisionEntitlementsFromSubscription(baseSubscription());
    await service.completeTrial(TRIAL_TEST_USER_ID, expiredAt);

    const user = await resolveEntitlementUser({
      sessionToken: TRIAL_SESSION_TOKEN,
      now: expiredAt.getTime(),
    });
    expect(user.plan).toBe("DRIVE_PLUS");
    expect(hasEntitlement(user, "dynamic_drive")).toBe(true);
  });

  it("paid subscriber never consumes trial balance on heartbeat or session start", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();
    await service.startDriveSession(TRIAL_TEST_USER_ID, driveSessionId, TRIAL_TEST_BASE);
    await service.heartbeat(
      TRIAL_TEST_USER_ID,
      driveSessionId,
      true,
      advanceTrialMs(TRIAL_TEST_BASE, 45_000),
    );

    const beforePaid = await service.getStatus(
      TRIAL_TEST_USER_ID,
      advanceTrialMs(TRIAL_TEST_BASE, 45_000),
    );
    const usedBeforePaid = beforePaid.usedSeconds;

    provisionEntitlementsFromSubscription(baseSubscription());

    const sessionStart = await service.startDriveSession(
      TRIAL_TEST_USER_ID,
      randomUUID(),
      advanceTrialMs(TRIAL_TEST_BASE, 50_000),
    );
    expect(sessionStart.snapshot.status).toBe("converted");

    const beat = await service.heartbeat(
      TRIAL_TEST_USER_ID,
      driveSessionId,
      true,
      advanceTrialMs(TRIAL_TEST_BASE, 80_000),
    );
    expect(beat.creditedSeconds).toBe(0);
    expect(beat.snapshot.usedSeconds).toBe(usedBeforePaid);
    assertTrialNeverNegative(beat.snapshot);
  });

  it("cancel subscription later downgrades entitlements after period end", async () => {
    provisionEntitlementsFromSubscription(baseSubscription());
    await service.completeTrial(TRIAL_TEST_USER_ID, TRIAL_TEST_BASE);

    const pastPeriod = new Date("2020-01-01");
    provisionEntitlementsFromSubscription(
      baseSubscription({ status: "canceled", currentPeriodEnd: pastPeriod }),
    );

    const user = await resolveEntitlementUser({
      sessionToken: TRIAL_SESSION_TOKEN,
      now: Date.now(),
    });
    expect(user.plan).toBe("FREE");
    expect(hasEntitlement(user, "dynamic_drive")).toBe(false);
    expect(hasEntitlement(user, "basic_drive")).toBe(true);

    const trial = await service.getStatus(TRIAL_TEST_USER_ID);
    expect(trial.status).toBe("converted");
  });
});
