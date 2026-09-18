import type { WebhookEventClaim, WebhookEventStore } from "@/lib/billing/webhook-event-store";
import { postgresWebhookEventStore } from "@/lib/billing/webhook-event-store-postgres";

interface StoredWebhookEvent {
  stripeEventId: string;
  eventType: string;
  status: "processing" | "succeeded" | "failed";
  errorMessage?: string;
}

const events = new Map<string, StoredWebhookEvent>();

export function resetWebhookEventStoreForTests(): void {
  events.clear();
}

export const memoryWebhookEventStore: WebhookEventStore = {
  async claim(eventId, eventType) {
    const existing = events.get(eventId);
    if (existing?.status === "succeeded" || existing?.status === "processing") {
      return "already_processed";
    }
    events.set(eventId, { stripeEventId: eventId, eventType, status: "processing" });
    return "proceed";
  },

  async markSucceeded(eventId) {
    const existing = events.get(eventId);
    if (!existing) return;
    events.set(eventId, { ...existing, status: "succeeded" });
  },

  async markFailed(eventId, errorMessage) {
    const existing = events.get(eventId);
    if (!existing) return;
    events.set(eventId, { ...existing, status: "failed", errorMessage });
  },

  async listFailed(limit = 20) {
    return [...events.values()]
      .filter((event) => event.status === "failed")
      .slice(0, limit)
      .map((event) => ({
        stripeEventId: event.stripeEventId,
        eventType: event.eventType,
        ...(event.errorMessage ? { errorMessage: event.errorMessage } : {}),
      }));
  },
};

let activeStore: WebhookEventStore = memoryWebhookEventStore;

export function setWebhookEventStore(store: WebhookEventStore): void {
  activeStore = store;
}

export function getWebhookEventStore(): WebhookEventStore {
  if (activeStore !== memoryWebhookEventStore) return activeStore;
  if (process.env["DATABASE_URL"]) return postgresWebhookEventStore;
  return memoryWebhookEventStore;
}

export function resetWebhookEventStoreStateForTests(): void {
  activeStore = memoryWebhookEventStore;
  resetWebhookEventStoreForTests();
}
