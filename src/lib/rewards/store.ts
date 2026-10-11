import type {
  DiscountReservation,
  RewardClaimRecord,
} from "./types";

/**
 * In-memory authoritative claim store (mirrors Postgres constraints in 0004).
 * Uniqueness: (accountId, campaignId, periodKey) and idempotencyKey per account+campaign.
 * Single-threaded Node: sync check+insert between awaits is race-safe for concurrent requests.
 */

const claimsById = new Map<string, RewardClaimRecord>();
const claimsByPeriod = new Map<string, string>(); // periodKey → claimId
const claimsByIdempotency = new Map<string, string>(); // account:campaign:period:idem → claimId
const inventoryCounts = new Map<string, number>(); // campaign:period:rewardId → count
const reservationsById = new Map<string, DiscountReservation>();
const themesByAccount = new Map<string, Set<string>>();

function periodMapKey(accountId: string, campaignId: string, periodKey: string): string {
  return `${accountId}\0${campaignId}\0${periodKey}`;
}

function idemMapKey(
  accountId: string,
  campaignId: string,
  periodKey: string,
  idempotencyKey: string,
): string {
  return `${accountId}\0${campaignId}\0${periodKey}\0${idempotencyKey}`;
}

function inventoryKey(campaignId: string, periodKey: string, rewardId: string): string {
  return `${campaignId}\0${periodKey}\0${rewardId}`;
}

export function resetRewardStoreForTests(): void {
  claimsById.clear();
  claimsByPeriod.clear();
  claimsByIdempotency.clear();
  inventoryCounts.clear();
  reservationsById.clear();
  themesByAccount.clear();
}

export function getClaimById(claimId: string): RewardClaimRecord | null {
  return claimsById.get(claimId) ?? null;
}

export function getClaimForPeriod(
  accountId: string,
  campaignId: string,
  periodKey: string,
): RewardClaimRecord | null {
  const id = claimsByPeriod.get(periodMapKey(accountId, campaignId, periodKey));
  return id ? (claimsById.get(id) ?? null) : null;
}

export function getClaimByIdempotency(
  accountId: string,
  campaignId: string,
  periodKey: string,
  idempotencyKey: string,
): RewardClaimRecord | null {
  const id = claimsByIdempotency.get(
    idemMapKey(accountId, campaignId, periodKey, idempotencyKey),
  );
  return id ? (claimsById.get(id) ?? null) : null;
}

export function getInventoryUsed(
  campaignId: string,
  periodKey: string,
  rewardId: string,
): number {
  return inventoryCounts.get(inventoryKey(campaignId, periodKey, rewardId)) ?? 0;
}

export function isInventoryAvailable(
  campaignId: string,
  periodKey: string,
  rewardId: string,
  limit: number | undefined,
): boolean {
  if (limit == null) return true;
  return getInventoryUsed(campaignId, periodKey, rewardId) < limit;
}

/**
 * Atomically insert a claim. Enforces period uniqueness.
 * Returns existing claim when period or idempotency key already recorded.
 */
export function insertClaimExclusive(record: RewardClaimRecord): {
  claim: RewardClaimRecord;
  inserted: boolean;
  reusedReason?: "period" | "idempotency";
} {
  const byIdem = getClaimByIdempotency(
    record.accountId,
    record.campaignId,
    record.periodKey,
    record.idempotencyKey,
  );
  if (byIdem) {
    return { claim: byIdem, inserted: false, reusedReason: "idempotency" };
  }

  const byPeriod = getClaimForPeriod(
    record.accountId,
    record.campaignId,
    record.periodKey,
  );
  if (byPeriod) {
    return { claim: byPeriod, inserted: false, reusedReason: "period" };
  }

  claimsById.set(record.claimId, record);
  claimsByPeriod.set(
    periodMapKey(record.accountId, record.campaignId, record.periodKey),
    record.claimId,
  );
  claimsByIdempotency.set(
    idemMapKey(
      record.accountId,
      record.campaignId,
      record.periodKey,
      record.idempotencyKey,
    ),
    record.claimId,
  );
  inventoryCounts.set(
    inventoryKey(record.campaignId, record.periodKey, record.outcome.rewardId),
    getInventoryUsed(record.campaignId, record.periodKey, record.outcome.rewardId) + 1,
  );

  return { claim: record, inserted: true };
}

export function updateClaim(record: RewardClaimRecord): RewardClaimRecord {
  if (!claimsById.has(record.claimId)) {
    throw new Error(`Unknown claim ${record.claimId}`);
  }
  claimsById.set(record.claimId, record);
  return record;
}

export function upsertDiscountReservation(res: DiscountReservation): DiscountReservation {
  reservationsById.set(res.reservationId, res);
  return res;
}

export function getDiscountReservation(reservationId: string): DiscountReservation | null {
  return reservationsById.get(reservationId) ?? null;
}

export function listDiscountReservationsForAccount(accountId: string): DiscountReservation[] {
  return [...reservationsById.values()].filter((r) => r.accountId === accountId);
}

export function unlockCockpitTheme(accountId: string, themeId: string): void {
  const set = themesByAccount.get(accountId) ?? new Set<string>();
  set.add(themeId);
  themesByAccount.set(accountId, set);
}

export function listCockpitThemesForAccount(accountId: string): string[] {
  return [...(themesByAccount.get(accountId) ?? [])].sort();
}

/** Privileged: read any claim (server/admin). User-facing reads must filter by accountId. */
export function listAllClaimsForTests(): RewardClaimRecord[] {
  return [...claimsById.values()];
}
