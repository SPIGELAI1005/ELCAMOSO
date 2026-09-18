import { createFileRoute } from "@tanstack/react-router";

import {
  constructStripeWebhookEvent,
  dispatchStripeWebhookEvent,
  StripeWebhookVerificationError,
} from "@/lib/billing/stripe/webhook";
import { logStripeWebhookError } from "@/lib/billing/stripe/webhook-log";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        const rawBody = await request.text();

        let event;
        try {
          event = constructStripeWebhookEvent(rawBody, signature);
        } catch (error) {
          if (error instanceof StripeWebhookVerificationError) {
            return new Response(error.message, { status: 400 });
          }
          console.error("[stripe webhook] configuration error", error);
          return new Response("Webhook unavailable", { status: 503 });
        }

        try {
          const result = await dispatchStripeWebhookEvent(event);
          return new Response(JSON.stringify({ received: true, duplicate: result.duplicate }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          logStripeWebhookError(
            "handler failed",
            { eventId: event.id, eventType: event.type },
            error,
          );
          return new Response("Webhook handler failed", { status: 500 });
        }
      },
    },
  },
});
