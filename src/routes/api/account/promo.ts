import { createFileRoute } from "@tanstack/react-router";

import { getAccountSession } from "@/lib/account/auth-service";
import { AccountsError, hasAccountsDb, redeemPromo } from "@/lib/accounts/accounts.server";
import { jsonResponse, readAccountSessionToken } from "@/lib/billing/checkout-http";

const tries = new Map<string, number[]>();

export const Route = createFileRoute("/api/account/promo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = readAccountSessionToken(request);
        const session = token ? getAccountSession(token) : null;
        if (!session) return jsonResponse({ error: "Sign in to redeem codes" }, 401);
        if (!hasAccountsDb()) return jsonResponse({ error: "Codes are not available yet" }, 503);
        const now = Date.now();
        const list = (tries.get(session.userId) ?? []).filter((t) => now - t < 10 * 60_000);
        if (list.length >= 10) return jsonResponse({ error: "Too many attempts, try later" }, 429);
        tries.set(session.userId, [...list, now]);
        const b = (await request.json().catch(() => null)) as { code?: string } | null;
        try {
          const r = await redeemPromo(session.userId, String(b?.code ?? ""));
          return jsonResponse({ ok: true, ...r });
        } catch (e) {
          if (e instanceof AccountsError) return jsonResponse({ error: e.message }, e.status);
          console.error("[promo]", e instanceof Error ? e.message : e);
          return jsonResponse({ error: "Could not redeem right now" }, 500);
        }
      },
    },
  },
});
