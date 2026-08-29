import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DYNAMIC_DRIVE_SESSION_HEARTBEAT_INTERVAL_MS,
  DYNAMIC_DRIVE_SESSION_STALE_MS,
} from "@/lib/dynamic-drive-session/config";
import {
  getDynamicDriveSessionService,
  resetDynamicDriveSessionServiceForTests,
} from "@/lib/dynamic-drive-session/service";
import { resetDynamicDriveSessionStoreForTests } from "@/lib/dynamic-drive-session/store";

const BASE = Date.parse("2026-08-29T12:00:00.000Z");
const userId = randomUUID();

function advanceMs(ms: number): number {
  return BASE + ms;
}

describe("DynamicDriveSessionService", () => {
  beforeEach(() => {
    resetDynamicDriveSessionStoreForTests();
    resetDynamicDriveSessionServiceForTests();
  });

  afterEach(() => {
    resetDynamicDriveSessionStoreForTests();
    resetDynamicDriveSessionServiceForTests();
  });

  it("claims a session for the first device", async () => {
    const service = getDynamicDriveSessionService();
    const driveSessionId = randomUUID();

    const claim = await service.claimSession({
      userId,
      driveSessionId,
      now: BASE,
    });

    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.resumed).toBe(false);
    expect(claim.snapshot.activeDriveSessionId).toBe(driveSessionId);
  });

  it("resumes the same drive session without conflict", async () => {
    const service = getDynamicDriveSessionService();
    const driveSessionId = randomUUID();

    await service.claimSession({ userId, driveSessionId, now: BASE });
    const resumed = await service.claimSession({
      userId,
      driveSessionId,
      relaySessionId: "relay_1",
      now: advanceMs(5_000),
    });

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.resumed).toBe(true);
    expect(resumed.snapshot.relaySessionId).toBe("relay_1");
  });

  it("returns conflict when another device has a fresh heartbeat", async () => {
    const service = getDynamicDriveSessionService();
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    await service.claimSession({ userId, driveSessionId: sessionA, now: BASE });
    await service.heartbeat({
      userId,
      driveSessionId: sessionA,
      now: advanceMs(DYNAMIC_DRIVE_SESSION_HEARTBEAT_INTERVAL_MS),
    });

    const conflict = await service.claimSession({
      userId,
      driveSessionId: sessionB,
      now: advanceMs(DYNAMIC_DRIVE_SESSION_HEARTBEAT_INTERVAL_MS + 1_000),
    });

    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.reason).toBe("conflict");
    expect(conflict.message).toContain("another device");
    expect(conflict.snapshot.activeDriveSessionId).toBe(sessionA);
  });

  it("allows a new claim after the prior session goes stale", async () => {
    const service = getDynamicDriveSessionService();
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    await service.claimSession({ userId, driveSessionId: sessionA, now: BASE });

    const next = await service.claimSession({
      userId,
      driveSessionId: sessionB,
      now: advanceMs(DYNAMIC_DRIVE_SESSION_STALE_MS + 1),
    });

    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.snapshot.activeDriveSessionId).toBe(sessionB);
  });

  it("releases the active lease for the current tab", async () => {
    const service = getDynamicDriveSessionService();
    const driveSessionId = randomUUID();

    await service.claimSession({ userId, driveSessionId, now: BASE });
    const released = await service.releaseSession({
      userId,
      driveSessionId,
      now: advanceMs(1_000),
    });

    expect(released.snapshot.activeDriveSessionId).toBeNull();
  });
});
