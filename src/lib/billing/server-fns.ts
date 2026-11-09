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

async function requestHost(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    return getRequestHeader("host")?.trim() || null;
  } catch {
    return null;
  }
}

export const getSubscriptionSummaryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) {
      return {
        authenticated: false as const,
        email: null,
        summary: buildSubscriptionSummary(null, false),
      };
    }

    const { hydrateUserBillingState } = await import("@/lib/billing/durable-state.server");
    await hydrateUserBillingState(session.userId);
    const subscription = getSubscriptionForUser(session.userId);
    const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(session.userId);
    const canManage = isBillingManagementAvailable() && Boolean(stripeCustomerId);
    const trialSnapshot = await getDynamicDriveTrialService().getStatus(session.userId);

    const summary = buildSubscriptionSummary(
      subscription,
      canManage,
      Date.now(),
      "en-US",
      trialSnapshot,
    );
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
    const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const userId = resolveAuthenticatedUserId(tryResolveRequestSessionToken(data.sessionToken));
    const health = await getBillingHealthSnapshot(userId);
    return { health };
  });

/** Explicit Stripe reconciliation - never used by Drive audio or entitlement gates. */
export const reconcileBillingFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
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
      /** Sound Spin reservation id — server validates ownership; no client coupon ids. */
      rewardReservationId?: string | null;
      immediateStartConsent?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) throw new Error("Sign in required");

    return beginDrivePlusCheckout({
      userId: session.userId,
      email: session.email,
      origin: data.origin,
      trustedHost: await requestHost(),
      immediateStartConsent: Boolean(data.immediateStartConsent),
      request: {
        plan: data.plan,
        interval: data.interval,
        ...(data.returnPath ? { returnPath: data.returnPath } : {}),
        ...(data.source ? { source: data.source } : {}),
      },
      ...(data.rewardReservationId ? { rewardReservationId: data.rewardReservationId } : {}),
    });
  });

export const createBillingPortalSessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken?: string | null;
      origin: string;
      returnPath?: string;
      flow?: "cancel" | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const userId = resolveAuthenticatedUserId(tryResolveRequestSessionToken(data.sessionToken));
    const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(userId);
    if (!stripeCustomerId) {
      throw new Error("No billing account linked");
    }
    const { getSubscriptionRepository } =
      await import("@/lib/billing/subscription-repository-memory");
    const sub =
      data.flow === "cancel"
        ? await getSubscriptionRepository().findLatestByUserId?.(userId)
        : null;

    return createStripePortalSession({
      stripeCustomerId,
      origin: data.origin,
      trustedHost: await requestHost(),
      ...(data.returnPath ? { returnPath: data.returnPath } : {}),
      ...(data.flow === "cancel" && sub?.providerSubscriptionId
        ? { flow: "cancel" as const, subscriptionId: sub.providerSubscriptionId }
        : {}),
    });
  });

export const switchToYearlyFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) throw new Error("Sign in required");
    const { hydrateUserBillingState } = await import("@/lib/billing/durable-state.server");
    await hydrateUserBillingState(session.userId, { force: true });
    const { switchMonthlySubscriptionToYearly } = await import("@/lib/billing/switch-to-yearly");
    return switchMonthlySubscriptionToYearly(session.userId);
  });
