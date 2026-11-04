import { describe, expect, it } from "vitest";

import {
  createLobbyHost,
  createMotionSendGate,
  createPeerTracker,
  isSafeKey,
  PEER_STALE_MS,
  randomKey,
  reconnectDelayMs,
  RECONNECT_MAX_MS,
} from "./realtime-link";
import { PHONE_SENSOR_TICK_MS } from "../motion/phone-sensor-normalize";
import { PHONE_IMU_FRESH_MS } from "../motion/motion-fallback";

describe("drive realtime link", () => {
  it("backs off exponentially and caps", () => {
    const noJitter = () => 0;
    expect([0, 1, 2, 3, 4, 5, 10].map((a) => reconnectDelayMs(a, noJitter))).toEqual([
      1000, 2000, 4000, 8000, 15000, 15000, 15000,
    ]);
    expect(reconnectDelayMs(20, () => 1)).toBeLessThanOrEqual(RECONNECT_MAX_MS * 1.2);
  });

  it("sends ~10 Hz while moving and ~3-4 Hz while parked, never staler than IMU freshness", () => {
    const count = (sample: { speedKmh: number; accelerationLongitudinal: number }) => {
      const gate = createMotionSendGate();
      let sent = 0;
      let last = 0;
      let maxGap = 0;
      for (let t = 0; t < 10_000; t += PHONE_SENSOR_TICK_MS) {
        if (gate(t, sample)) {
          if (sent) maxGap = Math.max(maxGap, t - last);
          sent += 1;
          last = t;
        }
      }
      return { hz: sent / 10, maxGap };
    };
    const moving = count({ speedKmh: 50, accelerationLongitudinal: 1 });
    expect(moving.hz).toBeGreaterThanOrEqual(9.5);
    expect(moving.hz).toBeLessThanOrEqual(10.5);
    const parked = count({ speedKmh: 0, accelerationLongitudinal: 0 });
    expect(parked.hz).toBeLessThanOrEqual(4.1);
    expect(parked.maxGap).toBeLessThan(PHONE_IMU_FRESH_MS);
  });

  it("lobby grants once, repeats the grant for the same phone, refuses others and expiry", () => {
    const host = createLobbyHost({
      sessionId: "s1",
      channelKey: "k".repeat(32),
      claimExpiresAt: 1000,
    });
    expect(host.peek(10)).toMatchObject({ expired: false, used: false });
    const g = host.claim("phoneA", 10);
    expect(g).toMatchObject({ ok: true, sessionId: "s1", joinSecret: "k".repeat(32) });
    expect(host.claim("phoneA", 20)).toMatchObject({ ok: true });
    expect(host.claim("phoneB", 20)).toEqual({ ok: false, reason: "used" });
    const late = createLobbyHost({
      sessionId: "s2",
      channelKey: "x".repeat(32),
      claimExpiresAt: 1000,
    });
    expect(late.claim("phoneA", 2000)).toEqual({ ok: false, reason: "expired" });
  });

  it("peer tracker goes stale and forgets on bye", () => {
    const t = createPeerTracker();
    t.seen("phone", 0);
    expect(t.flags(1000).phone).toBe(true);
    expect(t.flags(PEER_STALE_MS + 1).phone).toBe(false);
    t.seen("phone", 0);
    t.forget("phone");
    expect(t.flags(1).phone).toBe(false);
  });

  it("keys are channel-safe and random", () => {
    const a = randomKey();
    expect(a).toHaveLength(32);
    expect(isSafeKey(a)).toBe(true);
    expect(a).not.toBe(randomKey());
    expect(isSafeKey("bad key:")).toBe(false);
  });
});
