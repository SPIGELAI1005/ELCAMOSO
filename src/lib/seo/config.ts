/**
 * Canonical SEO configuration - single source of truth for hostname + defaults.
 * Production always resolves to https://www.elcamoso.com (never Vercel preview).
 */

import type { SeoLocale } from "./types";

export const SEO_CONFIG = {
  siteName: "ELCAMOSO",
  /** Hard production canonical host (www). */
  productionOrigin: "https://www.elcamoso.com",
  defaultTitle: "ELCAMOSO - Turn Motion Into Sound",
  defaultDescription:
    "Turn motion into sound with ELCAMOSO. Hear responsive EV engines, music and worlds live, or capture a quiet journey and listen when you arrive.",
  defaultImage: "/og/elcamoso-default.png",
  defaultImageAlt: "ELCAMOSO - Turn Motion Into Sound",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  defaultLocale: "en" as SeoLocale,
  supportedLocales: ["en", "de", "ro"] as const satisfies readonly SeoLocale[],
  twitterCard: "summary_large_image" as const,
};

/**
 * Absolute site origin for canonical / OG / sitemap.
 * Preview and non-production hosts never become the SEO canonical.
 */
export function getSeoSiteOrigin(): string {
  return SEO_CONFIG.productionOrigin;
}

/** True when this deployment should globally discourage indexing. */
export function isSeoPreviewDeployment(): boolean {
  try {
    const vercelEnv =
      (typeof process !== "undefined" && process.env?.["VERCEL_ENV"]) ||
      (typeof import.meta !== "undefined"
        ? (import.meta.env as { VERCEL_ENV?: string }).VERCEL_ENV
        : undefined);
    if (vercelEnv === "preview" || vercelEnv === "development") return true;

    const explicit =
      typeof import.meta !== "undefined"
        ? (import.meta.env as { VITE_SEO_FORCE_NOINDEX?: string }).VITE_SEO_FORCE_NOINDEX
        : undefined;
    if (explicit === "1" || explicit === "true") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function absoluteSeoUrl(path: string, origin = getSeoSiteOrigin()): string {
  const base = origin.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function absoluteSeoImage(imagePath?: string, origin = getSeoSiteOrigin()): string {
  const path = imagePath || SEO_CONFIG.defaultImage;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return absoluteSeoUrl(path.startsWith("/") ? path : `/${path}`, origin);
}
