import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse, readAccountSessionToken } from "@/lib/billing/checkout-http";
import { AdminAuthError } from "@/lib/admin/admin-access";
import { requireAdmin } from "@/lib/admin/admin-store.server";
import { loadDays, readBroadcast, writeBroadcast } from "@/lib/analytics/store.server";
import { stripeSummary } from "@/lib/analytics/stripe-summary.server";
import { listFeedback } from "@/lib/feedback/feedback-store.server";

async function guard(request: Request) {
  try {
    await requireAdmin(readAccountSessionToken(request));
    return null;
  } catch (error) {
    if (error instanceof AdminAuthError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "Unavailable" }, 500);
  }
}

export const Route = createFileRoute("/api/admin/analytics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days") ?? 30)));
        const [daysAgg, money, broadcast, feedback] = await Promise.all([
          loadDays(days).catch((e) => {
            console.error("[admin analytics]", e);
            return null;
          }),
          stripeSummary(),
          readBroadcast().catch(() => []),
          listFeedback(500).catch(() => null),
        ]);
        const feedbackByCategory: Record<string, number> = {};
        for (const f of feedback?.items ?? []) {
          if (!f || f.status === "test") continue;
          feedbackByCategory[f.category] = (feedbackByCategory[f.category] ?? 0) + 1;
        }
        return jsonResponse({ days: daysAgg, money, broadcast, feedbackByCategory });
      },
      POST: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        const b = (await request.json().catch(() => null)) as { title?: string; body?: string; deleteId?: string } | null;
        const list = await readBroadcast().catch(() => []);
        if (b?.deleteId) {
          await writeBroadcast(list.filter((m) => m.id !== b.deleteId));
          return jsonResponse({ ok: true });
        }
        const title = (b?.title ?? "").trim().slice(0, 80);
        const body = (b?.body ?? "").trim().slice(0, 600);
        if (title.length < 2 || body.length < 2) return jsonResponse({ error: "Title and text required" }, 400);
        const msg = { id: `bc-${Date.now().toString(36)}`, at: new Date().toISOString(), title, body };
        await writeBroadcast([...list, msg]);
        return jsonResponse({ ok: true, message: msg });
      },
    },
  },
});
