/** Lifetime is limited to 50 seats (George, 2 Nov 2026). Client-safe helpers only. */
export const LIFETIME_SEAT_LIMIT = 50;

export interface LifetimeSeatStatus {
  limit: number;
  sold: number;
  left: number;
  soldOut: boolean;
}

export function lifetimeSeatStatus(sold: number, limit = LIFETIME_SEAT_LIMIT): LifetimeSeatStatus {
  const safeSold = Number.isFinite(sold) && sold > 0 ? Math.floor(sold) : 0;
  const left = Math.max(0, limit - safeSold);
  return { limit, sold: safeSold, left, soldOut: left === 0 };
}

export const LIFETIME_SOLD_OUT_MESSAGE = "Lifetime is sold out. All 50 seats are taken.";
