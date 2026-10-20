import { createFileRoute } from "@tanstack/react-router";

import { analyticsConfigured, ingestBatch } from "@/lib/analytics/store.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/analytics")({
  server: {
    handlers: {
      GET: async () => json({ available: analyticsConfigured() }),
      POST: async ({ request }) => {
        try {
          const r = await ingestBatch(request);
          return json(r.body, r.status);
        } catch (e) {
          console.error("[analytics]", e instanceof Error ? e.message : e);
          return json({ error: "Unavailable" }, 500);
        }
      },
    },
  },
});
