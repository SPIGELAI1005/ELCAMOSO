/**
 * End-to-end Tesla purchase flow — server-side integration.
 *
 * Simulates: FREE user → trial → upgrade CTA window → QR token → phone checkout
 * → Stripe webhook → entitlements → relay entitlement-update → Drive+ without reload.
 *
 * UI/browser steps are documented in docs/billing/tesla-purchase-e2e.md.
 * Playwright coverage: e2e/tesla-purchase.spec.ts (shell + token page).
 */
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetAccountAuthStoreForTests, saveAccountSession } from "@/lib/account/session-store";
import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import { provisionEntitlementsFromSubscription } from "@/lib/billing/provision-entitlements";
import { resetSubscriptionStoreForTests, getSubscriptionForUser } from "@/lib/billing/subscription-store";
import { dispatchStripeWebhookEvent } from "@/lib/billing/stripe/webhook";
import { resetSubscriptionRepositoryStoreForTests } from "@/lib/billing/subscription-repository-memory";
import {
  attachRelayPeer,
  createDriveRelaySession,
  pushEntitlementUpdateToDisplay,
  resetDriveRelayStoreForTests,
} from "@/lib/drive-relay/store";
import {
  DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS,
} from "@/lib/dynamic-drive-trial/config";
import { resolveTrialUpgradeMilestone } from "@/lib/dynamic-drive-trial/display";
import {
  getDynamicDriveTrialService,
  resetDynamicDriveTrialServiceForTests,
} from "@/lib/dynamic-drive-trial/service";
import { resetDynamicDriveTrialStoreForTests } from "@/lib/dynamic-drive-trial/repository-memory";
import {
  DynamicDriveSessionService,
  resetDynamicDriveSessionServiceForTests,
} from "@/lib/dynamic-drive-session/service";
import { resetDynamicDriveSessionStoreForTests } from "@/lib/dynamic-drive-session/store";
import { hasEntitlement } from "@/lib/entitlements/resolve";
import { resolveEntitlementUser } from "@/lib/entitlements/service";
import { beginLiveDriveAccess } from "@/lib/entitlements/live-drive-access";
import { PREMIUM_ENTITLEMENTS } from "@/lib/entitlements/plans";
import { notifyTeslaUpgradeEntitlementGranted } from "@/lib/tesla-upgrade/notify";
import {
  bindUserToTeslaUpgradeToken,
  createTeslaUpgradeToken,
  resolveTeslaUpgradeToken,
  resetTeslaUpgradeStoreForTests,
  tokenStatusForTests,
} from "@/lib/tesla-upgrade/store";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";
import { resetWebhookEventStoreStateForTests } from "@/lib/billing/webhook-event-store-memory";

const USER_ID = "77777777-7777-4777-8777-777777777777";
const SESSION_TOKEN = "tesla-purchase-session";
const CLIENT_DRIVE_SESSION_ID = "tesla-tab-drive-session";
const BASE = new Date(Date.now() - 60 * 60 * 1000);

const customersCreate = vi.fn();
const customersRetrieve = vi.fn();
const checkoutCreate = vi.fn();
const subscriptionsRetrieve = vi.fn();
const subscriptionsList = vi.fn();
const portalCreate = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    webhooks: Stripe.webhooks,
    customers: { create: customersCreate, retrieve: customersRetrieve },
    checkout: { sessions: { create: checkoutCreate } },
    subscriptions: { retrieve: subscriptionsRetrieve, list: subscriptionsList },
    billingPortal: { sessions: { create: portalCreate } },
  }),
  resetStripeClientForTests: vi.fn(),
}));

