import type {
  KickdownProfile,
  PowertrainProfile,
  ShiftProfile,
  TransmissionProfile,
  UpshiftRpmTable,
} from "@/lib/powertrain/types-config";
import type {
  PersonalityVariantPools,
  TransientAspiration,
  TransientSchedulerProfile,
} from "@/lib/sound/dynamic-drive/transient-scheduler";
import { DEMAND_BREAKPOINTS, scheduleUpshiftRpmForDemand } from "@/lib/powertrain/shift-map";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Audio transient shaping - consumed by Dynamic Drive layer crossfade. */
export interface TransientAudioConfig {
  /** Drives turbo / NA / EV eligibility in the transient scheduler. */
  aspiration: TransientAspiration;
  /** Optional per-personality probability / cooldown overrides. */
  scheduler?: DeepPartial<TransientSchedulerProfile>;
  /** Procedural one-shot shapes for scheduled transients (sample-ready ids). */
  variantPools?: Partial<PersonalityVariantPools>;
  upshiftStrength: number;
  downshiftStrength: number;
  revMatchStrength: number;
  overrunStrength: number;
  highLoadThreshold: number;
  upshiftPitchDrop: number;
  downshiftPitchFlare: number;
  overrunPitchBias: number;
  /** Half-width of RPM band crossfade windows (normalized 0..1). */
  bandWidth: {
    idle: number;
    low: number;
    mid: number;
    high: number;
    redline: number;
  };
  maxLayerGain: number;
}

/** Motion smoothing overrides for improved / Dynamic Drive synth paths. */
export interface DrivetrainMotionTuning {
  pitchTauBase: number;
  pitchTauShiftScale: number;
  pitchTauRevMatchExtra: number;
  speedSlowTau?: number;
}

/**
 * Complete virtual drivetrain personality - single configuration source.
 * Powertrain simulation, legacy transmission box, and audio transients all derive from this.
 */
export interface DrivetrainPersonalityConfig {
  id: string;
  name: string;

  engine: {
    idleRpm: number;
    redlineRpm: number;
    /** Optional acoustic archetype for Realism V2 (cylinder count, firing character). */
    acoustic?: {
      cylinders: number;
      architecture:
        | "cross-plane-v8"
        | "cross-plane-v8-lope"
        | "flat-six"
        | "flat-plane-v8"
        | "inline-6"
        | "inline-3"
        | "v10-even"
        | "inline-4"
        | "v-twin"
        | "single";
      idleIrregularity?: number;
      exhaustPulse?: number;
      intakePresence?: number;
      mechanicalIntensity?: number;
      forcedInduction?: boolean;
    };
  };

  transmission: {
    gearRatios: number[];
    finalDrive: number;
    upshiftRpm: UpshiftRpmTable;
    upshiftLoadMedium: number;
    upshiftLoadHigh: number;
    upshiftHysteresisRpm: number;
    downshiftBaseRpm: number;
    downshiftHysteresisRpm: number;
    postUpshiftBlockMs: number;
    perGearOffsetRpm?: number[];
    /** Coast downshift gate - defaults to 0.28 when omitted. */
    coastDownshiftMaxThrottle?: number;
    kickdown: KickdownProfile;
    shift: ShiftProfile;
    idle: {
      engageSpeedKmh: number;
      engageThrottle: number;
      disengageSpeedKmh: number;
      disengageThrottle: number;
      stoppedInGearRpm: number;
      revLimitFraction: number;
      reengageHoldMs?: number;
    };
    redline: {
      softFraction: number;
      maxDownshiftFraction: number;
    };
    rpm: {
      trackTau: number;
      maxRateRpmPerSec: number;
      upshiftEasePower: number;
      downshiftEasePower: number;
    };
  };

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

  transient: TransientAudioConfig;
  motion: DrivetrainMotionTuning;

  /**
   * Legacy sound-engine shift smoothing (0..1) for computeDriveState when Dynamic Drive is off.
   * Gear slopes are derived from `transmission` (see personalityLegacyTransmission).
   */
  legacy: {
    shiftSmoothing: number;
  };
}

function defaultDownshiftOffsets(gears: number): number[] {
  return Array.from({ length: gears }, (_, i) => Math.max(0, (gears - 1 - i) * 120));
}

function buildTransmission(c: DrivetrainPersonalityConfig["transmission"]): TransmissionProfile {
  const gears = c.gearRatios.length;
  const isAutomaticSoft = (c.shift.upshiftDurationMs ?? 0) >= 180;
  return {
    gears,
    gearRatios: c.gearRatios,
    finalDrive: c.finalDrive,
    upshiftRpm: c.upshiftRpm,
    upshiftLoadMedium: c.upshiftLoadMedium,
    upshiftLoadHigh: c.upshiftLoadHigh,
    upshiftHysteresisRpm: c.upshiftHysteresisRpm,
    downshift: {
      baseRpm: c.downshiftBaseRpm,
      perGearOffsetRpm: c.perGearOffsetRpm ?? defaultDownshiftOffsets(gears),
      hysteresisRpm: c.downshiftHysteresisRpm,
      postUpshiftBlockMs: c.postUpshiftBlockMs,
      coastMaxThrottle: c.coastDownshiftMaxThrottle ?? 0.28,
    },
    kickdown: {
      enabled: c.kickdown.enabled,
      throttleThreshold: c.kickdown.throttleThreshold,
      rpmFractionOfUpshift: c.kickdown.rpmFractionOfUpshift,
      maxSteps: c.kickdown.maxSteps,
      minSpeedKmh: c.kickdown.minSpeedKmh ?? 18,
    },
    shift: {
      upshiftDurationMs: c.shift.upshiftDurationMs,
      downshiftDurationMs: c.shift.downshiftDurationMs,
      minGearHoldMs: c.shift.minGearHoldMs,
      shiftLockoutMs: c.shift.shiftLockoutMs ?? 90,
      torqueDipUp: c.shift.torqueDipUp,
      torqueDipDown: c.shift.torqueDipDown,
      revMatchEnabled: c.shift.revMatchEnabled,
      revMatchOvershoot: c.shift.revMatchOvershoot,
      revMatchFlareFraction: c.shift.revMatchFlareFraction,
    },
    idle: {
      engageSpeedKmh: c.idle.engageSpeedKmh,
      engageThrottle: c.idle.engageThrottle,
      disengageSpeedKmh: c.idle.disengageSpeedKmh,
      disengageThrottle: c.idle.disengageThrottle,
      stoppedInGearRpm: c.idle.stoppedInGearRpm,
      revLimitFraction: c.idle.revLimitFraction,
      reengageHoldMs: c.idle.reengageHoldMs ?? 450,
    },
    redline: c.redline,
    rpm: c.rpm,
    slip: {
      launchSpeedKmh: 4,
      launchSlipFraction: c.idle.revLimitFraction,
      shiftSlipFraction: 0.12,
      torqueConverter: isAutomaticSoft
        ? { enabled: true, lockSpeedKmh: 52, maxSlipRpm: 320, slipGain: 0.55 }
        : { enabled: false, lockSpeedKmh: 40, maxSlipRpm: 0, slipGain: 0 },
    },
    shiftMapOverrides: {
      speedHysteresisKmh: Math.max(3.5, c.upshiftHysteresisRpm / 140),
      allowSkipShifts: false,
      minDemandDeltaForKickdown: 0.1,
      kickdownCooldownMs: 400,
    },
  };
}

