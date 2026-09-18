/** Dynamic Drive preview trial - ELCAMOSO-native, not Stripe. */
export const DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS = 1800;
export const DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS = 3;
export const DYNAMIC_DRIVE_TRIAL_EXPIRY_DAYS = 14;

/** Expected client heartbeat cadence while Dynamic Drive is active. */
export const DYNAMIC_DRIVE_TRIAL_HEARTBEAT_INTERVAL_MS = 30_000;

/** Max elapsed time credited per heartbeat/end gap (prevents clock manipulation / tab background abuse). */
export const DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS = 45_000;

/** Grace window after last heartbeat when ending a session without a final tick. */
export const DYNAMIC_DRIVE_TRIAL_END_GRACE_MS = 10_000;

export const DYNAMIC_DRIVE_TRIAL_EXPIRY_MS = DYNAMIC_DRIVE_TRIAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export function dynamicDriveTrialExpiresAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + DYNAMIC_DRIVE_TRIAL_EXPIRY_MS);
}
