export {
  SEO_CONFIG,
  getSeoSiteOrigin,
  absoluteSeoUrl,
  absoluteSeoImage,
  isSeoPreviewDeployment,
} from "./config";
export { createSeoMetadata, createSeoHeadFromPath, seoHtmlLang } from "./metadata";
export {
  INDEXABLE_ROUTE_POLICIES,
  NOINDEX_ROUTE_POLICIES,
  getSitemapPaths,
  findRoutePolicy,
  robotsForPolicy,
  SITEMAP_PATH,
} from "./routes";
export {
  homepageStructuredData,
  pageStructuredData,
  organizationJsonLd,
  softwareApplicationJsonLd,
  breadcrumbJsonLd,
  serializeJsonLd,
} from "./structured-data";
export { buildHreflangLinks, SEO_PATH_LOCALES_ENABLED, htmlLangForSeo } from "./language";
export { OG_IMAGE_CATALOG, resolveOgImage, driveSongSocialMeta } from "./social";
export type {
  SeoInput,
  SeoLocale,
  SeoRobots,
  SeoRoutePolicy,
  SeoBreadcrumbItem,
  TanStackHeadConfig,
} from "./types";

import { absoluteSeoUrl } from "./config";
import { getSitemapPaths } from "./routes";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build sitemap.xml body for production origin. No fake lastmod. */
export function buildSitemapXml(paths: string[] = getSitemapPaths()): string {
  const urls = paths
    .map(
      (path) => `  <url>
    <loc>${escapeXml(absoluteSeoUrl(path))}</loc>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
