import type { PowertrainProfile } from "@/lib/powertrain/types-config";
import { profileIdleRpm } from "@/lib/powertrain/types-config";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function wheelRpmFromSpeedKmh(speedKmh: number, wheelCircumferenceM: number): number {
  if (speedKmh <= 0 || wheelCircumferenceM <= 0) return 0;
  const speedMs = speedKmh / 3.6;
  return (speedMs / wheelCircumferenceM) * 60;
}

/** Pure mechanical RPM from road speed and gear ratio stack (no load slip). */
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

/** Inverse of rpmFromSpeedAndGear - road speed for a locked ratio at the given RPM. */
export function speedKmhFromRpmAndGear(
  rpm: number,
  gear: number,
  profile: PowertrainProfile,
): number {
  if (gear < 1 || rpm <= 0) return 0;
  const ratio = profile.transmission.gearRatios[gear - 1];
  if (ratio == null || ratio <= 0 || profile.transmission.finalDrive <= 0) return 0;
  const wheelRpm = rpm / (ratio * profile.transmission.finalDrive);
  const speedMs = (wheelRpm / 60) * profile.wheelCircumferenceM;
  return Math.max(0, speedMs * 3.6);
}

export interface RpmTrackContext {
  speedKmh: number;
  gear: number;
  /** Driver demand 0..1 - used only for launch / converter slip. */
  driverDemand: number;
  /** True while a shift is active (slip handled by shift controller). */
  shifting?: boolean;
  /** Optional unlock for torque-converter personalities. */
  converterUnlocked?: boolean;
}

/**
 * RPM between shifts. Once locked above launch speed, RPM tracks mechanical
 * wheel×ratio×finalDrive only - no generic load-dependent slip across the
 * idle-to-redline span.
 */
export function rpmTrackTarget(
  speedKmh: number,
  gear: number,
  throttle: number,
  load: number,
  profile: PowertrainProfile,
): number {
  return rpmTrackTargetEx(
    {
      speedKmh,
      gear,
      driverDemand: Math.max(throttle, load),
    },
    profile,
  );
}

export function rpmTrackTargetEx(ctx: RpmTrackContext, profile: PowertrainProfile): number {
  const { speedKmh, gear, driverDemand } = ctx;
  if (gear < 1) {
    return profile.engine.idleRpm * (0.45 + driverDemand * 0.15);
  }

  const mechanical = rpmFromSpeedAndGear(speedKmh, gear, profile);
  const slip = profile.transmission.slip;
  const launchSpeed = slip?.launchSpeedKmh ?? 4;
  const idle = profileIdleRpm(profile);

  if (speedKmh <= launchSpeed) {
    return rpmAtCreep(speedKmh, gear, driverDemand, profile);
  }

  // Locked mechanical coupling - deterministic at fixed speed/gear.
  let target = mechanical;

  const tc = slip?.torqueConverter;
  if (tc?.enabled && (ctx.converterUnlocked || speedKmh < (tc.lockSpeedKmh ?? 48))) {
    const maxSlipRpm = (tc.maxSlipRpm ?? 280) * clamp(driverDemand, 0, 1);
    target = mechanical + maxSlipRpm * (tc.slipGain ?? 0.65);
  }

  return clamp(target, idle * 0.9, profile.engine.redlineRpm);
}

/** RPM at very low speed in gear - idle + optional launch slip from throttle. */
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
  const launchSpeed = profile.transmission.slip?.launchSpeedKmh ?? 4;
  if (speedKmh > launchSpeed) return mechanical;
  const launchBias = gear === 1 ? 1 : Math.max(0.22, 1 - (gear - 1) * 0.2);
  const launchFraction =
    profile.transmission.slip?.launchSlipFraction ?? profile.transmission.idle.revLimitFraction;
  const revSpan = (profile.engine.redlineRpm - idle) * launchFraction * launchBias;
  const rev = idle + throttle * revSpan;
  // Blend toward mechanical as speed rises through the launch window.
  const blend = clamp(speedKmh / Math.max(0.5, launchSpeed), 0, 1);
  const slipped = Math.max(mechanical, rev);
  return clamp(mechanical * blend + slipped * (1 - blend), idle * 0.9, profile.engine.redlineRpm);
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
