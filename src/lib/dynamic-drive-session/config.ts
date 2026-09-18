/** Client heartbeat cadence while Dynamic Drive holds an account session lease. */
export const DYNAMIC_DRIVE_SESSION_HEARTBEAT_INTERVAL_MS = 30_000;

/** No heartbeat within this window → session is stale and may be replaced. */
export const DYNAMIC_DRIVE_SESSION_STALE_MS = 45_000;

/** Grace after last heartbeat when ending without an explicit release. */
export const DYNAMIC_DRIVE_SESSION_END_GRACE_MS = 10_000;

export const DYNAMIC_DRIVE_SESSION_CONFLICT_MESSAGE = "Dynamic Drive is active on another device.";
