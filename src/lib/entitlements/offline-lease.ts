import type { Entitlement } from "@/lib/entitlements/types";
import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";

/**
 * Bounded offline / session lease for already-authorized playback.
 *
 * - Issued at drive start (or explicit revalidation) from a fresh server snapshot.
 * - Does not extend rights past `expiresAtUtc`.
 * - On expiry during an active drive: fade to a free profile (no modal, no blast).
 * - Account switching invalidates the previous user's lease immediately.
 */

/** Max wall-clock lease lifetime (UTC). Revalidate on reconnect sooner when online. */
export const OFFLINE_LEASE_MAX_MS = 72 * 60 * 60 * 1000;

/** Recommended revalidation interval while online. */
export const OFFLINE_LEASE_REVALIDATE_MS = 15 * 60 * 1000;

export type OfflineLeaseExpiryPolicy = "fade_to_free" | "stop";

/** Documented product policy when authorization expires mid-drive. */
export const OFFLINE_LEASE_EXPIRY_POLICY: OfflineLeaseExpiryPolicy = "fade_to_free";

export interface OfflineAccessLease {
  accountId: string | null;
  entitlements: readonly Entitlement[];
  grantedProfileIds: readonly string[];
  issuedAtUtc: number;
  expiresAtUtc: number;
}

export interface OfflineLeaseExpiryAction {
  policy: OfflineLeaseExpiryPolicy;
  fallbackProfileId: string;
  /** True when the lease is past expiresAtUtc or account mismatch. */
  expired: boolean;
}

let lease: OfflineAccessLease | null = null;

export function resetOfflineLeaseForTests(): void {
  lease = null;
}

export function getOfflineAccessLease(): OfflineAccessLease | null {
  return lease;
}

export function beginOfflineAccessLease(input: {
  accountId: string | null;
  entitlements: readonly Entitlement[];
  grantedProfileIds?: readonly string[];
  now?: number;
  maxMs?: number;
}): OfflineAccessLease {
  const now = input.now ?? Date.now();
  const maxMs = Math.min(input.maxMs ?? OFFLINE_LEASE_MAX_MS, OFFLINE_LEASE_MAX_MS);
  lease = {
    accountId: input.accountId,
    entitlements: [...input.entitlements],
    grantedProfileIds: [...(input.grantedProfileIds ?? [])],
    issuedAtUtc: now,
    expiresAtUtc: now + maxMs,
  };
  return lease;
}

export function revalidateOfflineAccessLease(input: {
  accountId: string | null;
  entitlements: readonly Entitlement[];
  grantedProfileIds?: readonly string[];
  now?: number;
  maxMs?: number;
}): OfflineAccessLease {
  return beginOfflineAccessLease(input);
}

export function endOfflineAccessLease(): void {
  lease = null;
}

export function isOfflineAccessLeaseValid(
  now = Date.now(),
  accountId?: string | null,
): boolean {
  if (!lease) return false;
  if (lease.expiresAtUtc <= now) return false;
  if (accountId !== undefined && lease.accountId !== accountId) return false;
  return true;
}

/**
 * Call when the signed-in account changes. Immediately drops prior-user grants
 * from the local lease cache.
 */
export function invalidateOfflineLeaseOnAccountSwitch(nextAccountId: string | null): void {
  if (!lease) return;
  if (lease.accountId !== nextAccountId) {
    lease = null;
  }
}

export function resolveOfflineLeaseExpiryAction(
  now = Date.now(),
  accountId?: string | null,
): OfflineLeaseExpiryAction {
  const expired = !isOfflineAccessLeaseValid(now, accountId);
  return {
    policy: OFFLINE_LEASE_EXPIRY_POLICY,
    fallbackProfileId: FALLBACK_SOUND_PROFILE_ID,
    expired,
  };
}
