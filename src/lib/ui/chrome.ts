/** Fixed BrandNav content height (excludes safe-area inset). */
export const NAV_H_MOBILE = "3.5rem";
export const NAV_H_DESKTOP = "4rem";
/** MiniPlayer bar height when a session is live. */
export const MINI_PLAYER_H = "4.25rem";

export function isLiveSessionStatus(status: string) {
  return status === "running" || status === "suspended" || status === "starting";
}

/**
 * Sticky / fixed offset under BrandNav (+ MiniPlayer when live).
 * Includes notch safe-area so bars sit below the fixed header.
 */
export function chromeStickyTopClass(liveMiniPlayer: boolean) {
  if (liveMiniPlayer) {
    return "top-[calc(3.5rem+4.25rem+env(safe-area-inset-top,0px))] sm:top-[calc(4rem+4.25rem+env(safe-area-inset-top,0px))]";
  }
  return "top-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:top-[calc(4rem+env(safe-area-inset-top,0px))]";
}

export function contentPadTopClass() {
  return "pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:pt-[calc(4rem+env(safe-area-inset-top,0px))]";
}

export function miniPlayerTopClass() {
  return "top-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:top-[calc(4rem+env(safe-area-inset-top,0px))]";
}
