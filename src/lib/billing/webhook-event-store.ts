export type WebhookEventClaim = "proceed" | "already_processed";

export interface WebhookEventStore {
  claim(eventId: string, eventType: string): Promise<WebhookEventClaim>;
  markSucceeded(eventId: string): Promise<void>;
  markFailed(eventId: string, errorMessage: string): Promise<void>;
  listFailed?(limit?: number): Promise<
    Array<{ stripeEventId: string; eventType: string; errorMessage?: string }>
  >;
}
