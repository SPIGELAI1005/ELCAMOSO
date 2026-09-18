/**
 * OG module config - dimensions, cache, and public endpoints.
 * Re-exports palette constants for a single import surface.
 */
export {
  OG_SIZE,
  OG_SAFE,
  OG_PALETTE,
  OG_CACHE_CONTROL_DYNAMIC,
  OG_CACHE_CONTROL_STATIC,
  MARK_PATHS,
} from "./palette";

export const OG_ENDPOINTS = {
  /** Typed template cards: /api/og?v=symphony */
  card: "/api/og",
  /** Privacy-safe Drive Song: /api/og/drive-song/:shareId */
  driveSong: "/api/og/drive-song",
} as const;

export const OG_FONT_FILES = {
  light: "assets/fonts/Outfit-Light.ttf",
  regular: "assets/fonts/Outfit-Regular.ttf",
  license: "SIL Open Font License 1.1 (fontsource / Google Fonts Outfit)",
} as const;
