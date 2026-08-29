import type { Entitlement } from "@/lib/entitlements/types";

export interface LiveDriveAccessHold {
  active: boolean;
  committedEntitlements: ReadonlySet<Entitlement>;
}

const emptyHold = (): LiveDriveAccessHold => ({
  active: false,
  committedEntitlements: new Set(),
});

let hold: LiveDriveAccessHold = emptyHold();
let pendingSettingsClamp: (() => void) | null = null;

export function resetLiveDriveAccessForTests(): void {
  hold = emptyHold();
  pendingSettingsClamp = null;
}

export function beginLiveDriveAccess(entitlements: readonly Entitlement[]): void {
  hold = {
    active: true,
    committedEntitlements: new Set(entitlements),
  };
}

export function endLiveDriveAccess(): void {
  hold = emptyHold();
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
