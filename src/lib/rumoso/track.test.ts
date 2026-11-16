import { describe, expect, it } from "vitest";
import { haversineMeters } from "@/lib/drive/gps-speed";
import { formatDuration, formatPace, speedToPaceSecPerKm } from "./gps-pace";
import {
  averagePaceSecPerKm,
  effortZones,
  kmSplits,
  pathDistanceM,
} from "./track";
import type { TrackPoint } from "./types";

/** Eastward points at a constant speed from a Munich-ish origin. */
function runLine(opts: {
  meters: number;
  durationMs: number;
  effort: (t: number) => number;
  hz?: number;
}): TrackPoint[] {
  const start = { lat: 48.1645, lon: 11.5913 };
  // 1 deg lon ≈ 111_320 * cos(lat) m
  const mPerDegLon = 111_320 * Math.cos((start.lat * Math.PI) / 180);
  const hz = opts.hz ?? 1;
  const n = Math.max(2, Math.round((opts.durationMs / 1000) * hz) + 1);
  const points: TrackPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const dist = opts.meters * t;
    points.push({
      lat: start.lat,
      lon: start.lon + dist / mPerDegLon,
      atMs: Math.round(t * opts.durationMs),
      effort: opts.effort(t),
      cadenceSpm: 160,
      speedMps: opts.meters / (opts.durationMs / 1000),
      source: "simulate",
    });
  }
  return points;
}

describe("formatters", () => {
  it("formats pace and duration", () => {
    expect(formatPace(360)).toBe("6:00");
    expect(formatPace(330)).toBe("5:30");
    expect(formatPace(null)).toBe("–'––");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_661_000)).toBe("1:01:01");
    expect(speedToPaceSecPerKm(2.5)).toBeCloseTo(400, 0);
  });
});

describe("pathDistanceM and splits", () => {
  it("measures ~3.1 km and yields 3 full-km splits at 6:00 / km", () => {
    const points = runLine({ meters: 3100, durationMs: 18 * 60_000, effort: () => 50 });
    const dist = pathDistanceM(points);
    expect(dist).toBeGreaterThan(3070);
    expect(dist).toBeLessThan(3130);
    const splits = kmSplits(points);
    expect(splits).toHaveLength(3);
    for (const s of splits) {
      expect(s.paceSecPerKm).toBeGreaterThan(330);
      expect(s.paceSecPerKm).toBeLessThan(370);
      expect(s.avgEffort).toBeCloseTo(50, 0);
    }
    expect(averagePaceSecPerKm(dist, 18 * 60_000)).toBeCloseTo((18 * 60) / (dist / 1000), 0);
  });

  it("assigns effort zones over time", () => {
    const points = runLine({
      meters: 2000,
      durationMs: 10 * 60_000,
      effort: (t) => (t < 0.5 ? 20 : 85),
    });
    const zones = effortZones(points);
    const walk = zones.find((z) => z.id === "walk")!;
    const hard = zones.find((z) => z.id === "hard")!;
    expect(walk.fraction).toBeGreaterThan(0.35);
    expect(hard.fraction).toBeGreaterThan(0.35);
    expect(zones.reduce((a, z) => a + z.fraction, 0)).toBeCloseTo(1, 5);
  });
});

describe("haversine sanity via path", () => {
  it("a 1 km east hop is about 1000 m", () => {
    const a = { lat: 48.1645, lon: 11.5913 };
    const mPerDegLon = 111_320 * Math.cos((a.lat * Math.PI) / 180);
    const b = { lat: a.lat, lon: a.lon + 1000 / mPerDegLon };
    expect(haversineMeters(a, b)).toBeGreaterThan(990);
    expect(haversineMeters(a, b)).toBeLessThan(1010);
  });
});
