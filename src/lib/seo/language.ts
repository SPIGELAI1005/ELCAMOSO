/**
 * Multilingual SEO readiness.
 *
 * Current product: EN / DE / RO share the same URL via client UI dictionaries.
 * Do NOT emit fake hreflang for the same URL.
 *
 * Future: path locales (/de, /ro) with real translated main content -
 * see docs/SEO.md. Until then, English is the public SEO canonical.
 */

import type { SeoLocale } from "./types";
import { SEO_CONFIG, absoluteSeoUrl } from "./config";

/** Path locales are not live - keep empty until MAIN BODY is translated. */
export const SEO_PATH_LOCALES_ENABLED = false;

export function htmlLangForSeo(locale: SeoLocale = SEO_CONFIG.defaultLocale): string {
  return locale;
}

export interface HreflangLink {
  hreflang: string;
  href: string;
}

/**
 * Alternate links only when path locales exist with real content.
 * Returns [] today so we never claim duplicate-language URLs.
 */
export function buildHreflangLinks(_path: string): HreflangLink[] {
  if (!SEO_PATH_LOCALES_ENABLED) return [];
  // Future example (do not enable without redirects + translations):
  // return SEO_CONFIG.supportedLocales.map((loc) => ({
  //   hreflang: loc,
  //   href: absoluteSeoUrl(loc === "en" ? path : `/${loc}${path === "/" ? "" : path}`),
  // }));
  return [];
}

export function xDefaultHref(path: string): string {
  return absoluteSeoUrl(path);
}
