/** Load-dependent upshift RPM table. */
export interface UpshiftRpmTable {
  lowLoad: number;
  mediumLoad: number;
  highLoad: number;
}

/** Kickdown tuning - floor pedal requests lower gear. */
export interface KickdownProfile {
  enabled: boolean;
  throttleThreshold: number;
  rpmFractionOfUpshift: number;
  maxSteps: number;
  /** Minimum road speed before kickdown is allowed. */
  minSpeedKmh?: number;
}

/** Downshift threshold tuning. */
export interface DownshiftProfile {
  baseRpm: number;
  perGearOffsetRpm: number[];
  hysteresisRpm: number;
  postUpshiftBlockMs: number;
  /** Coasting downshifts only when throttle is below this (unless kickdown). */
  coastMaxThrottle?: number;
}

/** Shift event timing and feel. */
export interface ShiftProfile {
  upshiftDurationMs: number;
  downshiftDurationMs: number;
  minGearHoldMs: number;
  /** Minimum ms after a shift completes before another can begin. */
  shiftLockoutMs?: number;
  torqueDipUp: number;
  torqueDipDown: number;
  revMatchEnabled: boolean;
  revMatchOvershoot: number;
  revMatchFlareFraction: number;
}

/** Idle / stop / creep behavior. */
export interface IdleStopProfile {
  engageSpeedKmh: number;
  engageThrottle: number;
  disengageSpeedKmh: number;
  disengageThrottle: number;
  stoppedInGearRpm: number;
  revLimitFraction: number;
  /** Min ms in neutral before re-engaging 1st (prevents stop-and-go hunting). */
  reengageHoldMs?: number;
}

/** Redline protection. */
export interface RedlineProfile {
  softFraction: number;
  maxDownshiftFraction: number;
}

/** RPM tracking outside active shifts. */
export interface RpmTrackingProfile {
  trackTau: number;
  maxRateRpmPerSec: number;
  upshiftEasePower: number;
  downshiftEasePower: number;
}

/** Explicit slip - launch / optional torque converter only (no generic cruise slip). */
export interface SlipProfile {
  /** Below this speed, launch slip may raise RPM above mechanical. */
  launchSpeedKmh: number;
  /** Fraction of (redline−idle) available as launch rev from demand. */
  launchSlipFraction: number;
  /** Limited slip while a shift is in progress (fraction of ratio delta). */
  shiftSlipFraction?: number;
  torqueConverter?: {
    enabled: boolean;
    /** Road speed above which the converter locks. */
    lockSpeedKmh: number;
    maxSlipRpm: number;
    slipGain: number;
  };
}

/** Optional overrides for the generated speed×demand shift map. */
export interface ShiftMapOverrides {
  speedHysteresisKmh?: number;
  allowSkipShifts?: boolean;
  minDemandDeltaForKickdown?: number;
  kickdownCooldownMs?: number;
  upshiftSpeedKmh?: number[][];
  downshiftSpeedKmh?: number[][];
}

/** Automatic transmission tuning - profile-specific, not global. */
export interface TransmissionProfile {
  gears: number;
  gearRatios: number[];
  finalDrive: number;
  upshiftRpm: UpshiftRpmTable;
  upshiftLoadMedium: number;
  upshiftLoadHigh: number;
  upshiftHysteresisRpm: number;
  downshift: DownshiftProfile;
  kickdown: KickdownProfile;
  shift: ShiftProfile;
  idle: IdleStopProfile;
  redline: RedlineProfile;
  rpm: RpmTrackingProfile;
  /** Explicit slip model (defaults applied when omitted). */
  slip?: SlipProfile;
  /** Precomputed map; when omitted, generated from ratios + RPM targets. */
  shiftMap?: import("@/lib/powertrain/shift-map").ShiftMap;
  shiftMapOverrides?: ShiftMapOverrides;
  /** @deprecated use shift.upshiftDurationMs */
  shiftDurationMs?: number;
  kickdownEnabled?: boolean;
  revMatchEnabled?: boolean;
  minGearHoldMs?: number;
  downshiftRpm?: number;
  downshiftHysteresisRpm?: number;
}

export interface PowertrainProfile {
  id: string;
  name: string;
  engine: {
    idleRpm: number;
    redlineRpm: number;
  };
  transmission: TransmissionProfile;
  wheelCircumferenceM: number;
  throttle: {
    attackTau: number;
    releaseTau: number;
    directWeight: number;
  };
  overrun: {
    probability: number;
    minIntervalMs: number;
    minPriorThrottle: number;
    liftOffAccelThreshold: number;
  };
  behavior: {
    engineResponse: number;
    shiftAggression: number;
    overrunIntensity: number;
  };
}

export function profileIdleRpm(profile: PowertrainProfile): number {
  const v = profile.transmission.idle.stoppedInGearRpm;
  return v > 0 ? v : profile.engine.idleRpm;
}