export function personalityToPowertrain(c: DrivetrainPersonalityConfig): PowertrainProfile {
  return {
    id: c.id,
    name: c.name,
    engine: {
      idleRpm: c.engine.idleRpm,
      redlineRpm: c.engine.redlineRpm,
      forcedInduction: Boolean(c.engine.acoustic?.forcedInduction),
    },
    ...(c.engine.acoustic?.forcedInduction
      ? {
          boost: {
            minSpoolRpm: 1400,
            fullSpoolRpm: Math.min(4200, c.engine.redlineRpm * 0.68),
            buildupTauSec: 0.48,
            releaseTauSec: 0.24,
            armMinLoad: 0.52,
            releaseMinBoost: 0.42,
            releaseLoadDrop: 0.28,
            releaseMaxDemand: 0.22,
            releaseCooldownMs: 900,
          },
        }
      : {}),
    transmission: buildTransmission(c.transmission),
    wheelCircumferenceM: c.wheelCircumferenceM,
    throttle: c.throttle,
    overrun: c.overrun,
    behavior: c.behavior,
  };
}

/**
 * Physical RPM-per-km/h slope for one gear: rpm = kmh × slope.
 * rpm = (kmh / 3.6) / circumference × 60 × gear × final.
 */
export function rpmPerKmhForGear(
  gearRatio: number,
  finalDrive: number,
  wheelCircumferenceM: number,
): number {
  return (gearRatio * finalDrive * 60) / (3.6 * Math.max(0.5, wheelCircumferenceM));
}

/**
 * Legacy transmission block on SoundProfile (computeDriveState path).
 * Slopes are derived from the physical gear set so the fallback gearbox shifts at
 * real road speeds (≈ 95-130 rpm per km/h in 1st) instead of the hand-tuned
 * `legacy.gearRatios`, which were ~7-8x too flat and held 1st gear to >350 km/h.
 */
export function personalityLegacyTransmission(c: DrivetrainPersonalityConfig) {
  const powertrain = personalityToPowertrain(c);
  return {
    gearRatios: c.transmission.gearRatios.map((ratio) =>
      rpmPerKmhForGear(ratio, c.transmission.finalDrive, c.wheelCircumferenceM),
    ),
    idleRpm: c.engine.idleRpm,
    redlineRpm: c.engine.redlineRpm,
    shiftSmoothing: c.legacy.shiftSmoothing,
    upshiftRpmByDemand: DEMAND_BREAKPOINTS.map((demand) =>
      scheduleUpshiftRpmForDemand(demand, powertrain),
    ),
    downshiftRpm: c.transmission.downshiftBaseRpm,
  };
}

export const DRIVETRAIN_PERSONALITY_IDS = [
  "flat-six-sport",
  "high-rev-v10",
  "f1-v10",
  "flat-plane-v8-track",
  "rally-turbo-3",
  "american-v8",
  "turbo-inline-6",
  "gt-v8",
  "synthetic-ev",
  "motorcycle-inline-4",
  "v-twin-cruiser",
  "single-cylinder-ag",
] as const;

/** Primary launch personalities - referenced by featured Sound Profiles. */
export const CORE_DRIVETRAIN_PERSONALITY_IDS = [
  "flat-six-sport",
  "high-rev-v10",
  "flat-plane-v8-track",
  "rally-turbo-3",
  "american-v8",
  "turbo-inline-6",
  "gt-v8",
  "synthetic-ev",
] as const;

export type CoreDrivetrainPersonalityId = (typeof CORE_DRIVETRAIN_PERSONALITY_IDS)[number];

export type DrivetrainPersonalityId = (typeof DRIVETRAIN_PERSONALITY_IDS)[number];

