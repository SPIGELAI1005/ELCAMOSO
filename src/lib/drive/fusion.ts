/**
 * Blend GPS speed with accelerometer so sound stays synced when GPS lags.
 * GPS is the absolute reference when fresh; IMU fills the gaps.
 */

export interface FusionSample {
  /** metres per second */
  speed: number;
  /** metres per second squared, vehicle-forward when known */
  accel: number;
  gpsAgeMs: number;
  imuAgeMs: number;
}

export interface FusionInput {
  gpsSpeed: number | null;
  gpsAt: number;
  /** device acceleration including gravity, m/s^2, y-forward-ish */
  accY: number | null;
  imuAt: number;
  now: number;
  dt: number;
  previousSpeed: number;
  sensitivity: number;
  noiseFloor: number;
}

export function fuseMotion(input: FusionInput): FusionSample {
  const gpsAge = input.now - input.gpsAt;
  const imuAge = input.now - input.imuAt;
  const gpsFresh = input.gpsSpeed !== null && Number.isFinite(input.gpsSpeed) && gpsAge < 1800;
  const gpsOk = input.gpsSpeed !== null && Number.isFinite(input.gpsSpeed) && gpsAge < 5000;
  const imuOk = input.accY !== null && Number.isFinite(input.accY) && imuAge < 400;

  let accel = 0;
  if (imuOk) {
    const raw = (input.accY as number) * input.sensitivity;
    accel = Math.abs(raw) < input.noiseFloor * 0.35 ? 0 : raw;
  }

  let speed = input.previousSpeed;
  if (gpsFresh) {
    speed = Math.max(0, input.gpsSpeed as number);
  } else {
    const imuWeight = imuOk ? Math.min(1, gpsAge / 1200) : 0;
    const integrated = Math.max(0, input.previousSpeed + accel * input.dt);
    const gps = gpsOk ? Math.max(0, input.gpsSpeed as number) : integrated;
    speed = gps * (1 - imuWeight) + integrated * imuWeight;
  }

  if (!gpsOk && !imuOk) {
    const coast = (input.gpsSpeed ?? input.previousSpeed) * Math.max(0, 1 - input.dt * 0.35);
    speed = Math.max(0, coast);
  }

  return { speed, accel, gpsAgeMs: gpsAge, imuAgeMs: imuAge };
}
