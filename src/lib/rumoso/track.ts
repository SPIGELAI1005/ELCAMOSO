/**
 * Route accumulation, distance, current/average pace, km splits and effort zones.
 */
import { haversineMeters } from "@/lib/drive/gps-speed";
import { EFFORT_ZONES } from "./colors";
import { speedToPaceSecPerKm } from "./gps-pace";
import type { EffortZoneShare, KmSplit, TrackPoint } from "./types";

export function appendPoint(points: TrackPoint[], next: TrackPoint, minSpacingM = 1.8): TrackPoint[] {
  const prev = points[points.length - 1];
  if (!prev) return [next];
  if (next.atMs < prev.atMs) return points;
  const d = haversineMeters(prev, next);
  if (d < minSpacingM && next.atMs - prev.atMs < 800) {
    // Refresh the last point's metrics without adding a zero-length segment.
    const copy = points.slice();
    copy[copy.length - 1] = { ...next, lat: prev.lat, lon: prev.lon };
    return copy;
  }
  copyPush(points, next);
  return points;
}

function copyPush(points: TrackPoint[], next: TrackPoint): void {
  points.push(next);
}

export function pathDistanceM(points: readonly TrackPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversineMeters(points[i - 1]!, points[i]!);
  }
  return d;
}

export function currentPaceSecPerKm(points: readonly TrackPoint[], windowSec = 25): number | null {
  if (points.length < 2) return null;
  const end = points[points.length - 1]!;
  const cutoff = end.atMs - windowSec * 1000;
  let startIdx = points.length - 2;
  while (startIdx > 0 && points[startIdx]!.atMs > cutoff) startIdx -= 1;
  const start = points[startIdx]!;
  const dt = (end.atMs - start.atMs) / 1000;
  if (dt < 4) return speedToPaceSecPerKm(end.speedMps ?? 0);
  let dist = 0;
  for (let i = startIdx + 1; i < points.length; i++) {
    dist += haversineMeters(points[i - 1]!, points[i]!);
  }
  if (dist < 8) return speedToPaceSecPerKm(end.speedMps ?? 0);
  return speedToPaceSecPerKm(dist / dt);
}

export function averagePaceSecPerKm(distanceM: number, movingMs: number): number | null {
  if (distanceM < 8 || movingMs < 1000) return null;
  return speedToPaceSecPerKm(distanceM / (movingMs / 1000));
}

export function averageEffort(points: readonly TrackPoint[]): number {
  if (points.length === 0) return 0;
  let acc = 0;
  let w = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = points[i]!.atMs - points[i - 1]!.atMs;
    if (dt <= 0) continue;
    acc += ((points[i]!.effort + points[i - 1]!.effort) / 2) * dt;
    w += dt;
  }
  if (w === 0) return points[points.length - 1]!.effort;
  return acc / w;
}

export function peakEffort(points: readonly TrackPoint[]): number {
  let p = 0;
  for (const pt of points) if (pt.effort > p) p = pt.effort;
  return p;
}

export function averageCadence(points: readonly TrackPoint[]): number | null {
  const vals = points.map((p) => p.cadenceSpm).filter((v): v is number => v != null && v > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function kmSplits(points: readonly TrackPoint[]): KmSplit[] {
  const splits: KmSplit[] = [];
  if (points.length < 2) return splits;
  let acc = 0;
  let splitStartMs = points[0]!.atMs;
  let nextKm = 1;
  let effortAcc = 0;
  let effortTime = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = haversineMeters(a, b);
    const dt = Math.max(0, b.atMs - a.atMs);
    let segUsed = 0;
    let timeUsed = 0;
    while (segUsed < seg - 1e-9) {
      const remain = 1000 - acc;
      const leftover = seg - segUsed;
      const restDt = dt - timeUsed;
      if (remain > 0 && leftover >= remain) {
        const frac = remain / leftover;
        const splitDt = restDt * frac;
        effortAcc += ((a.effort + b.effort) / 2) * splitDt;
        effortTime += splitDt;
        const endMs = a.atMs + timeUsed + splitDt;
        const durationSec = (endMs - splitStartMs) / 1000;
        splits.push({
          km: nextKm,
          durationSec,
          paceSecPerKm: durationSec,
          avgEffort: effortTime > 0 ? effortAcc / effortTime : b.effort,
          distanceM: 1000,
        });
        nextKm += 1;
        splitStartMs = endMs;
        acc = 0;
        effortAcc = 0;
        effortTime = 0;
        segUsed += remain;
        timeUsed += splitDt;
      } else {
        acc += leftover;
        effortAcc += ((a.effort + b.effort) / 2) * restDt;
        effortTime += restDt;
        break;
      }
    }
  }
  return splits;
}

export function effortZones(points: readonly TrackPoint[]): EffortZoneShare[] {
  const buckets = EFFORT_ZONES.map((z) => ({
    id: z.id,
    label: z.label,
    minEffort: z.min,
    maxEffort: z.max,
    durationMs: 0,
  }));
  for (let i = 1; i < points.length; i++) {
    const dt = points[i]!.atMs - points[i - 1]!.atMs;
    if (dt <= 0) continue;
    const e = (points[i]!.effort + points[i - 1]!.effort) / 2;
    let chosen = buckets[0]!;
    for (const b of buckets) if (e >= b.minEffort) chosen = b;
    chosen.durationMs += dt;
  }
  const total = buckets.reduce((a, b) => a + b.durationMs, 0) || 1;
  return buckets.map((b) => ({ ...b, fraction: b.durationMs / total }));
}

export function downsample(points: readonly TrackPoint[], maxPoints = 1800): TrackPoint[] {
  if (points.length <= maxPoints) return points.slice();
  const stride = points.length / maxPoints;
  const out: TrackPoint[] = [points[0]!];
  for (let i = 1; i < maxPoints - 1; i++) {
    out.push(points[Math.round(i * stride)]!);
  }
  out.push(points[points.length - 1]!);
  return out;
}

export function alongTrackAccel(prevSpeed: number | null, speed: number | null, dtS: number): number | null {
  if (prevSpeed == null || speed == null || !(dtS > 0.2)) return null;
  return (speed - prevSpeed) / dtS;
}
