import { absoluteSeoUrl, getSeoSiteOrigin } from "@/lib/seo/config";
import type { OgCardVariant } from "./types";
import { isOgCardVariant } from "./templates";

/** Absolute dynamic OG URL for a variant (client-safe; no ImageResponse). */
export function buildOgApiUrl(
  variant: OgCardVariant,
  params?: Record<string, string | undefined>,
): string {
  const url = new URL("/api/og", getSeoSiteOrigin());
  url.searchParams.set("v", variant);
  if (params) {
    for (const [k, val] of Object.entries(params)) {
      if (val) url.searchParams.set(k, val);
    }
  }
  return url.toString();
}

/** Absolute OG URL for an encoded Drive Song share. */
export function buildDriveSongOgUrl(encodedShareId: string): string {
  const id = encodedShareId.startsWith("%") ? encodedShareId : encodeURIComponent(encodedShareId);
  return absoluteSeoUrl(`/api/og/drive-song/${id}`);
}

export function parseVariantParam(raw: string | null | undefined): OgCardVariant {
  if (raw && isOgCardVariant(raw)) return raw;
  return "brand";
}
