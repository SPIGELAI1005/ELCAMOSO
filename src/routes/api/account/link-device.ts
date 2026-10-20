import { createFileRoute } from "@tanstack/react-router";

import { getAccountSession } from "@/lib/account/auth-service";
import { linkDevice } from "@/lib/accounts/accounts.server";
import { jsonResponse, readAccountSessionToken } from "@/lib/billing/checkout-http";

export const Route = createFileRoute("/api/account/link-device")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = readAccountSessionToken(request);
        const session = token ? getAccountSession(token) : null;
        if (!session) return jsonResponse({ linked: false }, 401);
        const b = (await request.json().catch(() => null)) as { installId?: string } | null;
        try {
          return jsonResponse({ linked: await linkDevice(session.userId, String(b?.installId ?? "")) });
        } catch (e) {
          console.error("[link-device]", e instanceof Error ? e.message : e);
          return jsonResponse({ linked: false });
        }
      },
    },
  },
});
