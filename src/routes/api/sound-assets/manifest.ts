import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse, readAccountSessionToken } from "@/lib/billing/checkout-http";
import {
  buildSoundAssetManifest,
  SoundAssetDeliveryUnavailableError,
} from "@/lib/sound-assets/manifest-service";
import type { SoundAssetManifestRequest } from "@/lib/sound-assets/types";
import { resolveCheckoutOrigin } from "@/lib/billing/checkout-service";

function parseManifestRequest(body: Record<string, unknown>): SoundAssetManifestRequest {
  const personality =
    typeof body["personality"] === "string" && body["personality"].trim()
      ? body["personality"].trim()
      : undefined;
  return personality ? { personality } : {};
}

export const Route = createFileRoute("/api/sound-assets/manifest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          const parsed = await request.json();
          if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        try {
          const sessionToken = readAccountSessionToken(request);
          const manifest = await buildSoundAssetManifest({
            sessionToken,
            origin: resolveCheckoutOrigin(request),
            request: parseManifestRequest(body),
          });
          return jsonResponse(manifest);
        } catch (error) {
          if (error instanceof SoundAssetDeliveryUnavailableError) {
            return jsonResponse({ error: error.message }, 503);
          }
          if (error instanceof Error && error.message === "Invalid checkout origin") {
            return jsonResponse({ error: error.message }, 400);
          }
          console.error("[sound-assets manifest]", error);
          return jsonResponse({ error: "Manifest unavailable" }, 500);
        }
      },
    },
  },
});
