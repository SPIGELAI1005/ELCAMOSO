import { createFileRoute } from "@tanstack/react-router";

import { driveLogUploadConfigured, handleDriveLogUpload } from "@/lib/drive-recorder/upload.server";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/drive-logs")({
  server: {
    handlers: {
      GET: async () => jsonResponse({ uploadAvailable: driveLogUploadConfigured() }),
      POST: async ({ request }) => {
        const result = await handleDriveLogUpload(request);
        return result.ok
          ? jsonResponse(result)
          : jsonResponse({ error: result.error }, result.status);
      },
    },
  },
});
