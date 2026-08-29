import { expect } from "vitest";

import {
  DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS,
  DYNAMIC_DRIVE_TRIAL_EXPIRY_MS,
  DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS,
} from "@/lib/dynamic-drive-trial/config";
import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";
import { hasEntitlement } from "@/lib/entitlements/resolve";
import { resolveEntitlementUser } from "@/lib/entitlements/service";

export const TRIAL_TEST_USER_ID = "66666666-6666-4666-8666-666666666666";
export const TRIAL_SESSION_TOKEN = "trial-test-session";

/** Fixed offset from wall clock so session + trial timestamps stay aligned in tests. */
export const TRIAL_TEST_BASE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

export function advanceTrialMs(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

export function assertTrialAllocations(snapshot: DynamicDriveTrialSnapshot): void {
  expect(snapshot.allocatedSeconds).toBe(DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS);
  expect(snapshot.allocatedSessions).toBe(DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS);
  expect(snapshot.remainingSeconds).toBeGreaterThanOrEqual(0);
  expect(snapshot.remainingSessions).toBeGreaterThanOrEqual(0);
  expect(snapshot.usedSeconds).toBeGreaterThanOrEqual(0);
  expect(snapshot.usedSeconds).toBeLessThanOrEqual(snapshot.allocatedSeconds);
}

export function assertTrialNeverNegative(snapshot: DynamicDriveTrialSnapshot): void {
  expect(snapshot.remainingSeconds).toBeGreaterThanOrEqual(0);
  expect(snapshot.remainingSessions).toBeGreaterThanOrEqual(0);
  expect(snapshot.usedSeconds).toBeLessThanOrEqual(snapshot.allocatedSeconds);
  expect(snapshot.usedSessions).toBeLessThanOrEqual(snapshot.allocatedSessions);
}

export function assertTrialExpiryWindow(startedAt: number, expiresAt: number): void {
  expect(expiresAt - startedAt).toBe(DYNAMIC_DRIVE_TRIAL_EXPIRY_MS);
}

export async function assertEntitlementsForTrial(
  sessionToken: string,
  expectDynamicDrive: boolean,
  now = Date.now(),
): Promise<void> {
  const user = await resolveEntitlementUser({ sessionToken, now });
  expect(hasEntitlement(user, "dynamic_drive")).toBe(expectDynamicDrive);
  expect(hasEntitlement(user, "basic_drive")).toBe(true);
}