const BASE_DRIVETRAIN_PERSONALITIES: DrivetrainPersonalityConfig[] = [
  {
    id: "flat-six-sport",
    name: "Flat-Six Sport",
    engine: {
      idleRpm: 880,
      redlineRpm: 9000,
      acoustic: {
        cylinders: 6,
        architecture: "flat-six",
        idleIrregularity: 0.12,
        exhaustPulse: 0.58,
        intakePresence: 0.55,
        mechanicalIntensity: 0.48,
      },
    },
    transmission: {
      gearRatios: [3.15, 2.05, 1.52, 1.18, 0.96, 0.8, 0.68],
      finalDrive: 3.44,
      upshiftRpm: { lowLoad: 5200, mediumLoad: 7000, highLoad: 8600 },
      upshiftLoadMedium: 0.36,
      upshiftLoadHigh: 0.7,
      upshiftHysteresisRpm: 260,
      downshiftBaseRpm: 2800,
      downshiftHysteresisRpm: 340,
      postUpshiftBlockMs: 500,
      kickdown: {
        enabled: true,
        throttleThreshold: 0.82,
        rpmFractionOfUpshift: 0.5,
        maxSteps: 2,
      },
      shift: {
        upshiftDurationMs: 125,
        downshiftDurationMs: 170,
        minGearHoldMs: 750,
        torqueDipUp: 0.42,
        torqueDipDown: 0.16,
        revMatchEnabled: true,
        revMatchOvershoot: 0.11,
        revMatchFlareFraction: 0.4,
      },
      idle: {
        engageSpeedKmh: 2,
        engageThrottle: 0.08,
        disengageSpeedKmh: 1.2,
        disengageThrottle: 0.06,
        stoppedInGearRpm: 880,
        revLimitFraction: 0.55,
      },
      redline: { softFraction: 0.97, maxDownshiftFraction: 0.96 },
      rpm: {
        trackTau: 0.055,
        maxRateRpmPerSec: 6000,
        upshiftEasePower: 1.8,
        downshiftEasePower: 1.45,
      },
    },
    wheelCircumferenceM: 2.05,
    throttle: { attackTau: 0.08, releaseTau: 0.22, directWeight: 0.55 },
    overrun: {
      probability: 0.25,
      minIntervalMs: 1800,
      minPriorThrottle: 0.35,
      liftOffAccelThreshold: 0.15,
    },
    behavior: { engineResponse: 1.1, shiftAggression: 1.15, overrunIntensity: 0.55 },
    transient: {
      aspiration: "na",
      variantPools: {
        upshift: [
          { id: "flat6-shift-up-crisp", intensity: 0.84, filterHz: 1020, decayMs: 150 },
          { id: "flat6-shift-up-soft", intensity: 0.64, filterHz: 860, decayMs: 210 },
          { id: "flat6-shift-up-race", intensity: 0.96, filterHz: 1180, decayMs: 125 },
        ],
        revMatch: [
          { id: "flat6-rev-blip", intensity: 0.6, filterHz: 920, decayMs: 155 },
          { id: "flat6-rev-aggressive", intensity: 0.9, filterHz: 1240, decayMs: 135 },
        ],
      },
      upshiftStrength: 0.92,
      downshiftStrength: 0.88,
      revMatchStrength: 0.85,
      overrunStrength: 0.58,
      highLoadThreshold: 0.4,
      upshiftPitchDrop: 0.22,
      downshiftPitchFlare: 0.16,
      overrunPitchBias: 0.06,
      bandWidth: { idle: 0.1, low: 0.16, mid: 0.18, high: 0.16, redline: 0.12 },
      maxLayerGain: 0.52,
    },
    motion: {
      pitchTauBase: 0.038,
      pitchTauShiftScale: 0.07,
      pitchTauRevMatchExtra: 0.04,
      speedSlowTau: 0.52,
    },
    legacy: { shiftSmoothing: 0.11 },
  },
  {
    id: "american-v8",
    name: "American V8",
    engine: {
      idleRpm: 680,
      redlineRpm: 6000,
      acoustic: {
        cylinders: 8,
        architecture: "cross-plane-v8-lope",
        idleIrregularity: 0.42,
        exhaustPulse: 0.88,
        intakePresence: 0.32,
        mechanicalIntensity: 0.22,
      },
    },
    transmission: {
      gearRatios: [3.5, 2.2, 1.45, 1.08, 0.85],
      finalDrive: 3.73,
      upshiftRpm: { lowLoad: 3800, mediumLoad: 4800, highLoad: 5400 },
      upshiftLoadMedium: 0.42,
      upshiftLoadHigh: 0.78,
      upshiftHysteresisRpm: 300,
      downshiftBaseRpm: 2200,
      downshiftHysteresisRpm: 380,
      postUpshiftBlockMs: 650,
      kickdown: {
        enabled: true,
        throttleThreshold: 0.85,
        rpmFractionOfUpshift: 0.48,
        maxSteps: 1,
      },
      shift: {
        upshiftDurationMs: 280,
        downshiftDurationMs: 340,
        minGearHoldMs: 1100,
        torqueDipUp: 0.38,
        torqueDipDown: 0.14,
        revMatchEnabled: true,
        revMatchOvershoot: 0.08,
        revMatchFlareFraction: 0.35,
      },
      idle: {
        engageSpeedKmh: 2.5,
        engageThrottle: 0.12,
        disengageSpeedKmh: 1.5,
        disengageThrottle: 0.08,
        stoppedInGearRpm: 680,
        revLimitFraction: 0.5,
      },
      redline: { softFraction: 0.96, maxDownshiftFraction: 0.94 },
      rpm: {
        trackTau: 0.09,
        maxRateRpmPerSec: 3800,
        upshiftEasePower: 2.0,
        downshiftEasePower: 1.6,
      },
    },
    wheelCircumferenceM: 2.12,
    throttle: { attackTau: 0.12, releaseTau: 0.28, directWeight: 0.5 },
    overrun: {
      probability: 0.4,
      minIntervalMs: 1400,
      minPriorThrottle: 0.28,
      liftOffAccelThreshold: 0.2,
    },
    behavior: { engineResponse: 0.95, shiftAggression: 0.85, overrunIntensity: 0.75 },
    transient: {
      aspiration: "na",
      variantPools: {
        upshift: [
          { id: "v8-shift-up-lazy", intensity: 0.58, filterHz: 520, decayMs: 260 },
          { id: "v8-shift-up-firm", intensity: 0.72, filterHz: 680, decayMs: 220 },
        ],
        overrun: [
          { id: "v8-overrun-small", intensity: 0.58, filterHz: 480, decayMs: 520 },
          { id: "v8-overrun-medium", intensity: 0.74, filterHz: 560, decayMs: 680 },
          { id: "v8-overrun-large", intensity: 0.88, filterHz: 620, decayMs: 1100 },
        ],
        exhaustPop: [
          { id: "v8-pop-subtle", intensity: 0.44, filterHz: 420, decayMs: 110 },
          { id: "v8-pop-crisp", intensity: 0.62, filterHz: 540, decayMs: 90 },
          { id: "v8-pop-backfire", intensity: 0.52, filterHz: 380, decayMs: 140 },
        ],
        thump: [
          { id: "v8-thump-deep", intensity: 0.55, filterHz: 110, decayMs: 240 },
          { id: "v8-thump-firm", intensity: 0.68, filterHz: 165, decayMs: 190 },
        ],
      },
      upshiftStrength: 0.65,
      downshiftStrength: 0.55,
      revMatchStrength: 0.45,
      overrunStrength: 0.85,
      highLoadThreshold: 0.48,
      upshiftPitchDrop: 0.12,
      downshiftPitchFlare: 0.08,
      overrunPitchBias: 0.04,
      bandWidth: { idle: 0.13, low: 0.19, mid: 0.2, high: 0.18, redline: 0.14 },
      maxLayerGain: 0.4,
    },
    motion: {
      pitchTauBase: 0.052,
      pitchTauShiftScale: 0.1,
      pitchTauRevMatchExtra: 0.02,
      speedSlowTau: 0.62,
    },
    legacy: { shiftSmoothing: 0.28 },
  },
  {
    id: "turbo-inline-6",
    name: "Turbo Inline-6",
    engine: {
      idleRpm: 750,
      redlineRpm: 7000,
      acoustic: {
        cylinders: 6,
        architecture: "inline-6",
        idleIrregularity: 0.1,
        exhaustPulse: 0.5,
        intakePresence: 0.45,
        mechanicalIntensity: 0.35,
        forcedInduction: true,
      },
    },
    transmission: {
      gearRatios: [3.2, 2.0, 1.45, 1.12, 0.92, 0.78, 0.68],
      finalDrive: 3.15,
      upshiftRpm: { lowLoad: 4600, mediumLoad: 5800, highLoad: 6600 },
      upshiftLoadMedium: 0.4,
      upshiftLoadHigh: 0.74,
      upshiftHysteresisRpm: 270,
      downshiftBaseRpm: 2600,
      downshiftHysteresisRpm: 330,
      postUpshiftBlockMs: 480,
      kickdown: {
        enabled: true,
        throttleThreshold: 0.8,
        rpmFractionOfUpshift: 0.54,
        maxSteps: 1,
      },
      shift: {
        upshiftDurationMs: 145,
        downshiftDurationMs: 195,
        minGearHoldMs: 850,
        torqueDipUp: 0.4,
        torqueDipDown: 0.15,
        revMatchEnabled: true,
        revMatchOvershoot: 0.1,
        revMatchFlareFraction: 0.38,
      },
      idle: {
        engageSpeedKmh: 2,
        engageThrottle: 0.1,
        disengageSpeedKmh: 1.2,
        disengageThrottle: 0.06,
        stoppedInGearRpm: 750,
        revLimitFraction: 0.52,
      },
      redline: { softFraction: 0.97, maxDownshiftFraction: 0.95 },
      rpm: {
        trackTau: 0.065,
        maxRateRpmPerSec: 4600,
        upshiftEasePower: 1.75,
        downshiftEasePower: 1.4,
      },
    },
    wheelCircumferenceM: 2.08,
    throttle: { attackTau: 0.07, releaseTau: 0.2, directWeight: 0.6 },
    overrun: {
      probability: 0.3,
      minIntervalMs: 1600,
      minPriorThrottle: 0.32,
      liftOffAccelThreshold: 0.18,
    },
    behavior: { engineResponse: 1.05, shiftAggression: 1.05, overrunIntensity: 0.6 },
    transient: {
      aspiration: "turbo",
      variantPools: {
        upshift: [
          { id: "i6t-shift-up-smooth", intensity: 0.7, filterHz: 880, decayMs: 165 },
          { id: "i6t-shift-up-hard", intensity: 0.86, filterHz: 1040, decayMs: 140 },
        ],
        turboFlutter: [
          { id: "i6t-flutter-light", intensity: 0.5, filterHz: 1420, decayMs: 175 },
          { id: "i6t-flutter-mid", intensity: 0.64, filterHz: 1620, decayMs: 145 },
          { id: "i6t-flutter-heavy", intensity: 0.72, filterHz: 1780, decayMs: 190 },
        ],
        wastegate: [
          { id: "i6t-wg-chatter", intensity: 0.52, filterHz: 1020, decayMs: 135 },
          { id: "i6t-wg-hiss", intensity: 0.4, filterHz: 860, decayMs: 195 },
          { id: "i6t-wg-surge", intensity: 0.58, filterHz: 1180, decayMs: 120 },
        ],
        overrun: [
          { id: "i6t-overrun-soft", intensity: 0.52, filterHz: 640, decayMs: 400 },
          { id: "i6t-overrun-boost", intensity: 0.7, filterHz: 780, decayMs: 480 },
        ],
      },
      scheduler: {
        turboFlutter: { probability: 0.42, cooldownMs: 950, minLoad: 0.42, minRpmNorm: 0.4 },
        wastegate: { probability: 0.32, cooldownMs: 1400, minLoad: 0.5, minRpmNorm: 0.45 },
        exhaustPop: { probability: 0.08, cooldownMs: 3600, minPriorThrottle: 0.45 },
      },
      upshiftStrength: 0.88,
      downshiftStrength: 0.82,
      revMatchStrength: 0.68,
      overrunStrength: 0.7,
      highLoadThreshold: 0.38,
      upshiftPitchDrop: 0.15,
      downshiftPitchFlare: 0.11,
      overrunPitchBias: 0.08,
      bandWidth: { idle: 0.11, low: 0.17, mid: 0.19, high: 0.17, redline: 0.13 },
      maxLayerGain: 0.5,
    },
    motion: {
      pitchTauBase: 0.042,
      pitchTauShiftScale: 0.075,
      pitchTauRevMatchExtra: 0.035,
      speedSlowTau: 0.55,
    },
    legacy: { shiftSmoothing: 0.14 },
  },
  {
    id: "gt-v8",
    name: "GT V8",
    engine: {
      idleRpm: 900,
      redlineRpm: 6500,
      acoustic: {
        cylinders: 8,
        architecture: "cross-plane-v8",
        idleIrregularity: 0.18,
        exhaustPulse: 0.72,
        intakePresence: 0.38,
        mechanicalIntensity: 0.28,
      },
    },
    transmission: {
      gearRatios: [3.4, 2.15, 1.5, 1.12, 0.92, 0.78],
      finalDrive: 3.55,
      upshiftRpm: { lowLoad: 4200, mediumLoad: 5200, highLoad: 5900 },
      upshiftLoadMedium: 0.38,
      upshiftLoadHigh: 0.72,
      upshiftHysteresisRpm: 250,
      downshiftBaseRpm: 2400,
      downshiftHysteresisRpm: 310,
      postUpshiftBlockMs: 420,
      kickdown: {
        enabled: true,
        throttleThreshold: 0.78,
        rpmFractionOfUpshift: 0.52,
        maxSteps: 2,
      },
      shift: {
        upshiftDurationMs: 110,
        downshiftDurationMs: 155,
        minGearHoldMs: 800,
        torqueDipUp: 0.38,
        torqueDipDown: 0.14,
        revMatchEnabled: true,
        revMatchOvershoot: 0.09,
        revMatchFlareFraction: 0.36,
      },
      idle: {
        engageSpeedKmh: 2,
        engageThrottle: 0.1,
        disengageSpeedKmh: 1.2,
        disengageThrottle: 0.06,
        stoppedInGearRpm: 900,
        revLimitFraction: 0.54,
      },
      redline: { softFraction: 0.97, maxDownshiftFraction: 0.96 },
      rpm: {
        trackTau: 0.06,
        maxRateRpmPerSec: 4400,
        upshiftEasePower: 1.85,
        downshiftEasePower: 1.42,
      },
    },
    wheelCircumferenceM: 2.06,
    throttle: { attackTau: 0.09, releaseTau: 0.24, directWeight: 0.52 },
    overrun: {
      probability: 0.18,
      minIntervalMs: 2200,
      minPriorThrottle: 0.4,
      liftOffAccelThreshold: 0.12,
    },
    behavior: { engineResponse: 1.0, shiftAggression: 1.0, overrunIntensity: 0.4 },
    transient: {
      aspiration: "na",
      variantPools: {
        upshift: [
          { id: "gtv8-shift-up-refined", intensity: 0.76, filterHz: 820, decayMs: 145 },
          { id: "gtv8-shift-up-sport", intensity: 0.88, filterHz: 980, decayMs: 125 },
        ],
        revMatch: [
          { id: "gtv8-rev-clean", intensity: 0.65, filterHz: 900, decayMs: 150 },
          { id: "gtv8-rev-quick", intensity: 0.78, filterHz: 1060, decayMs: 130 },
        ],
      },
      upshiftStrength: 0.9,
      downshiftStrength: 0.84,
      revMatchStrength: 0.72,
      overrunStrength: 0.5,
      highLoadThreshold: 0.42,
      upshiftPitchDrop: 0.17,
      downshiftPitchFlare: 0.12,
      overrunPitchBias: 0.05,
      bandWidth: { idle: 0.11, low: 0.17, mid: 0.19, high: 0.17, redline: 0.13 },
      maxLayerGain: 0.51,
    },
    motion: {
      pitchTauBase: 0.045,
      pitchTauShiftScale: 0.08,
      pitchTauRevMatchExtra: 0.03,
      speedSlowTau: 0.55,
    },
    legacy: { shiftSmoothing: 0.16 },
  },
  {
    id: "synthetic-ev",
    name: "Synthetic Hyper EV",
    engine: { idleRpm: 0, redlineRpm: 12000 },
    transmission: {
      gearRatios: [4.2, 2.8, 1.9, 1.35, 1.0, 0.82],
      finalDrive: 2.8,
      upshiftRpm: { lowLoad: 6000, mediumLoad: 8500, highLoad: 10500 },
      upshiftLoadMedium: 0.32,
      upshiftLoadHigh: 0.68,
      upshiftHysteresisRpm: 220,
      downshiftBaseRpm: 3500,
      downshiftHysteresisRpm: 280,
      postUpshiftBlockMs: 350,
      kickdown: {
        enabled: true,
        throttleThreshold: 0.7,
        rpmFractionOfUpshift: 0.58,
        maxSteps: 1,
      },
      shift: {
        upshiftDurationMs: 75,
        downshiftDurationMs: 90,
        minGearHoldMs: 550,
        torqueDipUp: 0.18,
        torqueDipDown: 0.06,
        revMatchEnabled: false,
        revMatchOvershoot: 0,
        revMatchFlareFraction: 0,
      },
      idle: {
        engageSpeedKmh: 1,
        engageThrottle: 0.06,
        disengageSpeedKmh: 0.5,
        disengageThrottle: 0.04,
        stoppedInGearRpm: 0,
        revLimitFraction: 0.45,
      },
      redline: { softFraction: 0.98, maxDownshiftFraction: 0.97 },
      rpm: {
        trackTau: 0.04,
        maxRateRpmPerSec: 6800,
        upshiftEasePower: 1.5,
        downshiftEasePower: 1.2,
      },
    },
    wheelCircumferenceM: 2.04,
    throttle: { attackTau: 0.05, releaseTau: 0.15, directWeight: 0.7 },
    overrun: {
      probability: 0.15,
      minIntervalMs: 2500,
      minPriorThrottle: 0.45,
      liftOffAccelThreshold: 0.1,
    },
    behavior: { engineResponse: 1.25, shiftAggression: 1.2, overrunIntensity: 0.35 },
    transient: {
      aspiration: "electric",
      variantPools: {
        upshift: [
          { id: "ev-shift-clunk-a", intensity: 0.48, filterHz: 420, decayMs: 55 },
          { id: "ev-shift-clunk-b", intensity: 0.42, filterHz: 380, decayMs: 65 },
        ],
        thump: [{ id: "ev-mount-thump", intensity: 0.38, filterHz: 95, decayMs: 120 }],
      },
      upshiftStrength: 0.55,
      downshiftStrength: 0.42,
      revMatchStrength: 0,
      overrunStrength: 0.45,
      highLoadThreshold: 0.35,
      upshiftPitchDrop: 0.08,
      downshiftPitchFlare: 0.05,
      overrunPitchBias: 0.12,
      bandWidth: { idle: 0.08, low: 0.14, mid: 0.17, high: 0.15, redline: 0.11 },
      maxLayerGain: 0.38,
    },
    motion: {
      pitchTauBase: 0.028,
      pitchTauShiftScale: 0.04,
      pitchTauRevMatchExtra: 0,
      speedSlowTau: 0.48,
    },
    legacy: { shiftSmoothing: 0.08 },
  },
  {
    id: "motorcycle-inline-4",
    name: "Motorcycle Inline-4",
    engine: { idleRpm: 1200, redlineRpm: 14000 },
    // S1000RR-class gearing: ~150 km/h in 1st at redline (was 218 km/h, too tall).
    // rpm/kmh in 1st = 3.5 × 3.0 × 1000 / (1.88 × 60) = 93.1 → 14000/93.1 = 150.4 km/h
    transmission: {
      gearRatios: [3.5, 2.55, 1.95, 1.62, 1.38, 1.2],
      finalDrive: 3.0,
      upshiftRpm: { lowLoad: 9000, mediumLoad: 11000, highLoad: 13200 },
      upshiftLoadMedium: 0.34,
      upshiftLoadHigh: 0.66,
      upshiftHysteresisRpm: 420,
      downshiftBaseRpm: 4800,
      downshiftHysteresisRpm: 520,
      postUpshiftBlockMs: 320,
      kickdown: {
        enabled: true,
        throttleThreshold: 0.72,
        rpmFractionOfUpshift: 0.56,
        maxSteps: 2,
      },
      shift: {
        upshiftDurationMs: 55,
        downshiftDurationMs: 85,
        minGearHoldMs: 420,
        torqueDipUp: 0.14,
        torqueDipDown: 0.05,
        revMatchEnabled: true,
        revMatchOvershoot: 0.15,
        revMatchFlareFraction: 0.52,
      },
      idle: {
        engageSpeedKmh: 3,
        engageThrottle: 0.14,
        disengageSpeedKmh: 2,
        disengageThrottle: 0.1,
        stoppedInGearRpm: 1200,
        revLimitFraction: 0.62,
      },
      redline: { softFraction: 0.98, maxDownshiftFraction: 0.97 },
      rpm: {
        trackTau: 0.032,
        maxRateRpmPerSec: 9200,
        upshiftEasePower: 1.35,
        downshiftEasePower: 1.15,
      },
    },
    wheelCircumferenceM: 1.88,
    throttle: { attackTau: 0.04, releaseTau: 0.11, directWeight: 0.68 },
    overrun: {
      probability: 0.22,
      minIntervalMs: 2100,
      minPriorThrottle: 0.42,
      liftOffAccelThreshold: 0.1,
    },
    behavior: { engineResponse: 1.32, shiftAggression: 1.38, overrunIntensity: 0.42 },
    transient: {
      aspiration: "na",
      variantPools: {
        upshift: [
          { id: "bike-shift-up-stack", intensity: 0.78, filterHz: 1380, decayMs: 85 },
          { id: "bike-shift-up-race", intensity: 0.92, filterHz: 1520, decayMs: 70 },
        ],
        revMatch: [
          { id: "bike-rev-blip", intensity: 0.72, filterHz: 1280, decayMs: 110 },
          { id: "bike-rev-scream", intensity: 0.88, filterHz: 1450, decayMs: 95 },
        ],
        overrun: [{ id: "bike-overrun-rasp", intensity: 0.5, filterHz: 920, decayMs: 280 }],
      },
      upshiftStrength: 0.72,
      downshiftStrength: 0.68,
      revMatchStrength: 0.88,
      overrunStrength: 0.42,
      highLoadThreshold: 0.34,
      upshiftPitchDrop: 0.22,
      downshiftPitchFlare: 0.19,
      overrunPitchBias: 0.09,
      bandWidth: { idle: 0.08, low: 0.13, mid: 0.15, high: 0.14, redline: 0.1 },
      maxLayerGain: 0.4,
      scheduler: {
        upshift: { probability: 0.8, cooldownMs: 360, minLoad: 0.26 },
        revMatch: {
          probability: 0.65,
          cooldownMs: 650,
          minSpeedKmh: 32,
          minThrottle: 0.18,
          minProgress: 0.18,
        },
        overrun: { probability: 0.32, cooldownMs: 1900, minPriorThrottle: 0.4 },
      },
    },
    motion: {
      pitchTauBase: 0.03,
      pitchTauShiftScale: 0.055,
      pitchTauRevMatchExtra: 0.055,
      speedSlowTau: 0.44,
    },
    legacy: { shiftSmoothing: 0.05 },
  },
  {
    id: "v-twin-cruiser",
    name: "V-Twin Cruiser",
    engine: { idleRpm: 900, redlineRpm: 5500 },
    transmission: {
      gearRatios: [3.75, 2.48, 1.72, 1.34, 1.08, 0.9],
      finalDrive: 3.15,
      upshiftRpm: { lowLoad: 3100, mediumLoad: 4100, highLoad: 4700 },
      upshiftLoadMedium: 0.44,
      upshiftLoadHigh: 0.76,
      upshiftHysteresisRpm: 280,
      downshiftBaseRpm: 2100,
      downshiftHysteresisRpm: 360,
      postUpshiftBlockMs: 720,
      kickdown: {
        enabled: true,
        throttleThreshold: 0.88,
        rpmFractionOfUpshift: 0.46,
        maxSteps: 1,
      },
      shift: {
        upshiftDurationMs: 240,
        downshiftDurationMs: 300,
        minGearHoldMs: 1250,
        torqueDipUp: 0.36,
        torqueDipDown: 0.12,
        revMatchEnabled: true,
        revMatchOvershoot: 0.06,
        revMatchFlareFraction: 0.28,
      },
      idle: {
        engageSpeedKmh: 2.5,
        engageThrottle: 0.14,
        disengageSpeedKmh: 1.5,
        disengageThrottle: 0.1,
        stoppedInGearRpm: 900,
        revLimitFraction: 0.48,
      },
      redline: { softFraction: 0.95, maxDownshiftFraction: 0.93 },
      rpm: {
        trackTau: 0.1,
        maxRateRpmPerSec: 3200,
        upshiftEasePower: 2.1,
        downshiftEasePower: 1.65,
      },
    },
    wheelCircumferenceM: 2.0,
    throttle: { attackTau: 0.14, releaseTau: 0.32, directWeight: 0.48 },
    overrun: {
      probability: 0.45,
      minIntervalMs: 1200,
      minPriorThrottle: 0.24,
      liftOffAccelThreshold: 0.22,
    },
    behavior: { engineResponse: 0.88, shiftAggression: 0.72, overrunIntensity: 0.78 },
    transient: {
      aspiration: "na",
      variantPools: {
        upshift: [
          { id: "twin-shift-lazy", intensity: 0.52, filterHz: 380, decayMs: 280 },
          { id: "twin-shift-roll", intensity: 0.6, filterHz: 460, decayMs: 320 },
        ],
        overrun: [
          { id: "twin-overrun-potato", intensity: 0.62, filterHz: 340, decayMs: 720 },
          { id: "twin-overrun-long", intensity: 0.8, filterHz: 400, decayMs: 980 },
          { id: "twin-overrun-decay", intensity: 0.7, filterHz: 520, decayMs: 850 },
        ],
      },
      upshiftStrength: 0.58,
      downshiftStrength: 0.5,
      revMatchStrength: 0.38,
      overrunStrength: 0.88,
      highLoadThreshold: 0.5,
      upshiftPitchDrop: 0.1,
      downshiftPitchFlare: 0.07,
      overrunPitchBias: 0.03,
      bandWidth: { idle: 0.14, low: 0.2, mid: 0.21, high: 0.19, redline: 0.15 },
      maxLayerGain: 0.39,
      scheduler: {
        overrun: { probability: 0.58, cooldownMs: 1100, minPriorThrottle: 0.22 },
        exhaustPop: { probability: 0.18, cooldownMs: 2600, minPriorThrottle: 0.34 },
        upshift: { probability: 0.55, cooldownMs: 620, minLoad: 0.34 },
      },
    },
    motion: {
      pitchTauBase: 0.058,
      pitchTauShiftScale: 0.11,
      pitchTauRevMatchExtra: 0.015,
      speedSlowTau: 0.68,
    },
    legacy: { shiftSmoothing: 0.22 },
  },
  {
    id: "single-cylinder-ag",
    name: "Single-Cylinder Ag",
    engine: { idleRpm: 280, redlineRpm: 650 },
    transmission: {
      gearRatios: [4.5, 3.15, 2.35, 1.82],
      finalDrive: 4.75,
      upshiftRpm: { lowLoad: 470, mediumLoad: 510, highLoad: 575 },
      upshiftLoadMedium: 0.48,
      upshiftLoadHigh: 0.82,
      upshiftHysteresisRpm: 35,
      downshiftBaseRpm: 340,
      downshiftHysteresisRpm: 45,
      postUpshiftBlockMs: 1400,
      kickdown: {
        enabled: true,
        throttleThreshold: 0.92,
        rpmFractionOfUpshift: 0.42,
        maxSteps: 1,
      },
      shift: {
        upshiftDurationMs: 380,
        downshiftDurationMs: 450,
        minGearHoldMs: 1900,
        torqueDipUp: 0.42,
        torqueDipDown: 0.16,
        revMatchEnabled: false,
        revMatchOvershoot: 0,
        revMatchFlareFraction: 0,
      },
      idle: {
        engageSpeedKmh: 1.5,
        engageThrottle: 0.18,
        disengageSpeedKmh: 0.8,
        disengageThrottle: 0.12,
        stoppedInGearRpm: 280,
        revLimitFraction: 0.42,
      },
      redline: { softFraction: 0.94, maxDownshiftFraction: 0.9 },
      rpm: {
        trackTau: 0.14,
        maxRateRpmPerSec: 180,
        upshiftEasePower: 2.4,
        downshiftEasePower: 1.9,
      },
    },
    wheelCircumferenceM: 2.25,
    throttle: { attackTau: 0.18, releaseTau: 0.38, directWeight: 0.42 },
    overrun: {
      probability: 0.28,
      minIntervalMs: 2400,
      minPriorThrottle: 0.3,
      liftOffAccelThreshold: 0.25,
    },
    behavior: { engineResponse: 0.62, shiftAggression: 0.58, overrunIntensity: 0.38 },
    transient: {
      aspiration: "na",
      variantPools: {
        upshift: [
          { id: "ag-shift-chuff", intensity: 0.45, filterHz: 220, decayMs: 380 },
          { id: "ag-shift-clunk", intensity: 0.52, filterHz: 180, decayMs: 420 },
        ],
        overrun: [
          { id: "ag-overrun-coast", intensity: 0.4, filterHz: 160, decayMs: 900 },
          { id: "ag-overrun-stack", intensity: 0.48, filterHz: 140, decayMs: 1100 },
        ],
        thump: [{ id: "ag-flywheel-thump", intensity: 0.5, filterHz: 75, decayMs: 320 }],
      },
      upshiftStrength: 0.48,
      downshiftStrength: 0.42,
      revMatchStrength: 0,
      overrunStrength: 0.42,
      highLoadThreshold: 0.52,
      upshiftPitchDrop: 0.06,
      downshiftPitchFlare: 0.04,
      overrunPitchBias: 0.02,
      bandWidth: { idle: 0.16, low: 0.22, mid: 0.2, high: 0.16, redline: 0.12 },
      maxLayerGain: 0.36,
      scheduler: {
        revMatch: {
          probability: 0,
          cooldownMs: 99999,
          minSpeedKmh: 99,
          minThrottle: 1,
          minProgress: 1,
        },
        upshift: { probability: 0.42, cooldownMs: 1400, minLoad: 0.38 },
        overrun: { probability: 0.38, cooldownMs: 2200, minPriorThrottle: 0.28 },
      },
    },
    motion: {
      pitchTauBase: 0.68,
      pitchTauShiftScale: 0.12,
      pitchTauRevMatchExtra: 0,
      speedSlowTau: 0.75,
    },
    legacy: { shiftSmoothing: 0.55 },
  },
];

