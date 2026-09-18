import { createFileRoute } from "@tanstack/react-router";
import {
  parseOgQuery,
  renderOgCardResponse,
  redirectToFallback,
  isOgCardVariant,
} from "@/lib/og/render";
import { ogCardFromPublicShare, ogCardFromDriveDna } from "@/lib/og/templates";
import { publicMetaFromJourneyShare } from "@/lib/og/from-share";
import { decodeJourneyShare } from "@/lib/journey";

/**
 * GET /api/og?v=brand|engine|symphony|world|fusion|drive-song|journey|pricing
 * Optional text: title, subtitle, eyebrow, experience, seed, archetype
 * Optional share= encoded JourneySharePayload → drive-song card
 */
export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const shareParam = url.searchParams.get("share");
          if (shareParam) {
            return await renderFromShare(shareParam, url.searchParams.get("card") === "journey");
          }
          const data = parseOgQuery(url.searchParams);
          return await renderOgCardResponse(data);
        } catch {
          const v = new URL(request.url).searchParams.get("v") || "brand";
          return redirectToFallback(isOgCardVariant(v) ? v : "brand");
        }
      },
    },
  },
});

async function renderFromShare(shareParam: string, asJourney: boolean): Promise<Response> {
  const payload = decodeJourneyShare(shareParam);
  if (!payload) return redirectToFallback("drive-song");
  const publicMeta = publicMetaFromJourneyShare(payload);
  if (!publicMeta) return redirectToFallback("drive-song");
  const card = asJourney ? ogCardFromDriveDna(publicMeta) : ogCardFromPublicShare(publicMeta);
  return renderOgCardResponse(card, {
    cacheControl: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
  });
}
