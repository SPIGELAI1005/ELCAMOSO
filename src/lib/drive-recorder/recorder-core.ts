/**
 * Drive sensor recorder (music plan, Phase 0).
 * Pure, DOM-free logic: buffering, downsampling, rate stats, derived signals and export.
 */
import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { getProfile } from "@/lib/sound/profiles";

export const DRIVE_LOG_FORMAT = "elcamoso-drive-log/v1";
export const MOTION_MAX_HZ = 20;
export const ORIENTATION_MAX_HZ = 10;
export const RATE_WINDOW_MS = 5000;

export type SensorKey = "gps" | "motion" | "orientation";

/** [t, lat, lon, accuracy, speed|null, heading|null, altitude|null, altitudeAccuracy|null, gpsTimestamp] */
export type GpsRow = [
  number,
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number,
];
/** [t, ax, ay, az, agx, agy, agz, rotAlpha, rotBeta, rotGamma, intervalMs] (null when not provided) */
export type MotionRow = (number | null)[];
/** [t, alpha, beta, gamma, absolute(0/1)] */
export type OrientationRow = (number | null)[];
/** [t, speedMs, accelMs2, throttle, regen, load, state] */
export type DerivedRow = [number, number, number, number, number, number, DrivingState];
export interface RecorderEvent {
  t: number;
  type: string;
  detail?: unknown;
}

export type DrivingState = "stopped" | "crawl" | "city" | "road" | "highway";

export function classifyDrivingState(speedMs: number): DrivingState {
  const kmh = speedMs * 3.6;
  if (kmh < 2) return "stopped";
  if (kmh < 15) return "crawl";
  if (kmh < 55) return "city";
  if (kmh < 90) return "road";
  return "highway";
}

