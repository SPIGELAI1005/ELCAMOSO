import { assertAllowedCheckoutOrigin } from "@/lib/billing/checkout-origin";
import { isBillingManagementAvailable } from "@/lib/billing/billing-available";
import { getStripeClient } from "@/lib/billing/stripe/client";
import { wrapStripeBillingError } from "@/lib/billing/resilience/stripe-errors";

export interface CreatePortalSessionInput {
  stripeCustomerId: string;
  origin: string;
  returnPath?: string;
  trustedHost?: string | null;
  /** Deep-link into Stripe portal cancellation when configured. */
  flow?: "cancel";
  subscriptionId?: string;
}

export interface CreatePortalSessionResult {
  url: string;
}

function sanitizeOrigin(origin: string, trustedHost?: string | null): string {
  return assertAllowedCheckoutOrigin(origin, trustedHost);
}

function sanitizeReturnPath(returnPath: string): string {
  const path = returnPath.trim();
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Invalid return path");
  }
  return path;
}

/** Creates a Stripe Customer Portal session - server-only. */
export async function createStripePortalSession(
  input: CreatePortalSessionInput,
): Promise<CreatePortalSessionResult> {
  if (!isBillingManagementAvailable()) {
    throw new Error("Billing is not available");
  }

  const stripe = getStripeClient();
  const origin = sanitizeOrigin(input.origin, input.trustedHost);
  const returnPath = sanitizeReturnPath(input.returnPath ?? "/settings");

  const returnUrl = `${origin}${returnPath}`;
  const params: {
    customer: string;
    return_url: string;
    flow_data?: {
      type: "subscription_cancel";
      subscription_cancel: { subscription: string };
    };
  } = {
    customer: input.stripeCustomerId,
    return_url: returnUrl,
  };
  if (input.flow === "cancel" && input.subscriptionId) {
    params.flow_data = {
      type: "subscription_cancel",
      subscription_cancel: { subscription: input.subscriptionId },
    };
  }

  try {
    const session = await stripe.billingPortal.sessions.create(params);
    return { url: session.url };
  } catch (error) {
    if (params.flow_data) {
      try {
        const fallback = await stripe.billingPortal.sessions.create({
          customer: input.stripeCustomerId,
          return_url: returnUrl,
        });
        return { url: fallback.url };
      } catch (fallbackError) {
        throw wrapStripeBillingError(fallbackError);
      }
    }
    throw wrapStripeBillingError(error);
  }
}
