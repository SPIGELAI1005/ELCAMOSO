import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse, readAccountSessionToken } from "@/lib/billing/checkout-http";
import { AdminAuthError } from "@/lib/admin/admin-access";
import { requireAdmin } from "@/lib/admin/admin-store.server";
import { deleteFeedback, listFeedback } from "@/lib/feedback/feedback-store.server";

async function guard(request: Request) {
  try {
    await requireAdmin(readAccountSessionToken(request));
    return null;
  } catch (error) {
    if (error instanceof AdminAuthError)
      return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "Unavailable" }, 500);
  }
}

export const Route = createFileRoute("/api/admin/feedback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        try {
          return jsonResponse(await listFeedback());
        } catch (error) {
          console.error("[admin feedback]", error);
          return jsonResponse({ error: "Could not load feedback" }, 500);
        }
      },
      DELETE: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        const url = new URL(request.url).searchParams.get("blob") ?? "";
        try {
          await deleteFeedback(url);
          return jsonResponse({ ok: true });
        } catch {
          return jsonResponse({ error: "Could not delete" }, 400);
        }
      },
    },
  },
});
