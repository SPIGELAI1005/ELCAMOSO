import type { OgCardVariant } from "./types";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_SAFE = {
  padX: 80,
  padY: 64,
  edgeKeepout: 50,
} as const;

export const OG_PALETTE = {
  bg: "#000000",
  fg: "#F5F5F7",
  muted: "rgba(245,245,247,0.62)",
  faint: "rgba(245,245,247,0.22)",
  line: "rgba(245,245,247,0.18)",
  accents: {
    brand: "rgba(245,245,247,0.55)",
    engine: "rgba(212,185,140,0.75)",
    symphony: "rgba(196,180,255,0.7)",
    world: "rgba(140,200,220,0.75)",
    fusion: "rgba(220,200,160,0.7)",
    "drive-song": "rgba(180,210,255,0.7)",
    journey: "rgba(200,200,210,0.7)",
    pricing: "rgba(245,245,247,0.55)",
  } satisfies Record<OgCardVariant, string>,
} as const;

export const OG_CACHE_CONTROL_STATIC = "public, max-age=86400, stale-while-revalidate=604800";
export const OG_CACHE_CONTROL_DYNAMIC =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export const MARK_PATHS = {
  circle: { cx: 20, cy: 36, r: 17 },
  waves: [
    "M40 14 C 52 24, 52 48, 40 58",
    "M54 9 C 69 22, 69 50, 54 63",
    "M68 4 C 86 20, 86 52, 68 68",
  ],
} as const;
