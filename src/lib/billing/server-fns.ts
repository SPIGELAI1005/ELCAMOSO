import { createServerFn } from "@tanstack/react-start";

import type { CheckoutIntervalSlug, CheckoutPlanSlug } from "@/lib/billing/checkout-request";
import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";

export { getBillingPublicConfigFn } from "@/lib/billing/public-config-server-fn";
import {
  getBillingHealthSnapshot,
  reconcileUserBillingFromStripe,
} from "@/lib/billing/resilience/reconciliation";
import { createStripePortalSession } from "@/lib/billing/stripe/portal";
import { isBillingManagementAvailable } from "@/lib/billing/billing-available";
import { isMonetizationEnabled } from "@/lib/billing/monetization-flag";
import { buildSubscriptionSummary } from "@/lib/billing/subscription-summary";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";
import { getDynamicDriveTrialService } from "@/lib/dynamic-drive-trial/service";

export const getSubscriptionSummaryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import(
      "@/lib/account/session-cookies.server"
    );
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) {
      return {
        authenticated: false as const,
        email: null,
        summary: buildSubscriptionSummary(null, false),
      };
    }

    const subscription = getSubscriptionForUser(session.userId);
    const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(session.userId);
    const canManage = isBillingManagementAvailable() && Boolean(stripeCustomerId);
    const trialSnapshot = await getDynamicDriveTrialService().getStatus(session.userId);

    const summary = buildSubscriptionSummary(subscription, canManage, Date.now(), "en-US", trialSnapshot);
    if (!isMonetizationEnabled()) {
      return {
        authenticated: true as const,
        email: session.email,
        summary: { ...summary, canUpgrade: false },
      };
    }

    return {
      authenticated: true as const,
      email: session.email,
      summary,
    };
  });

export const getBillingHealthFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import(
      "@/lib/account/resolve-authenticated-user"
    );
    const { tryResolveRequestSessionToken } = await import(
      "@/lib/account/session-cookies.server"
    );
    const userId = resolveAuthenticatedUserId(tryResolveRequestSessionToken(data.sessionToken));
    const health = await getBillingHealthSnapshot(userId);
    return { health };
  });

/** Explicit Stripe reconciliation — never used by Drive audio or entitlement gates. */
export const reconcileBillingFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import(
      "@/lib/account/resolve-authenticated-user"
    );
    const { tryResolveRequestSessionToken } = await import(
      "@/lib/account/session-cookies.server"
    );
    const userId = resolveAuthenticatedUserId(tryResolveRequestSessionToken(data.sessionToken));
    return reconcileUserBillingFromStripe(userId);
  });

export const createCheckoutSessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken?: string | null;
      plan: CheckoutPlanSlug;
      interval: CheckoutIntervalSlug;
      origin: string;
      returnPath?: string;
      source?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import(
      "@/lib/account/session-cookies.server"
    );
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) throw new Error("Sign in required");

    return beginDrivePlusCheckout({
      userId: session.userId,
      email: session.email,
      origin: data.origin,
      request: {
        plan: data.plan,
        interval: data.interval,
        returnPath: data.returnPath,
        source: data.source,
      },
    });
  });

export const createBillingPortalSessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { sessionToken?: string | null; origin: string; returnPath?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import(
      "@/lib/account/resolve-authenticated-user"
    );
    const { tryResolveRequestSessionToken } = await import(
      "@/lib/account/session-cookies.server"
    );
    const userId = resolveAuthenticatedUserId(tryResolveRequestSessionToken(data.sessionToken));
    const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(userId);
    if (!stripeCustomerId) {
      throw new Error("No billing account linked");
    }

    return createStripePortalSession({
      stripeCustomerId,
      origin: data.origin,
      returnPath: data.returnPath,
    });
  });