function advanceFrom(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

function buildStripeSubscription() {
  return {
    id: "sub_tesla_purchase",
    object: "subscription",
    customer: "cus_tesla_purchase",
    status: "active",
    cancel_at_period_end: false,
    current_period_start: Math.floor(BASE.getTime() / 1000),
    current_period_end: Math.floor(BASE.getTime() / 1000) + 86_400 * 30,
    metadata: { userId: USER_ID, elcamosoPlan: "DRIVE_PLUS", billingInterval: "year" },
    items: { object: "list", data: [{ price: { id: "price_year_test" } }] },
  };
}

describe("Tesla purchase flow (integration)", () => {
  let trialService: ReturnType<typeof getDynamicDriveTrialService>;
  let ddSessionService: DynamicDriveSessionService;
  let relaySessionId: string;
  let relaySend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    resetAccountAuthStoreForTests();
    resetSubscriptionStoreForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetUserBillingRepositoryForTests();
    resetWebhookEventStoreStateForTests();
    resetTeslaUpgradeStoreForTests();
    resetDriveRelayStoreForTests();
    resetDynamicDriveTrialStoreForTests();
    resetDynamicDriveTrialServiceForTests();
    resetDynamicDriveSessionStoreForTests();
    resetDynamicDriveSessionServiceForTests();

    process.env.MONETIZATION_ENABLED = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_tesla_purchase";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";

    saveAccountSession({
      token: SESSION_TOKEN,
      userId: USER_ID,
      email: "tesla-driver@example.com",
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      createdAt: BASE.getTime(),
    });
    await memoryUserBillingRepository.setStripeCustomerId(USER_ID, "cus_tesla_purchase");

    customersCreate.mockResolvedValue({ id: "cus_tesla_purchase" });
    customersRetrieve.mockResolvedValue({ id: "cus_tesla_purchase", deleted: false });
    checkoutCreate.mockResolvedValue({
      id: "cs_tesla_purchase",
      url: "https://checkout.stripe.test/cs_tesla_purchase",
    });
    subscriptionsList.mockResolvedValue({ data: [] });
    subscriptionsRetrieve.mockImplementation(async () => buildStripeSubscription());
    portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/portal" });

    trialService = getDynamicDriveTrialService();
    ddSessionService = new DynamicDriveSessionService();

    relaySend = vi.fn();
    const relay = createDriveRelaySession();
    relaySessionId = relay.sessionId;
    attachRelayPeer(relaySessionId, "display", { id: "tesla-display", send: relaySend });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: trial → QR → checkout → webhook → relay → Drive+ without reload", async () => {
    // 1. FREE user — no Drive+ yet
    let entitlements = await resolveEntitlementUser({
      sessionToken: SESSION_TOKEN,
      now: BASE.getTime(),
    });
    expect(entitlements.plan).toBe("FREE");
    expect(hasEntitlement(entitlements, "dynamic_drive")).toBe(false);

    // 2. Starts Dynamic Drive preview on Tesla
    const trialStarted = await trialService.startPreview(USER_ID, BASE);
    expect(trialStarted.status).toBe("active");
    expect(trialStarted.canUseDynamicDrive).toBe(true);

    entitlements = await resolveEntitlementUser({
      sessionToken: SESSION_TOKEN,
      now: BASE.getTime(),
    });
    expect(hasEntitlement(entitlements, "dynamic_drive")).toBe(true);

    // 3. Active drive session on Tesla (cockpit)
    const driveSessionId = CLIENT_DRIVE_SESSION_ID;
    await ddSessionService.claimSession({
      userId: USER_ID,
      driveSessionId,
      relaySessionId,
      now: BASE.getTime(),
    });
    await trialService.startDriveSession(USER_ID, driveSessionId, BASE);
    beginLiveDriveAccess(PREMIUM_ENTITLEMENTS);

    // 4. Trial nearly expires — upgrade CTA at 10 / 5 / 1 min milestones
    let at = BASE;
    const chunkMs = DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS;
    let lowRemaining = await trialService.getStatus(USER_ID, at);
    while (lowRemaining.remainingSeconds > 600) {
      at = advanceFrom(at, chunkMs);
      await trialService.heartbeat(USER_ID, driveSessionId, true, at);
      await ddSessionService.heartbeat({
        userId: USER_ID,
        driveSessionId,
        relaySessionId,
        now: at.getTime(),
      });
      lowRemaining = await trialService.getStatus(USER_ID, at);
    }
    expect(lowRemaining.remainingSeconds).toBeGreaterThan(0);
    expect(lowRemaining.remainingSeconds).toBeLessThanOrEqual(600);
    const milestone = resolveTrialUpgradeMilestone(lowRemaining.remainingSeconds, new Set());
    expect(milestone).not.toBeNull();
    expect([10, 5, 1]).toContain(milestone);

    // 5. Tesla displays QR (upgrade token + relay link)
    const upgrade = createTeslaUpgradeToken({
      userId: USER_ID,
      clientDriveSessionId: driveSessionId,
      relaySessionId,
    });
    expect(upgrade.upgradePath).toContain("/upgrade/");
    expect(tokenStatusForTests(upgrade.token)).toBe("pending");

    // 6. Phone scans QR — token resolves
    const resolved = resolveTeslaUpgradeToken(upgrade.token);
    expect(resolved.valid).toBe(true);

    // 7. Phone signs in and opens Stripe Checkout
    bindUserToTeslaUpgradeToken(upgrade.token, USER_ID);
    const checkout = await beginDrivePlusCheckout({
      userId: USER_ID,
      email: "tesla-driver@example.com",
      origin: "http://localhost:5173",
      request: {
        plan: "drive_plus",
        interval: "yearly",
        source: "tesla_upgrade",
        upgradeToken: upgrade.token,
        returnPath: `/upgrade/${upgrade.token}`,
      },
    });
    expect(checkout.action).toBe("checkout");
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          upgradeToken: upgrade.token,
          source: "tesla_upgrade",
        }),
      }),
    );

    // 8–9. Test payment succeeds — webhook is billing authority
    const checkoutEvent = {
      id: "evt_tesla_checkout_complete",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_tesla_purchase",
          object: "checkout.session",
          mode: "subscription",
          customer: "cus_tesla_purchase",
          subscription: "sub_tesla_purchase",
          client_reference_id: USER_ID,
          metadata: {
            userId: USER_ID,
            upgradeToken: upgrade.token,
            source: "tesla_upgrade",
          },
        },
      },
    } as Stripe.Event;

    await dispatchStripeWebhookEvent(checkoutEvent);

    // 10. Entitlements update to Drive+
    entitlements = await resolveEntitlementUser({
      sessionToken: SESSION_TOKEN,
      now: at.getTime(),
    });
    expect(entitlements.plan).toBe("DRIVE_PLUS");
    expect(hasEntitlement(entitlements, "dynamic_drive")).toBe(true);
    expect(getSubscriptionForUser(USER_ID)?.plan).toBe("DRIVE_PLUS");

    // 11. Trial converted — no further trial burn
    const trialAfter = await trialService.getStatus(USER_ID, at);
    expect(trialAfter.status).toBe("converted");

    // 12. Relay pushes realtime entitlement-update to Tesla display
    expect(tokenStatusForTests(upgrade.token)).toBe("completed");
    expect(relaySend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "entitlement-update",
        plan: "DRIVE_PLUS",
        upgradeToken: upgrade.token,
      }),
    );

    // 13. Dynamic Drive continues — same session resumes without reload
    const resumed = await trialService.startDriveSession(USER_ID, driveSessionId, advanceFrom(at, 5000));
    expect(resumed.resumed).toBe(true);
    expect(resumed.snapshot.status).toBe("converted");

    const ddClaim = await ddSessionService.claimSession({
      userId: USER_ID,
      driveSessionId,
      relaySessionId,
      now: advanceFrom(at, 5000).getTime(),
    });
    expect(ddClaim.ok).toBe(true);
    if (ddClaim.ok) expect(ddClaim.resumed).toBe(true);

    const heartbeat = await trialService.heartbeat(
      USER_ID,
      driveSessionId,
      true,
      advanceFrom(at, 10_000),
    );
    expect(heartbeat.creditedSeconds).toBe(0);
    expect(heartbeat.snapshot.usedSeconds).toBe(trialAfter.usedSeconds);
  });
});

