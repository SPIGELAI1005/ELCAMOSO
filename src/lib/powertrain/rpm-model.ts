import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { profileIdleRpm } from "@/lib/powertrain/profiles";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function wheelRpmFromSpeedKmh(speedKmh: number, wheelCircumferenceM: number): number {
  if (speedKmh <= 0 || wheelCircumferenceM <= 0) return 0;
  const speedMs = speedKmh / 3.6;
  return (speedMs / wheelCircumferenceM) * 60;
}

/** Pure mechanical RPM from road speed and gear ratio stack. */
export function rpmFromSpeedAndGear(
  speedKmh: number,
  gear: number,
  profile: PowertrainProfile,
): number {
  if (gear < 1) return profile.engine.idleRpm * 0.5;
  const ratio = profile.transmission.gearRatios[gear - 1];
  if (ratio == null) return profile.engine.idleRpm;
  const wheelRpm = wheelRpmFromSpeedKmh(speedKmh, profile.wheelCircumferenceM);
  const raw = wheelRpm * ratio * profile.transmission.finalDrive;
  const floor = profile.engine.idleRpm * 0.85;
  return clamp(raw, floor, profile.engine.redlineRpm);
}

/** RPM target between shifts — mechanical ratio plus light load slip. */
export function rpmTrackTarget(
  speedKmh: number,
  gear: number,
  throttle: number,
  load: number,
  profile: PowertrainProfile,
): number {
  if (gear < 1) {
    return profile.engine.idleRpm * (0.45 + throttle * 0.15);
  }
  const mechanical = rpmFromSpeedAndGear(speedKmh, gear, profile);
  if (speedKmh <= 4) {
    return rpmAtCreep(speedKmh, gear, throttle, profile);
  }
  const idle = profileIdleRpm(profile);
  const demand = Math.max(throttle, load);
  const slip = demand * (profile.engine.redlineRpm - idle) * 0.06;
  return clamp(mechanical + slip, idle * 0.9, profile.engine.redlineRpm);
}

/** RPM at very low speed in gear — idle + optional rev from throttle. */
export function rpmAtCreep(
  speedKmh: number,
  gear: number,
  throttle: number,
  profile: PowertrainProfile,
): number {
  if (gear < 1) {
    return profile.engine.idleRpm * (0.45 + throttle * 0.15);
  }
  const idle = profileIdleRpm(profile);
  const mechanical = rpmFromSpeedAndGear(speedKmh, gear, profile);
  if (speedKmh > 4) return mechanical;
  const launchBias = gear === 1 ? 1 : Math.max(0.22, 1 - (gear - 1) * 0.2);
  const revSpan =
    (profile.engine.redlineRpm - idle) * profile.transmission.idle.revLimitFraction * launchBias;
  const rev = idle + throttle * revSpan;
  return clamp(Math.max(mechanical, rev), idle * 0.9, profile.engine.redlineRpm);
}

export function normalizeRpm(rpm: number, profile: PowertrainProfile): number {
  const span = profile.engine.redlineRpm - profile.engine.idleRpm;
  if (span <= 0) return 0;
  return clamp((rpm - profile.engine.idleRpm) / span, 0, 1);
}

export function smoothRpm(current: number, target: number, dt: number, tau: number): number {
  const a = 1 - Math.exp(-Math.max(0.001, dt) / Math.max(0.01, tau));
  return current + (target - current) * a;
}

/** Limit RPM step to avoid impossible jumps outside shifts. */
export function rateLimitRpm(
  current: number,
  target: number,
  dt: number,
  maxRatePerSec: number,
): number {
  const maxStep = maxRatePerSec * Math.max(0.001, dt);
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

export function applyRedlineProtection(rpm: number, profile: PowertrainProfile): number {
  const hard = profile.engine.redlineRpm;
  const floor = profile.engine.idleRpm * 0.5;
  return clamp(rpm, floor, hard);
}

export function rpmAfterGearChange(
  speedKmh: number,
  fromGear: number,
  toGear: number,
  profile: PowertrainProfile,
): { before: number; after: number } {
  return {
    before: rpmFromSpeedAndGear(speedKmh, fromGear, profile),
    after: rpmFromSpeedAndGear(speedKmh, toGear, profile),
  };
}

/** @deprecated use rpmAfterGearChange */
export const rpmAfterUpshift = rpmAfterGearChange;

export function easePow(t: number, power: number): number {
  const x = clamp(t, 0, 1);
  return power === 1 ? x : 1 - (1 - x) ** power;
}
