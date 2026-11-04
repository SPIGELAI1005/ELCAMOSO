import { createFileRoute } from "@tanstack/react-router";

import { getAccountSession } from "@/lib/account/auth-service";
import { readAccountSessionToken } from "@/lib/billing/checkout-http";
import { guestTrialNow } from "@/lib/guest-trial/config";
import { clientIpFromRequest, recordGuestHeartbeat } from "@/lib/guest-trial/usage.server";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function handle(request: Request, claimedSeconds: number) {
  const token = readAccountSessionToken(request);
  const signedIn = Boolean(token && getAccountSession(token));
  try {
    const result = await recordGuestHeartbeat({
      ip: clientIpFromRequest(request),
      signedIn,
      claimedSeconds,
      now: guestTrialNow(),
    });
    return jsonResponse(result);
  } catch (e) {
    // Never block driving on a storage hiccup: the client falls back to its local counter.
    console.error("[guest-trial]", e instanceof Error ? e.message : "error");
    return jsonResponse({ mode: "local_only" });
  }
}

export const Route = createFileRoute("/api/guest-trial")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request, 0),
      POST: async ({ request }) => {
        const b = (await request.json().catch(() => null)) as { seconds?: number } | null;
        return handle(request, Number(b?.seconds ?? 0));
      },
    },
  },
});
