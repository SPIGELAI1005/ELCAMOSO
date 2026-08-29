import type { VehicleMotionState } from "@/lib/motion/types";
import { resolveGearEngagement, selectTargetGear } from "@/lib/powertrain/gear-selector";
import { updateOverrun, createOverrunState, type OverrunState } from "@/lib/powertrain/overrun";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import {
  applyRedlineProtection,
  normalizeRpm,
  rateLimitRpm,
  rpmTrackTarget,
  smoothRpm,
} from "@/lib/powertrain/rpm-model";
import {
  beginShift,
  createShiftControllerState,
  tickShift,
  type ShiftControllerState,
  type ShiftDirection,
} from "@/lib/powertrain/shift-controller";
import {
  createThrottleModelState,
  updateThrottleModel,
  type ThrottleModelState,
} from "@/lib/powertrain/throttle-model";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";
import { resolveDrivingMode } from "@/lib/powertrain/domain/driving-mode";

export interface PowertrainSimulatorOptions {
  profileId?: string;
  profile?: PowertrainProfile;
}

export interface PowertrainSimulatorInternals {
  gear: number;
  rpm: number;
  throttleState: ThrottleModelState;
  shiftState: ShiftControllerState;
  overrunState: OverrunState;
  previousThrottle: number;
  lastShiftCompletedAt: number;
  lastShiftWasUp: boolean;
  blockDownshiftUntil: number;
  lastNeutralAt: number;
  clockMs: number;
  lastFallbackTier: VehicleMotionState["fallbackTier"];
  reconnectBlendUntil: number;
}

/** Standalone powertrain tick — no audio, no GPS. */
export class PowertrainSimulator {
  private profile: PowertrainProfile;
  private internal: PowertrainSimulatorInternals;

  constructor(options: PowertrainSimulatorOptions = {}) {
    this.profile = options.profile ?? getPowertrainProfile(options.profileId ?? "flat-six-sport");
    this.internal = createPowertrainInternals();
  }

  getProfile(): PowertrainProfile {
    return this.profile;
  }

  setProfile(profile: PowertrainProfile | string) {
    this.profile = typeof profile === "string" ? getPowertrainProfile(profile) : profile;
  }

  reset() {
    this.internal = createPowertrainInternals();
  }

  getInternals(): Readonly<PowertrainSimulatorInternals> {
    return this.internal;
  }

