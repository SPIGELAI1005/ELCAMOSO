/**
 * Running-specific GPS pace/speed filter.
 * Reuses the existing Drive GPS resolver (reported speed vs position delta)
 * and then rejects running-implausible jumps and poor accuracy.
 */
import {
  haversineMeters,
  resolveGpsSpeed,
  type GpsPoint,
  type GpsSpeedSource,
} from "@/lib/drive/gps-speed";

export { haversineMeters };

/** ~2:05 / km sprint. Anything faster on foot is almost certainly GPS noise. */
export const MAX_RUNNING_SPEED_MPS = 8;
const MAX_ACCURACY_M = 35;
const JUMP_MPS = 2.4;
const SPEED_TAU_S = 1.8;

export interface PaceFix {
  latitude: number;
  longitude: number;
  atMs: number;
  reportedSpeed: number | null | undefined;
  accuracyM?: number | null;
}

export interface PaceReading {
  speedMps: number;
  /** Seconds per kilometre; null when essentially stationary. */
  paceSecPerKm: number | null;
  source: GpsSpeedSource;
  accuracyM: number | null;
  point: GpsPoint | null;
  rejected: boolean;
}

export function speedToPaceSecPerKm(speedMps: number): number | null {
  if (!Number.isFinite(speedMps) || speedMps < 0.4) return null;
  return 1000 / speedMps;
}

export function formatPace(paceSecPerKm: number | null): string {
  if (paceSecPerKm == null || !Number.isFinite(paceSecPerKm) || paceSecPerKm <= 0) return "–'––";
  const total = Math.round(paceSecPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDistanceKm(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "0.00";
  return (meters / 1000).toFixed(2);
}

export class PaceFilter {
  private previous: GpsPoint | null = null;
  private smooth = 0;
  private lastT: number | null = null;

  reset(): void {
    this.previous = null;
    this.smooth = 0;
    this.lastT = null;
  }

  update(fix: PaceFix): PaceReading {
    const accuracyM = fix.accuracyM ?? null;
    const resolved = resolveGpsSpeed({
      reportedSpeed: fix.reportedSpeed,
      latitude: fix.latitude,
      longitude: fix.longitude,
      atMs: fix.atMs,
      previous: this.previous,
      accuracyM,
    });
    this.previous = resolved.point;

    let speed = resolved.speed;
    let rejected = false;
    const accuracyOk = accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= MAX_ACCURACY_M;
    if (!accuracyOk) {
      speed = this.smooth;
      rejected = true;
    }
    if (speed > MAX_RUNNING_SPEED_MPS) {
      speed = this.smooth > 0 ? this.smooth : MAX_RUNNING_SPEED_MPS;
      rejected = true;
    }
    const dtS = this.lastT == null ? 0 : Math.max(0, (fix.atMs - this.lastT) / 1000);
    this.lastT = fix.atMs;
    if (!rejected && this.smooth > 0 && Math.abs(speed - this.smooth) > JUMP_MPS && dtS < 2.5) {
      // Soft-blend a sudden jump rather than taking it raw.
      speed = this.smooth + Math.sign(speed - this.smooth) * JUMP_MPS * 0.45;
      rejected = true;
    }
    if (!rejected) {
      const a = dtS > 0 ? 1 - Math.exp(-dtS / SPEED_TAU_S) : 1;
      this.smooth += (speed - this.smooth) * a;
    }
    const filtered = Math.max(0, this.smooth);
    return {
      speedMps: filtered,
      paceSecPerKm: speedToPaceSecPerKm(filtered),
      source: resolved.source,
      accuracyM,
      point: resolved.point,
      rejected,
    };
  }
}
