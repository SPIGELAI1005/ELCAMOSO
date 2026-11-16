/**
 * Desktop / screenshot simulation: an effort auto-ramp and a synthetic
 * GPS route (English Garden, Munich) with effort-coloured points.
 */
import type { StoredRun, TrackPoint } from "./types";
import { averageCadence, averageEffort, averagePaceSecPerKm, effortZones, kmSplits, pathDistanceM, peakEffort } from "./track";

export const DEMO_ORIGIN = { lat: 48.1645, lon: 11.5913 };

/** 90 s walk → jog → hard push → hold → cooldown (for audio preview and slider auto-ramp). */
export function effortAtDemoTime(tSec: number, totalSec = 90): number {
  const t = Math.max(0, Math.min(totalSec, tSec));
  // 0–16 walk 18–28, 16–36 rise to jog 52, 36–50 steady jog,
  // 50–62 hard push to 90, 62–72 hold, 72–end cooldown to 18.
  const marks: Array<[number, number]> = [
    [0, 18],
    [16, 28],
    [36, 52],
    [50, 54],
    [62, 90],
    [72, 90],
    [totalSec, 18],
  ];
  for (let i = 1; i < marks.length; i++) {
    const [t1, y1] = marks[i]!;
    const [t0, y0] = marks[i - 1]!;
    if (t <= t1) {
      const u = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      const smooth = u * u * (3 - 2 * u);
      return y0 + (y1 - y0) * smooth;
    }
  }
  return marks[marks.length - 1]![1];
}

export function cadenceForEffort(effort: number): number {
  return 100 + (effort / 100) * 85;
}

export function speedForEffort(effort: number): number {
  return 1.2 + (effort / 100) * 3.0;
}

/**
 * A roughly 5 km loop around the English Garden, stretched over `durationMs`.
 * Used for desktop demo, screenshots, and end-of-run fixtures.
 */
export function buildDemoRoute(opts?: {
  start?: { lat: number; lon: number };
  durationMs?: number;
  /** Total length, metres. Default 5000. */
  distanceM?: number;
  hz?: number;
}): TrackPoint[] {
  const start = opts?.start ?? DEMO_ORIGIN;
  const durationMs = opts?.durationMs ?? 28 * 60_000;
  const distanceM = opts?.distanceM ?? 5000;
  const hz = opts?.hz ?? 1;
  const n = Math.max(8, Math.round((durationMs / 1000) * hz) + 1);
  const points: TrackPoint[] = [];
  // Organic loop: two-lobed oval with a little wobble, ~distanceM long.
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((start.lat * Math.PI) / 180);
  const radiusM = distanceM / (2 * Math.PI);
  const rx = radiusM * 1.15;
  const ry = radiusM * 0.85;
  let prev: { lat: number; lon: number } | null = null;
  let acc = 0;
  const raw: Array<{ lat: number; lon: number; t: number }> = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const ang = u * Math.PI * 2;
    const wobble = 0.08 * Math.sin(ang * 3) + 0.04 * Math.sin(ang * 5 + 0.4);
    const east = Math.cos(ang) * rx * (1 + wobble);
    const north = Math.sin(ang) * ry * (1 + wobble * 0.6);
    const lat = start.lat + north / mPerDegLat;
    const lon = start.lon + east / mPerDegLon;
    if (prev) {
      const dLat = (lat - prev.lat) * mPerDegLat;
      const dLon = (lon - prev.lon) * mPerDegLon;
      acc += Math.sqrt(dLat * dLat + dLon * dLon);
    }
    prev = { lat, lon };
    raw.push({ lat, lon, t: u });
  }
  const scale = acc > 0 ? distanceM / acc : 1;
  for (let i = 0; i < raw.length; i++) {
    const u = i / (raw.length - 1);
    const east = (raw[i]!.lon - start.lon) * mPerDegLon * scale;
    const north = (raw[i]!.lat - start.lat) * mPerDegLat * scale;
    const effort = demoEffortForProgress(u);
    const speed = speedForEffort(effort);
    points.push({
      lat: start.lat + north / mPerDegLat,
      lon: start.lon + east / mPerDegLon,
      atMs: Math.round(u * durationMs),
      effort,
      cadenceSpm: cadenceForEffort(effort),
      speedMps: speed,
      accuracyM: 8,
      source: "simulate",
    });
  }
  return points;
}

/** Stylised 5k effort profile: walk, settle, mid-run push, last-km hard, cool down. */
function demoEffortForProgress(u: number): number {
  if (u < 0.08) return 22 + (u / 0.08) * 18;
  if (u < 0.35) return 48 + 6 * Math.sin(((u - 0.08) / 0.27) * Math.PI);
  if (u < 0.5) return 55 + ((u - 0.35) / 0.15) * 25;
  if (u < 0.7) return 78 - ((u - 0.5) / 0.2) * 16;
  if (u < 0.88) return 64 + ((u - 0.7) / 0.18) * 28;
  return 90 - ((u - 0.88) / 0.12) * 55;
}

export function buildDemoRun(now = Date.now()): StoredRun {
  const durationMs = 28 * 60_000;
  const points = buildDemoRoute({ durationMs, distanceM: 5000, hz: 1 });
  // Shift timestamps onto a wall-clock start.
  const started = now - durationMs;
  const shifted = points.map((p) => ({ ...p, atMs: started + p.atMs }));
  const distanceM = pathDistanceM(shifted);
  const splits = kmSplits(shifted);
  const zones = effortZones(shifted);
  return {
    id: "demo-5k",
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(now).toISOString(),
    durationMs,
    movingMs: durationMs,
    distanceM,
    avgPaceSecPerKm: averagePaceSecPerKm(distanceM, durationMs),
    avgEffort: averageEffort(shifted),
    peakEffort: peakEffort(shifted),
    avgCadenceSpm: averageCadence(shifted),
    musicProfileId: "symphony-viral-mix",
    coachMode: "hype",
    points: shifted,
    splits,
    zones,
  };
}
