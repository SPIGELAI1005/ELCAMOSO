import { createFileRoute } from "@tanstack/react-router";

import {
  CheckoutAuthError,
  CheckoutValidationError,
  jsonResponse,
  requireAccountSessionFromRequest,
} from "@/lib/billing/checkout-http";
import { parseCheckoutPlanRequest } from "@/lib/billing/checkout-request";
import { beginDrivePlusCheckout, resolveCheckoutOrigin } from "@/lib/billing/checkout-service";
import { resolveTrustedHostFromRequest } from "@/lib/billing/checkout-origin";

export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const checkoutRequest = parseCheckoutPlanRequest(body);
        if (!checkoutRequest) {
          return jsonResponse({ error: "Invalid plan or interval" }, 400);
        }

        try {
          const session = requireAccountSessionFromRequest(request);
          const result = await beginDrivePlusCheckout({
            userId: session.userId,
            email: session.email,
            origin: resolveCheckoutOrigin(request),
            trustedHost: resolveTrustedHostFromRequest(request),
            request: checkoutRequest,
          });

          return jsonResponse(result);
        } catch (error) {
          if (error instanceof CheckoutAuthError) {
            return jsonResponse({ error: error.message }, 401);
          }
          if (error instanceof CheckoutValidationError) {
            return jsonResponse({ error: error.message }, 400);
          }
          if (error instanceof Error && error.message === "Billing is not available") {
            return jsonResponse({ error: error.message }, 503);
          }
          if (error instanceof Error && error.message === "Invalid checkout origin") {
            return jsonResponse({ error: error.message }, 400);
          }
          console.error("[billing checkout]", error);
          return jsonResponse({ error: "Checkout unavailable" }, 500);
        }
      },
    },
  },
});