function requireBasePersonality(id: string): DrivetrainPersonalityConfig {
  const personality = BASE_DRIVETRAIN_PERSONALITIES.find((item) => item.id === id);
  if (!personality) throw new Error(`Missing base drivetrain personality: ${id}`);
  return personality;
}

const flatSixBase = requireBasePersonality("flat-six-sport");
const turboSixBase = requireBasePersonality("turbo-inline-6");

const HIGH_REV_V10_PERSONALITY: DrivetrainPersonalityConfig = {
  ...flatSixBase,
  id: "high-rev-v10",
  name: "High-Rev V10",
  engine: {
    // Spec §4.5: idle 1000, redline 9000
    idleRpm: 1000,
    redlineRpm: 9000,
    acoustic: {
      cylinders: 10,
      architecture: "v10-even",
      idleIrregularity: 0.07,
      exhaustPulse: 0.65,
      intakePresence: 0.84,
      mechanicalIntensity: 0.58,
    },
  },
  // Spec §4.5: 6-speed ASG-type (LFA-class): 3.231/2.188/1.609/1.233/1.000/0.794
  // Final drive 4.10, tyre 2.19 m (315/30 R20)
  // rpm/kmh: G1=100.8, G2=68.3, G3=50.2, G4=38.5, G5=31.2, G6=24.8
  transmission: {
    ...flatSixBase.transmission,
    gearRatios: [3.231, 2.188, 1.609, 1.233, 1.0, 0.794],
    finalDrive: 4.1,
    upshiftRpm: { lowLoad: 5400, mediumLoad: 7200, highLoad: 8650 },
    upshiftLoadMedium: 0.34,
    upshiftLoadHigh: 0.68,
    upshiftHysteresisRpm: 300,
    downshiftBaseRpm: 3500,
    downshiftHysteresisRpm: 360,
    postUpshiftBlockMs: 360,
    kickdown: {
      enabled: true,
      throttleThreshold: 0.76,
      rpmFractionOfUpshift: 0.54,
      maxSteps: 2,
    },
    shift: {
      ...flatSixBase.transmission.shift,
      upshiftDurationMs: 85,
      downshiftDurationMs: 120,
      minGearHoldMs: 580,
      torqueDipUp: 0.34,
      torqueDipDown: 0.12,
      revMatchOvershoot: 0.13,
      revMatchFlareFraction: 0.46,
    },
    idle: {
      ...flatSixBase.transmission.idle,
      stoppedInGearRpm: 1000,
      revLimitFraction: 0.58,
    },
    redline: { softFraction: 0.975, maxDownshiftFraction: 0.96 },
    rpm: {
      trackTau: 0.045,
      maxRateRpmPerSec: 7200,
      upshiftEasePower: 1.55,
      downshiftEasePower: 1.3,
    },
  },
  // Spec §4.5: tyre 2.19 m
  wheelCircumferenceM: 2.19,
  throttle: { attackTau: 0.055, releaseTau: 0.17, directWeight: 0.64 },
  overrun: {
    probability: 0.22,
    minIntervalMs: 1900,
    minPriorThrottle: 0.4,
    liftOffAccelThreshold: 0.13,
  },
  behavior: { engineResponse: 1.24, shiftAggression: 1.32, overrunIntensity: 0.5 },
  transient: {
    ...flatSixBase.transient,
    upshiftStrength: 0.96,
    downshiftStrength: 0.9,
    revMatchStrength: 0.92,
    highLoadThreshold: 0.36,
    upshiftPitchDrop: 0.2,
    downshiftPitchFlare: 0.18,
    maxLayerGain: 0.5,
  },
  motion: {
    pitchTauBase: 0.032,
    pitchTauShiftScale: 0.055,
    pitchTauRevMatchExtra: 0.05,
    speedSlowTau: 0.46,
  },
  legacy: { shiftSmoothing: 0.075 },
};

