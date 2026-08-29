import { createFileRoute } from "@tanstack/react-router";

import {
  CheckoutAuthError,
  jsonResponse,
  requireAccountSessionFromRequest,
} from "@/lib/billing/checkout-http";
import { createStripePortalSession } from "@/lib/billing/stripe/portal";
import { resolveCheckoutOrigin } from "@/lib/billing/checkout-service";
import { resolveTrustedHostFromRequest } from "@/lib/billing/checkout-origin";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";

export const Route = createFileRoute("/api/billing/portal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          const parsed = await request.json();
          if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const returnPath =
          typeof body.returnPath === "string" && body.returnPath.trim()
            ? body.returnPath.trim()
            : "/settings";

        try {
          const session = requireAccountSessionFromRequest(request);
          const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(
            session.userId,
          );
          if (!stripeCustomerId) {
            return jsonResponse({ error: "No billing account linked" }, 404);
          }

          const portal = await createStripePortalSession({
            stripeCustomerId,
            origin: resolveCheckoutOrigin(request),
            returnPath,
            trustedHost: resolveTrustedHostFromRequest(request),
          });

          return jsonResponse({ action: "manage", url: portal.url });
        } catch (error) {
          if (error instanceof CheckoutAuthError) {
            return jsonResponse({ error: error.message }, 401);
          }
          if (error instanceof Error && error.message === "Billing is not available") {
            return jsonResponse({ error: error.message }, 503);
          }
          console.error("[billing portal]", error);
          return jsonResponse({ error: "Portal unavailable" }, 500);
        }
      },
    },
  },
});
