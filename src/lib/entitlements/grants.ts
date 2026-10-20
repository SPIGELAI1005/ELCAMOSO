import { randomUUID } from "node:crypto";

import type { Entitlement } from "@/lib/entitlements/types";

/**
 * Durable user-owned grants (purchased / grandfathered / temporary rewards).
 * Clients may read their own grants; they cannot write premium entitlements.
 * Server/admin/reward fulfilment are the only writers.
 */

export type EntitlementGrantKind =
  | "purchased_profile"
  | "grandfathered_profile"
  | "reward_profile"
  | "reward_entitlement"
  | "admin_profile"
  | "admin_entitlement"
  | "promo_profile"
  | "promo_entitlement";

export interface EntitlementGrant {
  id: string;
  accountId: string;
  kind: EntitlementGrantKind;
  /** Profile unlock when kind targets a Sound Profile. */
  profileId: string | null;
  /** Capability unlock when kind targets an entitlement. */
  entitlement: Entitlement | null;
  /** UTC epoch ms; null = permanent. Comparisons use UTC ms throughout. */
  expiresAt: number | null;
  createdAt: number;
  /** Non-secret provenance label (e.g. stripe_line_item, campaign_id). */
  source: string | null;
}

const grantsById = new Map<string, EntitlementGrant>();
const grantsByAccount = new Map<string, Set<string>>();

export function resetEntitlementGrantsForTests(): void {
  grantsById.clear();
  grantsByAccount.clear();
}

function indexGrant(grant: EntitlementGrant): void {
  grantsById.set(grant.id, grant);
  const set = grantsByAccount.get(grant.accountId) ?? new Set<string>();
  set.add(grant.id);
  grantsByAccount.set(grant.accountId, set);
}

function unindexGrant(grant: EntitlementGrant): void {
  grantsById.delete(grant.id);
  const set = grantsByAccount.get(grant.accountId);
  if (!set) return;
  set.delete(grant.id);
  if (set.size === 0) grantsByAccount.delete(grant.accountId);
}

export function isGrantActive(grant: EntitlementGrant, now = Date.now()): boolean {
  if (grant.expiresAt == null) return true;
  return grant.expiresAt > now;
}

/** Idempotent upsert by grant id (preferred) or (accountId, kind, profileId|entitlement). */
export function upsertEntitlementGrant(
  input: Omit<EntitlementGrant, "id" | "createdAt"> & { id?: string; createdAt?: number },
): EntitlementGrant {
  if (input.id) {
    const byId = grantsById.get(input.id);
    if (byId) {
      const next: EntitlementGrant = {
        ...byId,
        expiresAt: input.expiresAt,
        source: input.source,
        kind: input.kind,
        profileId: input.profileId,
        entitlement: input.entitlement,
      };
      indexGrant(next);
      return next;
    }
  }

  const existing = listGrantsForAccount(input.accountId, Number.MAX_SAFE_INTEGER).find((g) => {
    if (g.kind !== input.kind) return false;
    if (input.profileId) return g.profileId === input.profileId;
    if (input.entitlement) return g.entitlement === input.entitlement;
    return false;
  });

  if (existing) {
    const next: EntitlementGrant = {
      ...existing,
      expiresAt: input.expiresAt,
      source: input.source,
    };
    indexGrant(next);
    return next;
  }

  const grant: EntitlementGrant = {
    id: input.id ?? randomUUID(),
    accountId: input.accountId,
    kind: input.kind,
    profileId: input.profileId,
    entitlement: input.entitlement,
    expiresAt: input.expiresAt,
    createdAt: input.createdAt ?? Date.now(),
    source: input.source,
  };
  indexGrant(grant);
  return grant;
}

export function listGrantsForAccount(accountId: string, now = Date.now()): EntitlementGrant[] {
  const ids = grantsByAccount.get(accountId);
  if (!ids) return [];
  const out: EntitlementGrant[] = [];
  for (const id of ids) {
    const grant = grantsById.get(id);
    if (!grant) continue;
    if (!isGrantActive(grant, now)) continue;
    out.push(grant);
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

export function activeGrantedProfileIds(accountId: string, now = Date.now()): string[] {
  return listGrantsForAccount(accountId, now)
    .filter((g) => g.profileId)
    .map((g) => g.profileId!);
}

export function activeGrantedEntitlements(accountId: string, now = Date.now()): Entitlement[] {
  return listGrantsForAccount(accountId, now)
    .filter((g) => g.entitlement)
    .map((g) => g.entitlement!);
}

/** All grants for an account, including expired ones (durable write-through). */
export function listAllGrantsForAccount(accountId: string): EntitlementGrant[] {
  const ids = grantsByAccount.get(accountId);
  if (!ids) return [];
  return [...ids].map((id) => grantsById.get(id)).filter((g): g is EntitlementGrant => Boolean(g));
}

/** Replace the cached grants for an account with a durable snapshot (Postgres hydrate). */
export function replaceGrantsForAccount(accountId: string, grants: EntitlementGrant[]): void {
  for (const grant of listAllGrantsForAccount(accountId)) unindexGrant(grant);
  for (const grant of grants) indexGrant({ ...grant, accountId });
}

export function revokeEntitlementGrant(grantId: string): boolean {
  const grant = grantsById.get(grantId);
  if (!grant) return false;
  unindexGrant(grant);
  return true;
}

/** Test / migration fixture helper — seed grandfathered ownership. */
export function seedGrandfatheredProfileGrant(
  accountId: string,
  profileId: string,
  source = "grandfathered_import",
): EntitlementGrant {
  return upsertEntitlementGrant({
    accountId,
    kind: "grandfathered_profile",
    profileId,
    entitlement: null,
    expiresAt: null,
    source,
  });
}