/**
 * F1 V10 (2004-era 3.0 L V10, onboard character): idle ~4.5k, redline 19k, seven close
 * ratios compressed for road speeds (18.5k rpm ≈ 45/70/92/112/132/150/170 km/h),
 * very fast rev slew and seamless 35 ms upshifts.
 */
const F1_V10_PERSONALITY: DrivetrainPersonalityConfig = {
  ...HIGH_REV_V10_PERSONALITY,
  id: "f1-v10",
  name: "F1 V10",
  engine: {
    idleRpm: 4500,
    redlineRpm: 19000,
    acoustic: {
      cylinders: 10,
      architecture: "v10-even",
      idleIrregularity: 0.05,
      exhaustPulse: 0.7,
      intakePresence: 0.95,
      mechanicalIntensity: 0.62,
    },
  },
  transmission: {
    ...HIGH_REV_V10_PERSONALITY.transmission,
    // rpm/kmh = ratio × finalDrive × 1000 / (60 × 2.05 m): G1 411 … G7 109
    gearRatios: [5.06, 3.25, 2.47, 2.03, 1.72, 1.52, 1.34],
    finalDrive: 10,
    upshiftRpm: { lowLoad: 16000, mediumLoad: 17500, highLoad: 18300 },
    upshiftLoadMedium: 0.32,
    upshiftLoadHigh: 0.62,
    upshiftHysteresisRpm: 600,
    downshiftBaseRpm: 8200,
    downshiftHysteresisRpm: 700,
    postUpshiftBlockMs: 260,
    kickdown: {
      enabled: true,
      throttleThreshold: 0.72,
      rpmFractionOfUpshift: 0.6,
      maxSteps: 2,
    },
    shift: {
      ...HIGH_REV_V10_PERSONALITY.transmission.shift,
      upshiftDurationMs: 35,
      downshiftDurationMs: 60,
      minGearHoldMs: 420,
      torqueDipUp: 0.18,
      torqueDipDown: 0.1,
      revMatchOvershoot: 0.08,
      revMatchFlareFraction: 0.4,
    },
    idle: {
      ...HIGH_REV_V10_PERSONALITY.transmission.idle,
      stoppedInGearRpm: 4500,
      revLimitFraction: 0.5,
    },
    redline: { softFraction: 0.975, maxDownshiftFraction: 0.96 },
    rpm: {
      trackTau: 0.022,
      maxRateRpmPerSec: 36000,
      upshiftEasePower: 1.7,
      downshiftEasePower: 1.4,
    },
  },
  wheelCircumferenceM: 2.05,
  throttle: { attackTau: 0.035, releaseTau: 0.12, directWeight: 0.7 },
  behavior: { engineResponse: 1.4, shiftAggression: 1.45, overrunIntensity: 0.55 },
  motion: {
    pitchTauBase: 0.022,
    pitchTauShiftScale: 0.03,
    pitchTauRevMatchExtra: 0.03,
    speedSlowTau: 0.4,
  },
  legacy: { shiftSmoothing: 0.04 },
};