describe("Tesla purchase flow — failure states", () => {
  beforeEach(() => {
    resetTeslaUpgradeStoreForTests();
    resetDriveRelayStoreForTests();
    resetSubscriptionStoreForTests();
    resetUserBillingRepositoryForTests();
    resetDynamicDriveTrialStoreForTests();
    resetDynamicDriveTrialServiceForTests();
    resetAccountAuthStoreForTests();
    process.env.MONETIZATION_ENABLED = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_tesla_purchase";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
  });

  it("expired upgrade token — phone cannot checkout", () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    const upgrade = createTeslaUpgradeToken({
      userId: USER_ID,
      clientDriveSessionId: CLIENT_DRIVE_SESSION_ID,
      relaySessionId: "relay_x",
    });
    expect(resolveTeslaUpgradeToken(upgrade.token).valid).toBe(true);

    vi.setSystemTime(new Date(BASE.getTime() + 16 * 60 * 1000));
    const expired = resolveTeslaUpgradeToken(upgrade.token);
    expect(expired.valid).toBe(false);
    expect(expired.expired).toBe(true);
    vi.useRealTimers();
  });

  it("wrong account on phone — bind rejected", () => {
    const upgrade = createTeslaUpgradeToken({
      userId: USER_ID,
      clientDriveSessionId: CLIENT_DRIVE_SESSION_ID,
    });
    expect(() => bindUserToTeslaUpgradeToken(upgrade.token, "88888888-8888-4888-8888-888888888888")).toThrow(
      /same account/i,
    );
  });

  it("relay disconnected — push fails, polling fallback remains", () => {
    expect(
      pushEntitlementUpdateToDisplay("missing-relay", { plan: "DRIVE_PLUS", revision: 1 }),
    ).toBe(false);

    const send = vi.fn();
    const relay = createDriveRelaySession();
    attachRelayPeer(relay.sessionId, "phone", { id: "phone-only", send });
    expect(
      pushEntitlementUpdateToDisplay(relay.sessionId, { plan: "DRIVE_PLUS", revision: 1 }),
    ).toBe(false);
  });

  it("webhook delayed — FREE until checkout.session.completed", async () => {
    saveAccountSession({
      token: SESSION_TOKEN,
      userId: USER_ID,
      email: "tesla-driver@example.com",
      expiresAt: Date.now() + 86_400_000,
      createdAt: Date.now(),
    });
    const trial = getDynamicDriveTrialService();
    await trial.startPreview(USER_ID);
    const upgrade = createTeslaUpgradeToken({
      userId: USER_ID,
      clientDriveSessionId: CLIENT_DRIVE_SESSION_ID,
    });
    bindUserToTeslaUpgradeToken(upgrade.token, USER_ID);

    const beforeWebhook = await resolveEntitlementUser({ sessionToken: SESSION_TOKEN });
    expect(beforeWebhook.plan).toBe("FREE");
    expect(tokenStatusForTests(upgrade.token)).toBe("pending");
  });

  it("payment succeeds but no relay — token completes, car polls entitlements", () => {
    const upgrade = createTeslaUpgradeToken({
      userId: USER_ID,
      clientDriveSessionId: CLIENT_DRIVE_SESSION_ID,
      relaySessionId: null,
    });
    notifyTeslaUpgradeEntitlementGranted(USER_ID, { upgradeToken: upgrade.token });
    expect(tokenStatusForTests(upgrade.token)).toBe("completed");
  });

  it("already Drive+ — checkout redirects to portal not duplicate subscription", async () => {
    saveAccountSession({
      token: SESSION_TOKEN,
      userId: USER_ID,
      email: "tesla-driver@example.com",
      expiresAt: Date.now() + 86_400_000,
      createdAt: Date.now(),
    });
    await memoryUserBillingRepository.setStripeCustomerId(USER_ID, "cus_tesla_purchase");
    provisionEntitlementsFromSubscription({
      id: "sub-existing",
      userId: USER_ID,
      provider: "stripe",
      providerCustomerId: "cus_tesla_purchase",
      providerSubscriptionId: "sub_existing",
      plan: "DRIVE_PLUS",
      interval: "year",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await beginDrivePlusCheckout({
      userId: USER_ID,
      email: "tesla-driver@example.com",
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "yearly", source: "tesla_upgrade" },
    });
    expect(result.action).toBe("manage");
    expect(portalCreate).toHaveBeenCalled();
  });
});
