import { createFileRoute } from "@tanstack/react-router";

import { readBroadcast } from "@/lib/analytics/store.server";

export const Route = createFileRoute("/api/broadcast")({
  server: {
    handlers: {
      GET: async () => {
        const messages = await readBroadcast().catch(() => []);
        return new Response(JSON.stringify({ messages }), {
          headers: {
            "content-type": "application/json",
            // CDN caches for 10 min so Blob reads stay low.
            "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
          },
        });
      },
    },
  },
});
