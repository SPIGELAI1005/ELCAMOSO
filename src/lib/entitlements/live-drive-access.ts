import type { Entitlement } from "@/lib/entitlements/types";
import {
  beginOfflineAccessLease,
  endOfflineAccessLease,
  resetOfflineLeaseForTests,
} from "@/lib/entitlements/offline-lease";

export interface LiveDriveAccessHold {
  active: boolean;
  committedEntitlements: ReadonlySet<Entitlement>;
  accountId: string | null;
  grantedProfileIds: readonly string[];
}

const emptyHold = (): LiveDriveAccessHold => ({
  active: false,
  committedEntitlements: new Set(),
  accountId: null,
  grantedProfileIds: [],
});

let hold: LiveDriveAccessHold = emptyHold();
let pendingSettingsClamp: (() => void) | null = null;

export function resetLiveDriveAccessForTests(): void {
  hold = emptyHold();
  pendingSettingsClamp = null;
  resetOfflineLeaseForTests();
}

export function beginLiveDriveAccess(
  entitlements: readonly Entitlement[],
  opts?: {
    accountId?: string | null;
    grantedProfileIds?: readonly string[];
    now?: number;
  },
): void {
  hold = {
    active: true,
    committedEntitlements: new Set(entitlements),
    accountId: opts?.accountId ?? null,
    grantedProfileIds: [...(opts?.grantedProfileIds ?? [])],
  };
  beginOfflineAccessLease({
    accountId: opts?.accountId ?? null,
    entitlements,
    grantedProfileIds: opts?.grantedProfileIds ?? [],
    ...(opts?.now !== undefined ? { now: opts.now } : {}),
  });
}

export function endLiveDriveAccess(): void {
  hold = emptyHold();
  endOfflineAccessLease();
  const apply = pendingSettingsClamp;
  pendingSettingsClamp = null;
  apply?.();
}

export function getLiveDriveAccessHold(): LiveDriveAccessHold {
  return hold;
}

export function isLiveDriveAccessHoldActive(): boolean {
  return hold.active;
}

/** Defer settings downgrades until the current Drive session ends. */
export function deferSettingsClampUntilDriveEnds(apply: () => void): boolean {
  if (!hold.active) return false;
  pendingSettingsClamp = apply;
  return true;
}

export function mergeEntitlementsWithLiveDriveHold(
  entitlements: readonly Entitlement[],
): Entitlement[] {
  if (!hold.active || hold.committedEntitlements.size === 0) {
    return [...entitlements];
  }
  return [...new Set([...entitlements, ...hold.committedEntitlements])].sort() as Entitlement[];
}

export function hasEntitlementDuringLiveDriveHold(entitlement: Entitlement): boolean {
  return hold.active && hold.committedEntitlements.has(entitlement);
}

/** Profile grants committed at Drive start (offline lease / live hold). */
export function grantedProfileIdsDuringLiveDriveHold(): readonly string[] {
  return hold.active ? hold.grantedProfileIds : [];
}

export function hasGrantedProfileDuringLiveDriveHold(profileId: string): boolean {
  return hold.active && hold.grantedProfileIds.includes(profileId);
}
