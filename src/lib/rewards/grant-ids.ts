import { createHash } from "node:crypto";

/**
 * Deterministic UUIDs for reward fulfilment grants.
 * Retries must reuse the same id so failures cannot double-grant.
 */
export function deterministicGrantId(claimId: string, part: string): string {
  const hex = createHash("sha256").update(`elcamoso-reward:${claimId}:${part}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export function deterministicReservationId(claimId: string): string {
  return deterministicGrantId(claimId, "discount-reservation");
}
