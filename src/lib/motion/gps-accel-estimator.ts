/**
 * Longitudinal acceleration estimated from (GPS-only) speed.
 *
 * Browser GPS in the car is ~1 Hz, ~0.8 s late and noisy (±0.6 km/h), and there is no IMU, so
 * the measured acceleration in sensor fusion stays 0. This derives a smoothed, noise-robust
 * estimate from the fused speed:
 * - a second speed low-pass irons out the 1 Hz GPS staircase,
 * - the derivative is low-passed again (short enough to follow a launch or a lift within ~1 s),
 * - a deadband with hysteresis keeps cruise noise at exactly 0 so states don't flicker:
 *   the output opens once |a| exceeds `openMs2` and closes again only below `closeMs2`.
 *
 * Only consumers that opt in use this (worlds and gearless voices); the measured fields that feed
 * the powertrain and gear-based cars are left untouched.
 */
export interface GpsAccelEstimator {
  speedMs: number;
  accelMs2: number;
  open: boolean;
  initialized: boolean;
}

export const GPS_ACCEL = {
  speedTau: 0.45,
  accelTau: 0.55,
  openMs2: 0.22,
  closeMs2: 0.12,
  minMs2: -6,
  maxMs2: 5,
} as const;

export function createGpsAccelEstimator(): GpsAccelEstimator {
  return { speedMs: 0, accelMs2: 0, open: false, initialized: false };
}

const lp = (cur: number, target: number, dt: number, tau: number) =>
  cur + (target - cur) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));

/** Advance the estimator by `dt` seconds with the current fused speed (m/s). Returns m/s². */
export function stepGpsAccelEstimator(est: GpsAccelEstimator, speedMs: number, dt: number): number {
  if (!(dt > 0) || !Number.isFinite(speedMs)) return gpsAccelOutput(est);
  if (!est.initialized) {
    est.speedMs = speedMs;
    est.initialized = true;
    return 0;
  }
  const d = Math.min(dt, 0.25);
  const prev = est.speedMs;
  est.speedMs = lp(est.speedMs, speedMs, d, GPS_ACCEL.speedTau);
  const raw = Math.max(GPS_ACCEL.minMs2, Math.min(GPS_ACCEL.maxMs2, (est.speedMs - prev) / d));
  est.accelMs2 = lp(est.accelMs2, raw, d, GPS_ACCEL.accelTau);
  const mag = Math.abs(est.accelMs2);
  if (est.open ? mag < GPS_ACCEL.closeMs2 : mag > GPS_ACCEL.openMs2) est.open = !est.open;
  return gpsAccelOutput(est);
}

/** Deadbanded output: 0 while closed, otherwise shrunk by the close threshold (continuous). */
export function gpsAccelOutput(est: GpsAccelEstimator): number {
  if (!est.open) return 0;
  const mag = Math.max(0, Math.abs(est.accelMs2) - GPS_ACCEL.closeMs2);
  return Math.sign(est.accelMs2) * mag;
}
