import { describe, expect, it } from "vitest";

import {
  chooseAltitude,
  fuseAcceleration,
  readPhoneSample,
  reportPhoneSample,
  clearPhoneSample,
} from "./fusion";
import { MotionEstimator } from "./motion";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  PHONE_STALE_MS,
  channelNameForCode,
  formatPairCode,
  generatePairCode,
  normalizePairCode,
  parsePhoneSample,
} from "./protocol";

describe("pair code", () => {
  it("generates unguessable codes from the safe alphabet", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const c = generatePairCode();
      expect(c).toHaveLength(CODE_LENGTH);
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
      seen.add(c);
    }
    expect(seen.size).toBe(500);
  });
  it("normalizes typed input", () => {
    const c = generatePairCode();
    expect(normalizePairCode(formatPairCode(c).toLowerCase())).toBe(c);
    expect(normalizePairCode("abc")).toBeNull();
    expect(channelNameForCode(c)).toContain(c);
  });
});

describe("parsePhoneSample", () => {
  it("rejects junk and clamps out-of-range fields to null", () => {
    expect(parsePhoneSample(null)).toBeNull();
    expect(parsePhoneSample({ altitude: 3 })).toBeNull();
    const s = parsePhoneSample({ t: 1, altitude: 99999, speed: 10, longAccel: "x" })!;
    expect(s.altitude).toBeNull();
    expect(s.speed).toBe(10);
    expect(s.longAccel).toBeNull();
  });
});

describe("fusion", () => {
  it("prefers phone altitude when more accurate or car has none", () => {
    expect(
      chooseAltitude({ altitude: null, accuracy: null }, { altitude: 200, accuracy: 8 }).altitude,
    ).toBe(200);
    expect(
      chooseAltitude({ altitude: 100, accuracy: 30 }, { altitude: 200, accuracy: 8 }).altitude,
    ).toBe(200);
    expect(
      chooseAltitude({ altitude: 100, accuracy: 5 }, { altitude: 200, accuracy: 8 }).altitude,
    ).toBe(100);
    expect(chooseAltitude({ altitude: 100, accuracy: 5 }, null).altitude).toBe(100);
  });
  it("lets strong phone accel events lead, otherwise keeps car in charge", () => {
    expect(fuseAcceleration(0.2, -5)).toBeLessThan(-3);
    expect(fuseAcceleration(1, 0.5)).toBeCloseTo(0.85);
    expect(fuseAcceleration(1, null)).toBe(1);
  });
  it("falls back to car data when the phone goes stale", () => {
    reportPhoneSample(parsePhoneSample({ t: 1, altitude: 10 })!, 1000);
    expect(readPhoneSample(1000 + 100)).not.toBeNull();
    expect(readPhoneSample(1000 + PHONE_STALE_MS + 1)).toBeNull();
    clearPhoneSample();
    expect(readPhoneSample(1000)).toBeNull();
  });
});

describe("MotionEstimator", () => {
  it("learns forward axis from GPS and reports braking sign", () => {
    const e = new MotionEstimator();
    const g: [number, number, number] = [0, 0, 9.81];
    for (let i = 0; i < 100; i++) e.push(g, [0, 0, 0], 1 / 60);
    // speeding up along +y
    e.learnForward(2, [0, 2, 9.81]);
    expect(e.hasForward()).toBe(true);
    for (let i = 0; i < 60; i++) e.push([0, -3, 9.81], [0, -3, 0], 1 / 60);
    expect(e.read().longAccel!).toBeLessThan(-2);
  });
});