  tick(
    motion: VehicleMotionState,
    dt: number,
    opts?: { directThrottle?: number; braking?: number },
  ): VirtualPowertrainState {
    const dtSafe = Math.min(0.1, Math.max(0.001, dt));
    const now = motion.timestamp || this.internal.clockMs + dtSafe * 1000;
    this.internal.clockMs = now;

    if (motion.fallbackTier !== this.internal.lastFallbackTier) {
      this.internal.lastFallbackTier = motion.fallbackTier;
      this.internal.reconnectBlendUntil = now + 1500;
    }
    const resilienceBlend = motion.transitioning || now < this.internal.reconnectBlendUntil;
    const rpmTrackTau = this.profile.transmission.rpm.trackTau * (resilienceBlend ? 2.8 : 1);
    const rpmMaxRate =
      this.profile.transmission.rpm.maxRateRpmPerSec * (resilienceBlend ? 0.35 : 1);

    const speedKmh = Math.max(0, motion.speedKmh);
    const pedal = opts?.directThrottle;
    const braking = opts?.braking ?? 0;
    let { gear, rpm, shiftState } = this.internal;
    let loadMultiplier = 1;
    let shiftCompletedThisTick = false;

    const prevGear = gear;
    gear = resolveGearEngagement(gear, speedKmh, motion.inferredThrottle, this.profile, {
      now,
      lastNeutralAt: this.internal.lastNeutralAt,
    });

    if (gear === 0 && prevGear > 0) {
      this.internal.lastNeutralAt = now;
    }

    if (shiftState.active) {
      const shift = tickShift(shiftState, dtSafe, this.profile);
      shiftState = shift.state;
      rpm = applyRedlineProtection(shift.rpm, this.profile);
      loadMultiplier = shift.loadMultiplier;

      if (shift.complete && shift.completedGear != null) {
        gear = shift.completedGear;
        rpm = applyRedlineProtection(shift.rpm, this.profile);
        this.internal.lastShiftCompletedAt = now;
        this.internal.lastShiftWasUp = shift.completedDirection === "up";
        shiftCompletedThisTick = true;
        if (shift.completedDirection === "up") {
          this.internal.blockDownshiftUntil =
            now + this.profile.transmission.downshift.postUpshiftBlockMs;
        }
      }
    } else if (gear > 0) {
      const throttleHint = pedal ?? motion.inferredThrottle;
      const target = rpmTrackTarget(speedKmh, gear, throttleHint, throttleHint, this.profile);
      const tracked = smoothRpm(rpm || target, target, dtSafe, rpmTrackTau);
      rpm = rateLimitRpm(rpm || tracked, tracked, dtSafe, rpmMaxRate);
      rpm = applyRedlineProtection(rpm, this.profile);
    } else {
      const idleTarget = this.profile.engine.idleRpm * (0.45 + (pedal ?? 0) * 0.12);
      rpm = smoothRpm(rpm, idleTarget, dtSafe, 0.14);
    }

    const rpmNorm = normalizeRpm(rpm, this.profile);
    const throttleResult = updateThrottleModel({
      motion,
      profile: this.profile,
      rpmNormalized: rpmNorm,
      dt: dtSafe,
      state: this.internal.throttleState,
      ...(pedal !== undefined ? { directThrottle: pedal } : {}),
      ...(opts?.braking !== undefined ? { braking: opts.braking } : {}),
    });

    let load = throttleResult.load * loadMultiplier;
    let targetGear = gear;

    if (!shiftState.active && gear > 0 && !shiftCompletedThisTick) {
      targetGear = selectTargetGear(
        {
          currentGear: gear,
          rpm,
          throttle: throttleResult.throttle,
          load: throttleResult.load,
          speedKmh,
          braking,
          lastShiftCompletedAt: this.internal.lastShiftCompletedAt,
          now,
          lastShiftWasUp: this.internal.lastShiftWasUp,
          blockDownshiftUntil: this.internal.blockDownshiftUntil,
          shifting: false,
        },
        this.profile,
      );

      if (targetGear !== gear && Math.abs(targetGear - gear) === 1) {
        const direction: ShiftDirection = targetGear > gear ? "up" : "down";
        shiftState = beginShift(
          shiftState,
          direction,
          gear,
          targetGear,
          speedKmh,
          rpm,
          this.profile,
        );
        if (shiftState.active) {
          const first = tickShift(shiftState, dtSafe, this.profile);
          shiftState = first.state;
          rpm = applyRedlineProtection(first.rpm, this.profile);
          load = throttleResult.load * first.loadMultiplier;
        }
      }
    }

    const overrunResult = updateOverrun({
      throttle: throttleResult.throttle,
      previousThrottle: this.internal.previousThrottle,
      accelerationFiltered: motion.accelerationFiltered,
      speedKmh,
      now,
      profile: this.profile,
      state: this.internal.overrunState,
      ...(pedal !== undefined ? { pedalRequest: pedal } : {}),
    });

    const drivingMode = resolveDrivingMode({
      speedKmh,
      throttle: throttleResult.throttle,
      accel: motion.accelerationFiltered,
      shifting: shiftState.active,
      overrun: overrunResult.overrun,
      gear,
    });

    this.internal = {
      ...this.internal,
      gear,
      rpm,
      throttleState: throttleResult.state,
      shiftState,
      overrunState: overrunResult.state,
      previousThrottle: throttleResult.throttle,
    };

    const engineRunning =
      gear > 0 ||
      throttleResult.throttle > this.profile.transmission.idle.disengageThrottle ||
      speedKmh > this.profile.transmission.idle.disengageSpeedKmh;

    const out: VirtualPowertrainState = {
      timestamp: now,
      engineRunning,
      rpm,
      normalizedRpm: normalizeRpm(rpm, this.profile),
      gear,
      targetGear,
      load,
      throttle: throttleResult.throttle,
      shifting: shiftState.active,
      revMatchActive: shiftState.revMatchActive,
      revMatchProgress: shiftState.revMatchProgress,
      overrun: overrunResult.overrun,
      drivingMode,
    };

    if (shiftState.active) {
      out.shiftDirection = shiftState.direction;
      out.shiftProgress = shiftState.progress;
    }

    return out;
  }
}

function createPowertrainInternals(): PowertrainSimulatorInternals {
  return {
    gear: 0,
    rpm: 0,
    throttleState: createThrottleModelState(),
    shiftState: createShiftControllerState(),
    overrunState: createOverrunState(),
    previousThrottle: 0,
    lastShiftCompletedAt: -60_000,
    lastShiftWasUp: false,
    blockDownshiftUntil: 0,
    lastNeutralAt: 0,
    clockMs: 0,
    lastFallbackTier: "decay",
    reconnectBlendUntil: 0,
  };
}

export function idlePowertrainState(): VirtualPowertrainState {
  return { ...IDLE_POWERTRAIN, timestamp: Date.now() };
}
