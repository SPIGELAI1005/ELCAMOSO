import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse, readAccountSessionToken } from "@/lib/billing/checkout-http";
import { AdminAuthError } from "@/lib/admin/admin-access";
import { requireAdmin } from "@/lib/admin/admin-store.server";

export const Route = createFileRoute("/api/admin/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const admin = await requireAdmin(readAccountSessionToken(request));
          return jsonResponse({ admin: true, email: admin.email });
        } catch (error) {
          if (error instanceof AdminAuthError) {
            return jsonResponse({ error: error.message }, error.status);
          }
          console.error("[admin me]", error);
          return jsonResponse({ error: "Unavailable" }, 500);
        }
      },
    },
  },
});
