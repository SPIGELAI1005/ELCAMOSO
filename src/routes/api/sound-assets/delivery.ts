import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse } from "@/lib/billing/checkout-http";
import {
  deliverSignedSoundAsset,
  SoundAssetDeliveryError,
} from "@/lib/sound-assets/delivery-service";

function parseDeliveryQuery(url: URL) {
  const assetPath = url.searchParams.get("path")?.trim() ?? "";
  const expiresAt = Number(url.searchParams.get("exp"));
  const signature = url.searchParams.get("sig")?.trim() ?? "";
  return { assetPath, expiresAt, signature };
}

export const Route = createFileRoute("/api/sound-assets/delivery")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { assetPath, expiresAt, signature } = parseDeliveryQuery(new URL(request.url));

        try {
          return await deliverSignedSoundAsset({
            path: assetPath,
            expiresAt,
            signature,
          });
        } catch (error) {
          if (error instanceof SoundAssetDeliveryError) {
            if (error.status === 403 || error.status === 404) {
              return jsonResponse({ error: error.message }, error.status);
            }
            return jsonResponse({ error: error.message }, error.status);
          }
          console.error("[sound-assets delivery]", error);
          return jsonResponse({ error: "Delivery unavailable" }, 500);
        }
      },
    },
  },
});
