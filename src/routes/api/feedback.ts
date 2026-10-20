import { createFileRoute } from "@tanstack/react-router";

import {
  feedbackAuthSource,
  feedbackConfigured,
  submitFeedback,
} from "@/lib/feedback/feedback-store.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/feedback")({
  server: {
    handlers: {
      GET: async () => json({ available: feedbackConfigured(), auth: feedbackAuthSource() }),
      POST: async ({ request }) => {
        try {
          const r = await submitFeedback(request);
          return json(r.body, r.status);
        } catch (error) {
          console.error("[feedback]", error instanceof Error ? error.message : error);
          return json({ error: "Could not send. Please try again." }, 500);
        }
      },
    },
  },
});
