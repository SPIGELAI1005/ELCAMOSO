import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertBillingAdminAccess,
  BillingAdminAccessDeniedError,
} from "@/lib/billing/admin/auth";
import { buildBillingAdminDiagnostics } from "@/lib/billing/admin/diagnostics";
import { resolveInternalUserLookup } from "@/lib/billing/admin/resolve-user";
import { reconcileUserBillingFromStripe } from "@/lib/billing/resilience/reconciliation";
import { provisionEntitlementsFromSubscription } from "@/lib/billing/provision-entitlements";
import {
  getSubscriptionRepository,
  resetSubscriptionRepositoryStoreForTests,
} from "@/lib/billing/subscription-repository-memory";
import { getSubscriptionForUser, resetSubscriptionStoreForTests } from "@/lib/billing/subscription-store";
import {
  createUserForEmail,
  registerUserEmail,
  resetAccountAuthStoreForTests,
} from "@/lib/account/session-store";
import {
  getUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";

const USER_ID = "55555555-5555-4555-8555-555555555555";
const ADMIN_SECRET = "test-admin-secret";

const subscriptionsList = vi.fn();
const subscriptionsRetrieve = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    subscriptions: { list: subscriptionsList, retrieve: subscriptionsRetrieve },
  }),
  resetStripeClientForTests: vi.fn(),
}));

describe("billing admin diagnostics", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    resetSubscriptionStoreForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetUserBillingRepositoryForTests();
    resetAccountAuthStoreForTests();
    process.env.ELCAMOSO_BILLING_ADMIN_SECRET = ADMIN_SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
    registerUserEmail("driver@example.com", USER_ID);
    await getUserBillingRepository().setStripeCustomerId(USER_ID, "cus_admin");
  });

  afterEach(() => {
    delete process.env.ELCAMOSO_BILLING_ADMIN_SECRET;
    vi.clearAllMocks();
  });

  it("rejects invalid admin secret", () => {
    expect(() => assertBillingAdminAccess("wrong")).toThrow(BillingAdminAccessDeniedError);
    expect(() => assertBillingAdminAccess(ADMIN_SECRET)).not.toThrow();
  });

  it("resolves lookup by internal user id", async () => {
    const resolved = await resolveInternalUserLookup(USER_ID);
    expect(resolved.userId).toBe(USER_ID);
    expect(resolved.lookup).toBe("user_id");
  });

  it("resolves lookup by email", async () => {
    const resolved = await resolveInternalUserLookup("driver@example.com");
    expect(resolved.userId).toBe(USER_ID);
    expect(resolved.email).toBe("driver@example.com");
    expect(resolved.lookup).toBe("email");
  });

  it("builds read-only diagnostics snapshot", async () => {
    const saved = await getSubscriptionRepository().upsert({
      userId: USER_ID,
      provider: "stripe",
      providerCustomerId: "cus_admin",
      providerSubscriptionId: "sub_admin",
      plan: "DRIVE_PLUS",
      interval: "month",
      status: "active",
      currentPeriodStart: new Date("2026-08-01"),
      currentPeriodEnd: new Date("2026-09-01"),
      cancelAtPeriodEnd: false,
    });
    provisionEntitlementsFromSubscription(saved);

    const diagnostics = await buildBillingAdminDiagnostics(USER_ID, "driver@example.com");
    expect(diagnostics.internalPlan).toBe("DRIVE_PLUS");
    expect(diagnostics.entitlements).toContain("dynamic_drive");
    expect(diagnostics.stripeCustomerId).toBe("cus_admin");
    expect(diagnostics.stripeSubscriptionId).toBe("sub_admin");
    expect(diagnostics.localSubscriptionStatus).toBe("active");
    expect(diagnostics.currentPeriodEnd).toBe("2026-09-01T00:00:00.000Z");
    expect(diagnostics.lastSubscriptionUpdate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("admin re-sync pulls from Stripe without arbitrary entitlement edits", async () => {
    const stripeSubscription = {
      id: "sub_admin",
      object: "subscription",
      customer: "cus_admin",
      status: "active",
      cancel_at_period_end: false,
      current_period_start: 1_700_000_000,
      current_period_end: 1_700_086_400,
      metadata: { userId: USER_ID, elcamosoPlan: "DRIVE_PLUS", billingInterval: "month" },
      items: { object: "list", data: [{ price: { id: "price_month_test" } }] },
    };

    subscriptionsList.mockResolvedValue({ data: [stripeSubscription] });
    subscriptionsRetrieve.mockResolvedValue(stripeSubscription);
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";

    const result = await reconcileUserBillingFromStripe(USER_ID);
    expect(result.ok).toBe(true);
    expect(getSubscriptionForUser(USER_ID)?.plan).toBe("DRIVE_PLUS");
  });

  it("creates user id from email when registering new user", () => {
    const userId = createUserForEmail("new@example.com");
    expect(userId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
