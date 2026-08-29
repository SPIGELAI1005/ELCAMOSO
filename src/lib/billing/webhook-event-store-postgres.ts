import { eq } from "drizzle-orm";

import type { WebhookEventClaim, WebhookEventStore } from "@/lib/billing/webhook-event-store";
import { getDb } from "@/lib/db/client";
import { stripeWebhookEvents } from "@/lib/db/schema";

export const postgresWebhookEventStore: WebhookEventStore = {
  async claim(eventId, eventType): Promise<WebhookEventClaim> {
    const db = getDb();

    const inserted = await db
      .insert(stripeWebhookEvents)
      .values({
        stripeEventId: eventId,
        eventType,
        status: "processing",
      })
      .onConflictDoNothing()
      .returning({ stripeEventId: stripeWebhookEvents.stripeEventId });

    if (inserted.length > 0) {
      return "proceed";
    }

    const [existing] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeEventId, eventId))
      .limit(1);

    if (!existing || existing.status === "succeeded" || existing.status === "processing") {
      return "already_processed";
    }

    const retried = await db
      .update(stripeWebhookEvents)
      .set({ status: "processing", errorMessage: null, processedAt: null })
      .where(eq(stripeWebhookEvents.stripeEventId, eventId))
      .returning({ stripeEventId: stripeWebhookEvents.stripeEventId });

    return retried.length > 0 ? "proceed" : "already_processed";
  },

  async markSucceeded(eventId) {
    const db = getDb();
    await db
      .update(stripeWebhookEvents)
      .set({ status: "succeeded", processedAt: new Date(), errorMessage: null })
      .where(eq(stripeWebhookEvents.stripeEventId, eventId));
  },

  async markFailed(eventId, errorMessage) {
    const db = getDb();
    await db
      .update(stripeWebhookEvents)
      .set({
        status: "failed",
        processedAt: new Date(),
        errorMessage: errorMessage.slice(0, 500),
      })
      .where(eq(stripeWebhookEvents.stripeEventId, eventId));
  },
};
