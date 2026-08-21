/**
 * Resolve vehicle speed (m/s) from a GeolocationPosition.
 * Prefer coords.speed when the browser provides it; otherwise derive from
 * successive lat/lon fixes (common on phones / in-car browsers that omit speed).
 */

export interface GpsPoint {
  lat: number;
  lon: number;
  atMs: number;
}

export type GpsSpeedSource = "reported" | "delta" | "none";

export interface GpsSpeedResult {
  /** metres per second */
  speed: number;
  source: GpsSpeedSource;
  /** Point to keep for the next delta estimate */
  point: GpsPoint | null;
}

const EARTH_RADIUS_M = 6371000;
const MAX_SPEED_MS = 70; // ~252 km/h hard clamp
const MIN_DELTA_S = 0.35;
const MAX_DELTA_S = 6;
/** Ignore sub-noise crawls when deriving from position (m/s). */
const MIN_DELTA_SPEED = 0.4;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres. */
export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Speed from two fixes (m/s), or null if the sample is unusable. */
export function speedFromDelta(prev: GpsPoint, next: GpsPoint): number | null {
  const dt = (next.atMs - prev.atMs) / 1000;
  if (!(dt >= MIN_DELTA_S && dt <= MAX_DELTA_S)) return null;
  if (![prev.lat, prev.lon, next.lat, next.lon].every(Number.isFinite)) return null;
  const dist = haversineMeters(prev, next);
  if (!Number.isFinite(dist)) return null;
  const speed = dist / dt;
  if (!Number.isFinite(speed) || speed > MAX_SPEED_MS) return null;
  if (speed < MIN_DELTA_SPEED) return 0;
  return speed;
}

export interface ResolveGpsSpeedInput {
  reportedSpeed: number | null | undefined;
  latitude: number;
  longitude: number;
  atMs: number;
  previous: GpsPoint | null;
  /** Horizontal accuracy in metres when known; large values distrust deltas. */
  accuracyM?: number | null;
}

/**
 * Choose reported GPS speed when present; else fall back to position deltas.
 * Always advances `point` when the fix has usable coordinates.
 */
export function resolveGpsSpeed(input: ResolveGpsSpeedInput): GpsSpeedResult {
  const { latitude: lat, longitude: lon, atMs, previous, accuracyM } = input;
  const coordsOk = Number.isFinite(lat) && Number.isFinite(lon);
  const point: GpsPoint | null = coordsOk ? { lat, lon, atMs } : previous;

  const reported = input.reportedSpeed;
  if (typeof reported === "number" && Number.isFinite(reported) && reported >= 0) {
    return {
      speed: Math.min(MAX_SPEED_MS, Math.max(0, reported)),
      source: "reported",
      point,
    };
  }

  const accuracyOk =
    accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= 45;

  if (coordsOk && previous && accuracyOk) {
    const derived = speedFromDelta(previous, { lat, lon, atMs });
    if (derived !== null) {
      return { speed: derived, source: "delta", point };
    }
  }

  return { speed: 0, source: "none", point };
}
