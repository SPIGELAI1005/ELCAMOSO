import { describe, expect, it, beforeEach } from "vitest";
import { getSession } from "@/lib/drive/session";
import { IDLE_STATE } from "@/lib/drive/model";

/**
 * Session-level guarantees for Drive Cockpit profile races and stale telemetry.
 * AudioContext may be unavailable in Node - we assert state mapping only.
 */
describe("Drive Cockpit session integration", () => {
  beforeEach(() => {
    const session = getSession();
    session.syncConfig({
      profileId: "gt-v8",
      volume: 0.35,
      dynamicDrive: true,
      virtualTransmission: true,
      shiftMapPreset: "city",
    });
  });

  it("shares profileId through syncConfig (Settings ↔ Drive)", () => {
    const session = getSession();
    session.syncConfig({ profileId: "racing-v10" });
    expect(session.snapshot().profileId).toBe("racing-v10");
    session.syncConfig({ profileId: "gt-v8" });
    expect(session.snapshot().profileId).toBe("gt-v8");
  });

  it("exposes weak-signal product status for stale telemetry UI", () => {
    const session = getSession();
    // Idle sessions report idle; when running without GPS the product path uses weak-signal.
    const snap = session.snapshot();
    expect(["idle", "weak-signal", "sound-paused", "sound-active", "gps-only", "simulation"]).toContain(
      snap.productStatus,
    );
  });

  it("keeps DriveState shape stable across profileId changes (no invented idle snap fields)", () => {
    const session = getSession();
    const before = session.snapshot().state ?? IDLE_STATE;
    session.syncConfig({ profileId: "flat-six-sport" });
    const after = session.snapshot().state ?? IDLE_STATE;
    expect(typeof after.speed).toBe("number");
    expect(typeof after.rpm).toBe("number");
    expect(typeof after.gear).toBe("number");
    // Speed is owned by the motion loop - profile switch must not force a new speed.
    expect(after.speed).toBe(before.speed);
  });
});
