import { randomUUID } from "node:crypto";

import { DYNAMIC_DRIVE_SESSION_STALE_MS } from "@/lib/dynamic-drive-session/config";

import { beforeEach, describe, expect, it } from "vitest";

import {
  DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS,
  DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS,
  DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS,
} from "@/lib/dynamic-drive-trial/config";
import {
  memoryDynamicDriveTrialRepository,
  resetDynamicDriveTrialStoreForTests,
} from "@/lib/dynamic-drive-trial/repository-memory";
import {
  DynamicDriveTrialSessionConflictError,
  DynamicDriveTrialService,
  resetDynamicDriveTrialServiceForTests,
} from "@/lib/dynamic-drive-trial/service";

const BASE = new Date("2026-06-01T12:00:00.000Z");

function advanceMs(ms: number): Date {
  return new Date(BASE.getTime() + ms);
}

describe("DynamicDriveTrialService", () => {
  let service: DynamicDriveTrialService;
  let userId: string;

  beforeEach(async () => {
    resetDynamicDriveTrialStoreForTests();
    resetDynamicDriveTrialServiceForTests();
    service = new DynamicDriveTrialService(memoryDynamicDriveTrialRepository);
    userId = await memoryDynamicDriveTrialRepository.ensureUser();
  });

  async function activateTrial(at = BASE) {
    const snapshot = await service.startPreview(userId, at);
    expect(snapshot.status).toBe("active");
    return snapshot;
  }

  it("starts trial only on explicit preview activation", async () => {
    const before = await service.getStatus(userId, BASE);
    expect(before.status).toBe("available");
    expect(before.canStartPreview).toBe(true);

    const started = await activateTrial();
    expect(started.canStartPreview).toBe(false);
    expect(started.expiresAt).toBe(BASE.getTime() + 14 * 24 * 60 * 60 * 1000);
  });

  it("exhausts allocated time with server heartbeats", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();
    await service.startDriveSession(userId, driveSessionId, BASE);

    let at = BASE;
    const chunkMs = DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS;
    const ticks = Math.ceil(DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS / (chunkMs / 1000)) + 1;

    for (let i = 0; i < ticks; i += 1) {
      at = advanceMs((i + 1) * chunkMs);
      const beat = await service.heartbeat(userId, driveSessionId, true, at);
      if (beat.snapshot.remainingSeconds <= 0) break;
    }

    const status = await service.getStatus(userId, at);
    expect(status.remainingSeconds).toBe(0);
    expect(status.status).toBe("exhausted");

    const ended = await service.endDriveSession(userId, driveSessionId, true, at);
    expect(ended.snapshot.canUseDynamicDrive).toBe(false);
  });

  it("exhausts after maximum sessions", async () => {
    await activateTrial();

    for (let i = 0; i < DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS; i += 1) {
      const id = randomUUID();
      await service.startDriveSession(userId, id, advanceMs(i * 60_000));
      await service.endDriveSession(userId, id, true, advanceMs(i * 60_000 + 1_000));
    }

    const status = await service.getStatus(userId, advanceMs(240_000));
    expect(status.usedSessions).toBe(DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS);
    expect(status.remainingSessions).toBe(0);

    await expect(
      service.startDriveSession(userId, randomUUID(), advanceMs(250_000)),
    ).rejects.toThrow(/sessions exhausted/i);
  });

  it("expires after activation window", async () => {
    await activateTrial(BASE);
    const expiredAt = new Date(BASE.getTime() + 15 * 24 * 60 * 60 * 1000);
    const status = await service.getStatus(userId, expiredAt);
    expect(status.status).toBe("expired");
    expect(status.canUseDynamicDrive).toBe(false);
  });

  it("resumes the same drive session after refresh without double-counting sessions", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();

    const first = await service.startDriveSession(userId, driveSessionId, BASE);
    expect(first.resumed).toBe(false);
    expect(first.snapshot.usedSessions).toBe(1);

    const second = await service.startDriveSession(userId, driveSessionId, advanceMs(5_000));
    expect(second.resumed).toBe(true);
    expect(second.snapshot.usedSessions).toBe(1);
  });

  it("rejects a second active device while the prior session heartbeat is fresh", async () => {
    await activateTrial();
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    await service.startDriveSession(userId, sessionA, BASE);
    await service.heartbeat(userId, sessionA, true, advanceMs(30_000));

    await expect(
      service.startDriveSession(userId, sessionB, advanceMs(60_000)),
    ).rejects.toBeInstanceOf(DynamicDriveTrialSessionConflictError);
  });

  it("allows a new session after the prior trial heartbeat goes stale", async () => {
    await activateTrial();
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    await service.startDriveSession(userId, sessionA, BASE);

    const next = await service.startDriveSession(
      userId,
      sessionB,
      advanceMs(DYNAMIC_DRIVE_SESSION_STALE_MS + 1),
    );
    expect(next.resumed).toBe(false);
    expect(next.snapshot.usedSessions).toBe(2);
    expect(next.snapshot.activeDriveSessionId).toBe(sessionB);
  });

  it("limits heartbeat loss credit to the server gap cap", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();
    await service.startDriveSession(userId, driveSessionId, BASE);

    const beat = await service.heartbeat(userId, driveSessionId, true, advanceMs(10 * 60_000));
    expect(beat.creditedSeconds).toBe(Math.floor(DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS / 1000));
  });

  it("marks converted on subscription completion", async () => {
    await activateTrial();
    const driveSessionId = randomUUID();
    await service.startDriveSession(userId, driveSessionId, BASE);

    const converted = await service.completeTrial(userId, advanceMs(30_000));
    expect(converted.status).toBe("converted");
    expect(converted.canUseDynamicDrive).toBe(false);
    expect(converted.activeDriveSessionId).toBeNull();
  });

  it("keeps basic drive viable after trial expiry (no throw on end)", async () => {
    await activateTrial(BASE);
    const driveSessionId = randomUUID();
    await service.startDriveSession(userId, driveSessionId, BASE);

    const expiredAt = new Date(BASE.getTime() + 15 * 24 * 60 * 60 * 1000);
    const ended = await service.endDriveSession(userId, driveSessionId, false, expiredAt);
    expect(ended.snapshot.status).toBe("expired");
    expect(ended.creditedSeconds).toBe(0);
  });
});