const FLAT_PLANE_V8_TRACK_PERSONALITY: DrivetrainPersonalityConfig = {
  ...flatSixBase,
  id: "flat-plane-v8-track",
  name: "Flat-Plane V8 Track",
  engine: {
    // Spec §4.6: idle 1000, redline 9000
    idleRpm: 1000,
    redlineRpm: 9000,
    acoustic: {
      cylinders: 8,
      architecture: "flat-plane-v8",
      idleIrregularity: 0.08,
      exhaustPulse: 0.7,
      intakePresence: 0.74,
      mechanicalIntensity: 0.66,
    },
  },
  // Spec §4.6: 458-type 7-speed DCT: 3.08/2.18/1.63/1.29/1.03/0.84/0.69
  // Final drive 5.14, tyre 2.07 m (305/30 R20). Replaces the 8-speed 5.56 set.
  // rpm/kmh: G1=127.5, G2=90.2, G3=67.5, G4=53.4, G5=42.6, G6=34.8, G7=28.6
  transmission: {
    ...flatSixBase.transmission,
    gearRatios: [3.08, 2.18, 1.63, 1.29, 1.03, 0.84, 0.69],
    finalDrive: 5.14,
    upshiftRpm: { lowLoad: 5400, mediumLoad: 7200, highLoad: 8650 },
    upshiftLoadMedium: 0.32,
    upshiftLoadHigh: 0.66,
    upshiftHysteresisRpm: 280,
    downshiftBaseRpm: 3700,
    downshiftHysteresisRpm: 340,
    postUpshiftBlockMs: 320,
    kickdown: {
      enabled: true,
      throttleThreshold: 0.74,
      rpmFractionOfUpshift: 0.56,
      maxSteps: 2,
    },
    shift: {
      ...flatSixBase.transmission.shift,
      upshiftDurationMs: 75,
      downshiftDurationMs: 105,
      minGearHoldMs: 520,
      torqueDipUp: 0.3,
      torqueDipDown: 0.1,
      revMatchOvershoot: 0.14,
      revMatchFlareFraction: 0.5,
    },
    idle: {
      ...flatSixBase.transmission.idle,
      stoppedInGearRpm: 1000,
      revLimitFraction: 0.6,
    },
    redline: { softFraction: 0.975, maxDownshiftFraction: 0.965 },
    rpm: {
      trackTau: 0.04,
      maxRateRpmPerSec: 7600,
      upshiftEasePower: 1.48,
      downshiftEasePower: 1.25,
    },
  },
  // Spec §4.6: tyre 2.07 m
  wheelCircumferenceM: 2.07,
  throttle: { attackTau: 0.05, releaseTau: 0.16, directWeight: 0.66 },
  overrun: {
    probability: 0.28,
    minIntervalMs: 1550,
    minPriorThrottle: 0.36,
    liftOffAccelThreshold: 0.12,
  },
  behavior: { engineResponse: 1.28, shiftAggression: 1.4, overrunIntensity: 0.58 },
  transient: {
    ...flatSixBase.transient,
    upshiftStrength: 1,
    downshiftStrength: 0.96,
    revMatchStrength: 0.96,
    overrunStrength: 0.62,
    highLoadThreshold: 0.34,
    upshiftPitchDrop: 0.22,
    downshiftPitchFlare: 0.19,
    maxLayerGain: 0.52,
  },
  motion: {
    pitchTauBase: 0.03,
    pitchTauShiftScale: 0.05,
    pitchTauRevMatchExtra: 0.055,
    speedSlowTau: 0.42,
  },
  legacy: { shiftSmoothing: 0.06 },
};