const r = (v: number | null | undefined, d: number): number | null => {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

export interface GpsInput {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  timestamp: number;
}

export interface MotionInput {
  acceleration?: { x: number | null; y: number | null; z: number | null } | null;
  accelerationIncludingGravity?: { x: number | null; y: number | null; z: number | null } | null;
  rotationRate?: { alpha: number | null; beta: number | null; gamma: number | null } | null;
  interval?: number | null;
}

export interface OrientationInput {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute?: boolean;
}

export interface SensorLiveStatus {
  /** events delivered to the page (before downsampling) in the last window, per second */
  rateHz: number;
  totalEvents: number;
  storedSamples: number;
  lastEventAgoMs: number | null;
  /** true when the last event carried real numbers (some browsers fire events with nulls) */
  hasValues: boolean;
}

export interface DriveLog {
  format: typeof DRIVE_LOG_FORMAT;
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  environment: Record<string, unknown>;
  permissions: Record<string, string>;
  summary: Record<
    SensorKey,
    { totalEvents: number; storedSamples: number; avgRateHz: number; hasValues: boolean }
  > & {
    gpsSpeedProvided: number;
    gpsHeadingProvided: number;
    maxSpeedKmh: number;
  };
  columns: Record<string, string[]>;
  gps: GpsRow[];
  motion: MotionRow[];
  orientation: OrientationRow[];
  derived: DerivedRow[];
  events: RecorderEvent[];
}

export class DriveRecorderCore {
  readonly id: string;
  readonly startEpoch: number;
  endEpoch: number | null = null;
  environment: Record<string, unknown> = {};
  permissions: Record<string, string> = {};
  gps: GpsRow[] = [];
  motion: MotionRow[] = [];
  orientation: OrientationRow[] = [];
  derived: DerivedRow[] = [];
  events: RecorderEvent[] = [];

  private recent: Record<SensorKey, number[]> = { gps: [], motion: [], orientation: [] };
  private totals: Record<SensorKey, number> = { gps: 0, motion: 0, orientation: 0 };
  private lastAt: Record<SensorKey, number | null> = { gps: null, motion: null, orientation: null };
  private hasValues: Record<SensorKey, boolean> = { gps: false, motion: false, orientation: false };
  private lastStoredMotion = -Infinity;
  private lastStoredOrientation = -Infinity;
  private driveState: DriveState = IDLE_STATE;
  private lastSpeed: { t: number; v: number } | null = null;
  private profile = getProfile(null);

  constructor(opts: { id?: string; startEpoch?: number } = {}) {
    this.startEpoch = opts.startEpoch ?? Date.now();
    this.id = opts.id ?? `drive-${new Date(this.startEpoch).toISOString().replace(/[:.]/g, "-")}`;
  }

  /** ms since recording start */
  rel(nowEpoch: number): number {
    return Math.round(nowEpoch - this.startEpoch);
  }

  private tick(key: SensorKey, t: number, hasValues: boolean) {
    this.totals[key] += 1;
    this.lastAt[key] = t;
    this.hasValues[key] = this.hasValues[key] || hasValues;
    const arr = this.recent[key];
    arr.push(t);
    while (arr.length && arr[0]! < t - RATE_WINDOW_MS) arr.shift();
  }

  addEvent(nowEpoch: number, type: string, detail?: unknown) {
    this.events.push(
      detail === undefined
        ? { t: this.rel(nowEpoch), type }
        : { t: this.rel(nowEpoch), type, detail },
    );
  }

  addGps(nowEpoch: number, p: GpsInput) {
    const t = this.rel(nowEpoch);
    this.tick("gps", t, Number.isFinite(p.latitude));
    this.gps.push([
      t,
      r(p.latitude, 6) ?? 0,
      r(p.longitude, 6) ?? 0,
      r(p.accuracy, 1) ?? 0,
      r(p.speed, 2),
      r(p.heading, 1),
      r(p.altitude, 1),
      r(p.altitudeAccuracy, 1),
      Math.round(p.timestamp),
    ]);
    if (p.speed !== null && Number.isFinite(p.speed)) this.addDerived(t, Math.max(0, p.speed));
  }

  private addDerived(t: number, speed: number) {
    let accel = 0;
    let dt = 1;
    if (this.lastSpeed) {
      dt = Math.max(0.05, (t - this.lastSpeed.t) / 1000);
      accel = (speed - this.lastSpeed.v) / dt;
    }
    this.lastSpeed = { t, v: speed };
    try {
      this.driveState = computeDriveState({
        speed,
        acceleration: accel,
        previous: this.driveState,
        profile: this.profile,
        dt,
      });
    } catch {
      /* derived signals are best-effort */
    }
    const s = this.driveState;
    this.derived.push([
      t,
      r(speed, 2)!,
      r(accel, 2)!,
      r(s.throttle, 3)!,
      r(s.regen, 3)!,
      r(s.load, 3)!,
      classifyDrivingState(speed),
    ]);
  }

  addMotion(nowEpoch: number, m: MotionInput) {
    const t = this.rel(nowEpoch);
    const a = m.acceleration;
    const g = m.accelerationIncludingGravity;
    const rr = m.rotationRate;
    const has = [a?.x, g?.x, rr?.alpha].some((v) => typeof v === "number" && Number.isFinite(v));
    this.tick("motion", t, has);
    if (t - this.lastStoredMotion < 1000 / MOTION_MAX_HZ - 1) return;
    this.lastStoredMotion = t;
    this.motion.push([
      t,
      r(a?.x, 2),
      r(a?.y, 2),
      r(a?.z, 2),
      r(g?.x, 2),
      r(g?.y, 2),
      r(g?.z, 2),
      r(rr?.alpha, 1),
      r(rr?.beta, 1),
      r(rr?.gamma, 1),
      r(m.interval ?? null, 1),
    ]);
  }

  addOrientation(nowEpoch: number, o: OrientationInput) {
    const t = this.rel(nowEpoch);
    const has = [o.alpha, o.beta, o.gamma].some((v) => typeof v === "number" && Number.isFinite(v));
    this.tick("orientation", t, has);
    if (t - this.lastStoredOrientation < 1000 / ORIENTATION_MAX_HZ - 1) return;
    this.lastStoredOrientation = t;
    this.orientation.push([t, r(o.alpha, 1), r(o.beta, 1), r(o.gamma, 1), o.absolute ? 1 : 0]);
  }

  status(nowEpoch: number): Record<SensorKey, SensorLiveStatus> {
    const t = this.rel(nowEpoch);
    const one = (key: SensorKey, stored: number): SensorLiveStatus => {
      const recent = this.recent[key].filter((x) => x >= t - RATE_WINDOW_MS);
      const windowS = Math.min(RATE_WINDOW_MS, Math.max(1000, t)) / 1000;
      const last = this.lastAt[key];
      return {
        rateHz: Math.round((recent.length / windowS) * 10) / 10,
        totalEvents: this.totals[key],
        storedSamples: stored,
        lastEventAgoMs: last === null ? null : t - last,
        hasValues: this.hasValues[key],
      };
    };
    return {
      gps: one("gps", this.gps.length),
      motion: one("motion", this.motion.length),
      orientation: one("orientation", this.orientation.length),
    };
  }

  latestDerived(): DerivedRow | null {
    return this.derived[this.derived.length - 1] ?? null;
  }

  stop(nowEpoch: number) {
    this.endEpoch = nowEpoch;
    this.addEvent(nowEpoch, "stop");
  }

  toLog(nowEpoch: number = this.endEpoch ?? Date.now()): DriveLog {
    const durationMs = Math.max(0, Math.round((this.endEpoch ?? nowEpoch) - this.startEpoch));
    const secs = Math.max(1, durationMs / 1000);
    const sum = (key: SensorKey, stored: number) => ({
      totalEvents: this.totals[key],
      storedSamples: stored,
      avgRateHz: Math.round((this.totals[key] / secs) * 100) / 100,
      hasValues: this.hasValues[key],
    });
    const speeds = this.gps.map((g) => g[4]).filter((v): v is number => v !== null);
    return {
      format: DRIVE_LOG_FORMAT,
      id: this.id,
      startedAt: new Date(this.startEpoch).toISOString(),
      endedAt: this.endEpoch ? new Date(this.endEpoch).toISOString() : null,
      durationMs,
      environment: this.environment,
      permissions: this.permissions,
      summary: {
        gps: sum("gps", this.gps.length),
        motion: sum("motion", this.motion.length),
        orientation: sum("orientation", this.orientation.length),
        gpsSpeedProvided: speeds.length,
        gpsHeadingProvided: this.gps.filter((g) => g[5] !== null).length,
        maxSpeedKmh: Math.round(Math.max(0, ...speeds) * 3.6 * 10) / 10,
      },
      columns: {
        gps: [
          "tMs",
          "lat",
          "lon",
          "accuracyM",
          "speedMs",
          "headingDeg",
          "altitudeM",
          "altitudeAccuracyM",
          "gpsTimestamp",
        ],
        motion: [
          "tMs",
          "ax",
          "ay",
          "az",
          "agx",
          "agy",
          "agz",
          "rotAlpha",
          "rotBeta",
          "rotGamma",
          "intervalMs",
        ],
        orientation: ["tMs", "alpha", "beta", "gamma", "absolute"],
        derived: ["tMs", "speedMs", "accelMs2", "throttle", "regen", "load", "drivingState"],
      },
      gps: this.gps,
      motion: this.motion,
      orientation: this.orientation,
      derived: this.derived,
      events: this.events,
    };
  }

  /** Rebuild from a persisted log (crash/reload recovery). */
  static fromLog(log: DriveLog): DriveRecorderCore {
    const c = new DriveRecorderCore({ id: log.id, startEpoch: Date.parse(log.startedAt) });
    c.endEpoch = log.endedAt ? Date.parse(log.endedAt) : null;
    c.environment = log.environment;
    c.permissions = log.permissions;
    c.gps = log.gps;
    c.motion = log.motion;
    c.orientation = log.orientation;
    c.derived = log.derived;
    c.events = log.events;
    for (const k of ["gps", "motion", "orientation"] as SensorKey[]) {
      c.totals[k] = log.summary?.[k]?.totalEvents ?? 0;
      c.hasValues[k] = log.summary?.[k]?.hasValues ?? false;
    }
    return c;
  }
}

export function driveLogFileName(log: Pick<DriveLog, "id">): string {
  return `${log.id}.json`;
}

/** Server-side guard: safe pathname for Vercel Blob. */
export function driveLogBlobPath(id: string, now = new Date()): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "drive";
  const day = now.toISOString().slice(0, 10);
  return `drive-logs/${day}/${safe}.json.gz`;
}

export const DRIVE_LOG_MAX_UPLOAD_BYTES = 4_000_000;
