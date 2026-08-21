import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  resolveGpsSpeed,
  speedFromDelta,
  type GpsPoint,
} from "./gps-speed";

describe("haversineMeters", () => {
  it("is ~0 for identical points", () => {
    expect(haversineMeters({ lat: 48.1, lon: 11.5 }, { lat: 48.1, lon: 11.5 })).toBeCloseTo(
      0,
      5,
    );
  });

  it("measures a short eastward hop in Munich-ish coords", () => {
    // ~111 m per 0.001° lon near 48°N is exaggerated; use known ~50 m step.
    const a = { lat: 48.137, lon: 11.575 };
    const b = { lat: 48.137, lon: 11.5757 };
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(40);
    expect(d).toBeLessThan(80);
  });
});

describe("speedFromDelta", () => {
  const base: GpsPoint = { lat: 48.137, lon: 11.575, atMs: 1_000 };

  it("returns null when dt is too short", () => {
    const next = { ...base, lon: 11.5757, atMs: 1_100 };
    expect(speedFromDelta(base, next)).toBeNull();
  });

  it("derives a plausible speed over 1s", () => {
    const next = { lat: 48.137, lon: 11.5757, atMs: 2_000 };
    const speed = speedFromDelta(base, next);
    expect(speed).not.toBeNull();
    expect(speed!).toBeGreaterThan(40);
    expect(speed!).toBeLessThan(80);
  });
});

describe("resolveGpsSpeed", () => {
  it("prefers reported speed when finite", () => {
    const r = resolveGpsSpeed({
      reportedSpeed: 12.5,
      latitude: 48.1,
      longitude: 11.5,
      atMs: 5_000,
      previous: null,
    });
    expect(r.source).toBe("reported");
    expect(r.speed).toBe(12.5);
    expect(r.point?.lat).toBe(48.1);
  });

  it("treats null reported speed as missing (not zero)", () => {
    const prev: GpsPoint = { lat: 48.137, lon: 11.575, atMs: 1_000 };
    const r = resolveGpsSpeed({
      reportedSpeed: null,
      latitude: 48.137,
      longitude: 11.5757,
      atMs: 2_000,
      previous: prev,
    });
    expect(r.source).toBe("delta");
    expect(r.speed).toBeGreaterThan(40);
  });

  it("does not treat explicit 0 as missing", () => {
    const r = resolveGpsSpeed({
      reportedSpeed: 0,
      latitude: 48.1,
      longitude: 11.5,
      atMs: 5_000,
      previous: null,
    });
    expect(r.source).toBe("reported");
    expect(r.speed).toBe(0);
  });

  it("rejects delta when accuracy is very poor", () => {
    const prev: GpsPoint = { lat: 48.137, lon: 11.575, atMs: 1_000 };
    const r = resolveGpsSpeed({
      reportedSpeed: null,
      latitude: 48.137,
      longitude: 11.5757,
      atMs: 2_000,
      previous: prev,
      accuracyM: 120,
    });
    expect(r.source).toBe("none");
    expect(r.speed).toBe(0);
  });
});
