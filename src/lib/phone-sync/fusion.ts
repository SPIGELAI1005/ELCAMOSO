import { PHONE_STALE_MS, type PhoneSample } from "./protocol";

/** Latest phone sample as seen by the car (receive time, car clock). */
let latest: { sample: PhoneSample; at: number } | null = null;
const listeners = new Set<() => void>();

export function reportPhoneSample(sample: PhoneSample, now = Date.now()) {
  latest = { sample, at: now };
  for (const l of listeners) l();
}

export function clearPhoneSample() {
  latest = null;
  for (const l of listeners) l();
}

export function subscribePhoneSample(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function readPhoneSample(now = Date.now()): PhoneSample | null {
  if (!latest || now - latest.at > PHONE_STALE_MS) return null;
  return latest.sample;
}

export function isPhoneLive(now = Date.now()): boolean {
  return readPhoneSample(now) != null;
}

export interface AltitudeReading {
  altitude: number | null;
  accuracy: number | null;
}

/**
 * Pick the better altitude: phone wins when the car has none, or when the phone's
 * vertical accuracy is better (lower number). Unknown accuracy loses to known.
 */
export function chooseAltitude(
  car: AltitudeReading,
  phone: AltitudeReading | null,
): AltitudeReading {
  if (!phone || phone.altitude == null) return car;
  if (car.altitude == null) return phone;
  const ca = car.accuracy ?? Infinity;
  const pa = phone.accuracy ?? Infinity;
  return pa < ca ? phone : car;
}

/**
 * Blend car acceleration with the phone's accelerometer. The phone reacts to
 * sudden launches and hard braking faster than GPS-derived speed, so strong
 * phone events win; otherwise a light blend keeps the car's value in charge.
 */
export function fuseAcceleration(car: number, phoneLongAccel: number | null | undefined): number {
  if (phoneLongAccel == null || !Number.isFinite(phoneLongAccel)) return car;
  const p = Math.max(-12, Math.min(12, phoneLongAccel));
  if (Math.abs(p) > 1.5 && Math.abs(p) > Math.abs(car)) return 0.7 * p + 0.3 * car;
  return 0.7 * car + 0.3 * p;
}
