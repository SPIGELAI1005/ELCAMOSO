/** Safe webhook logging — never log card data or raw payloads. */
export function logStripeWebhookInfo(
  message: string,
  context: { eventId: string; eventType: string; detail?: string },
): void {
  console.info(`[stripe webhook] ${message}`, {
    eventId: context.eventId,
    eventType: context.eventType,
    ...(context.detail ? { detail: context.detail } : {}),
  });
}

export function logStripeWebhookError(
  message: string,
  context: { eventId: string; eventType: string },
  error: unknown,
): void {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  console.error(`[stripe webhook] ${message}`, {
    eventId: context.eventId,
    eventType: context.eventType,
    error: errorMessage,
  });
}

export function safeWebhookErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Unknown error";
}
