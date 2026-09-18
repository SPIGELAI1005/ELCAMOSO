import { createFileRoute } from "@tanstack/react-router";
import { renderOgCardResponse, redirectToFallback } from "@/lib/og/render";
import { ogCardFromPublicShare, ogCardFromDriveDna } from "@/lib/og/templates";
import { publicMetaFromJourneyShare } from "@/lib/og/from-share";
import { decodeJourneyShare } from "@/lib/journey";

/**
 * Preferred dynamic Drive Song OG:
 * GET /api/og/drive-song/:shareId
 * Optional ?card=journey for Drive DNA layout.
 */
export const Route = createFileRoute("/api/og/drive-song/$shareId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const raw = decodeURIComponent(params.shareId || "");
          const payload = decodeJourneyShare(raw);
          if (!payload) return redirectToFallback("drive-song");

          const publicMeta = publicMetaFromJourneyShare(payload);
          if (!publicMeta) return redirectToFallback("drive-song");

          const url = new URL(request.url);
          const asJourney = url.searchParams.get("card") === "journey";
          const card = asJourney
            ? ogCardFromDriveDna(publicMeta)
            : ogCardFromPublicShare(publicMeta);

          return await renderOgCardResponse(card, {
            cacheControl: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
          });
        } catch {
          return redirectToFallback("drive-song");
        }
      },
    },
  },
});
