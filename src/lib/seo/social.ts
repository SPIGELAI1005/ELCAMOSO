import { SEO_CONFIG, absoluteSeoImage, absoluteSeoUrl, getSeoSiteOrigin } from "./config";
import { buildDriveSongOgUrl, buildOgApiUrl, type OgCardVariant } from "@/lib/og";
import { SOCIAL_CARD_TEMPLATES } from "@/lib/og/templates";

export const OG_IMAGE_CATALOG = {
  default: SEO_CONFIG.defaultImage,
  engine: "/og/engine.png",
  symphony: "/og/symphony.png",
  worlds: "/og/worlds.png",
  fusion: "/og/fusion.png",
  driveSong: "/og/drive-song.png",
} as const;

const VARIANT_BY_PATH: Record<string, OgCardVariant> = {
  "/": "brand",
  "/explore": "brand",
  "/sounds": "engine",
  "/symphony": "symphony",
  "/worlds": "world",
  "/fusion": "fusion",
  "/pricing": "pricing",
  "/share/drive": "drive-song",
};

const STATIC_BY_VARIANT: Record<OgCardVariant, string> = {
  brand: OG_IMAGE_CATALOG.default,
  engine: OG_IMAGE_CATALOG.engine,
  symphony: OG_IMAGE_CATALOG.symphony,
  world: OG_IMAGE_CATALOG.worlds,
  fusion: OG_IMAGE_CATALOG.fusion,
  "drive-song": OG_IMAGE_CATALOG.driveSong,
  journey: OG_IMAGE_CATALOG.driveSong,
  pricing: OG_IMAGE_CATALOG.default,
};

/**
 * Prefer dynamic /api/og URL; static file remains the documented fallback.
 */
export function resolveOgImage(
  preferred?: string,
  opts?: {
    variant?: OgCardVariant;
    path?: string;
    /** When false, emit static PNG only. Default true. */
    dynamic?: boolean;
    imageAlt?: string;
  },
): {
  url: string;
  path: string;
  width: number;
  height: number;
  alt: string;
  fallbackUrl: string;
} {
  const cleanPath = (opts?.path || "/").split("?")[0] || "/";
  const variant =
    opts?.variant ||
    VARIANT_BY_PATH[cleanPath] ||
    (cleanPath.startsWith("/share/drive") ? "drive-song" : undefined) ||
    "brand";

  const staticPath = STATIC_BY_VARIANT[variant] || preferred || OG_IMAGE_CATALOG.default;
  const fallbackUrl = absoluteSeoImage(staticPath);
  const tpl = SOCIAL_CARD_TEMPLATES[variant];
  const alt = opts?.imageAlt || tpl.alt({ variant, title: tpl.defaultTitle });

  if (preferred) {
    if (preferred.startsWith("http://") || preferred.startsWith("https://")) {
      return {
        path: staticPath,
        url: preferred,
        fallbackUrl,
        width: SEO_CONFIG.ogImageWidth,
        height: SEO_CONFIG.ogImageHeight,
        alt,
      };
    }
    if (preferred.startsWith("/api/og")) {
      return {
        path: staticPath,
        url: absoluteSeoUrl(preferred),
        fallbackUrl,
        width: SEO_CONFIG.ogImageWidth,
        height: SEO_CONFIG.ogImageHeight,
        alt,
      };
    }
  }

  const useDynamic = opts?.dynamic !== false;
  const url = useDynamic ? buildOgApiUrl(variant) : fallbackUrl;
  return {
    path: staticPath,
    url,
    fallbackUrl,
    width: SEO_CONFIG.ogImageWidth,
    height: SEO_CONFIG.ogImageHeight,
    alt,
  };
}

export function socialCardUrlForPath(path: string): string {
  const clean = path.split("?")[0] || "/";
  const variant = VARIANT_BY_PATH[clean] || "brand";
  return buildOgApiUrl(variant);
}

/**
 * Privacy-safe Drive Song social overrides.
 * Never accept GPS / route / identity fields.
 */
export function driveSongSocialMeta(input: {
  title?: string;
  description?: string;
  image?: string;
  sharePayload?: string;
}): { title: string; description: string; image: string } {
  const raw = JSON.stringify(input);
  if (/latitude|longitude|gps|polyline|route|home|work|vin|plate/i.test(raw)) {
    return {
      title: "This drive made a song. | ELCAMOSO",
      description: "A Drive Song created with ELCAMOSO.",
      image: absoluteSeoUrl("/og/drive-song.png"),
    };
  }
  const title = (input.title || "This drive made a song.").slice(0, 70);
  const description = (
    input.description || "Created with ELCAMOSO. No route or GPS is shared."
  ).slice(0, 200);
  let image = input.image || absoluteSeoUrl("/og/drive-song.png");
  if (input.sharePayload) {
    image = buildDriveSongOgUrl(input.sharePayload);
  }
  return { title, description, image };
}

export { getSeoSiteOrigin };