const RALLY_TURBO_3_PERSONALITY: DrivetrainPersonalityConfig = {
  ...turboSixBase,
  id: "rally-turbo-3",
  name: "Rally Turbo Three",
  engine: {
    idleRpm: 950,
    redlineRpm: 6800,
    acoustic: {
      cylinders: 3,
      architecture: "inline-3",
      idleIrregularity: 0.2,
      exhaustPulse: 0.72,
      intakePresence: 0.58,
      mechanicalIntensity: 0.62,
      forcedInduction: true,
    },
  },
  // GR Yaris 6-speed per spec §4: final drive 3.941 (gears 1-4), 3.350 (gears 5-6).
  // Effective ratios with base finalDrive 3.941: gears 5-6 scaled by 3.350/3.941.
  // rpm/kmh: G1=117.4, G2=74.2, G3=50.9, G4=39.0, G5=28.2, G6=23.6
  transmission: {
    ...turboSixBase.transmission,
    gearRatios: [3.538, 2.238, 1.535, 1.177, 0.85, 0.712],
    finalDrive: 3.941,
    upshiftRpm: { lowLoad: 4100, mediumLoad: 5500, highLoad: 6500 },
    upshiftLoadMedium: 0.35,
    upshiftLoadHigh: 0.68,
    upshiftHysteresisRpm: 230,
    downshiftBaseRpm: 3000,
    downshiftHysteresisRpm: 280,
    postUpshiftBlockMs: 300,
    kickdown: {
      enabled: true,
      throttleThreshold: 0.75,
      rpmFractionOfUpshift: 0.58,
      maxSteps: 1,
    },
    shift: {
      ...turboSixBase.transmission.shift,
      upshiftDurationMs: 65,
      downshiftDurationMs: 90,
      minGearHoldMs: 500,
      torqueDipUp: 0.46,
      torqueDipDown: 0.14,
      revMatchOvershoot: 0.12,
      revMatchFlareFraction: 0.45,
    },
    idle: {
      ...turboSixBase.transmission.idle,
      stoppedInGearRpm: 950,
      revLimitFraction: 0.56,
    },
    redline: { softFraction: 0.965, maxDownshiftFraction: 0.95 },
    rpm: {
      trackTau: 0.05,
      maxRateRpmPerSec: 5600,
      upshiftEasePower: 1.55,
      downshiftEasePower: 1.3,
    },
  },
  wheelCircumferenceM: 1.98,
  throttle: { attackTau: 0.06, releaseTau: 0.18, directWeight: 0.63 },
  overrun: {
    probability: 0.52,
    minIntervalMs: 1000,
    minPriorThrottle: 0.28,
    liftOffAccelThreshold: 0.16,
  },
  behavior: { engineResponse: 1.18, shiftAggression: 1.45, overrunIntensity: 0.88 },
  transient: {
    ...turboSixBase.transient,
    scheduler: {
      ...turboSixBase.transient.scheduler,
      // Rally flutter/wastegate: raised minLoad gates to reduce cruise events
      turboFlutter: { probability: 0.58, cooldownMs: 800, minLoad: 0.42, minRpmNorm: 0.38 },
      wastegate: { probability: 0.44, cooldownMs: 1000, minLoad: 0.48, minRpmNorm: 0.42 },
      exhaustPop: { probability: 0.28, cooldownMs: 1400, minPriorThrottle: 0.38 },
    },
    // Reduced shift strength to address click regression with topology enabled
    upshiftStrength: 0.85,
    downshiftStrength: 0.82,
    revMatchStrength: 0.84,
    overrunStrength: 0.92,
    highLoadThreshold: 0.32,
    upshiftPitchDrop: 0.18,
    downshiftPitchFlare: 0.14,
    overrunPitchBias: 0.1,
    maxLayerGain: 0.54,
  },
  motion: {
    pitchTauBase: 0.035,
    pitchTauShiftScale: 0.052,
    pitchTauRevMatchExtra: 0.04,
    speedSlowTau: 0.4,
  },
  legacy: { shiftSmoothing: 0.065 },
};

export const DRIVETRAIN_PERSONALITIES: DrivetrainPersonalityConfig[] = [
  ...BASE_DRIVETRAIN_PERSONALITIES,
  HIGH_REV_V10_PERSONALITY,
  F1_V10_PERSONALITY,
  FLAT_PLANE_V8_TRACK_PERSONALITY,
  RALLY_TURBO_3_PERSONALITY,
];

const byId = new Map(DRIVETRAIN_PERSONALITIES.map((p) => [p.id, p]));

export function getDrivetrainPersonality(id: string): DrivetrainPersonalityConfig {
  return byId.get(id) ?? DRIVETRAIN_PERSONALITIES[0]!;
}

export function listDrivetrainPersonalities(): DrivetrainPersonalityConfig[] {
  return DRIVETRAIN_PERSONALITIES;
}
