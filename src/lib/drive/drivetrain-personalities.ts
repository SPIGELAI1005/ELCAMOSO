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

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Audio transient shaping — consumed by Dynamic Drive layer crossfade. */
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
 * Complete virtual drivetrain personality — single configuration source.
 * Powertrain simulation, legacy transmission box, and audio transients all derive from this.
 */
export interface DrivetrainPersonalityConfig {
  id: string;
  name: string;

  engine: {
    idleRpm: number;
    redlineRpm: number;
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
    /** Coast downshift gate — defaults to 0.28 when omitted. */
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

  /** Legacy sound-engine shift smoothing (0..1) for computeDriveState when Dynamic Drive is off. */
  legacy: {
    shiftSmoothing: number;
    /** kmh→RPM slope per gear for legacy computeDriveState (not physical ratios). */
    gearRatios: number[];
  };
}

function defaultDownshiftOffsets(gears: number): number[] {
  return Array.from({ length: gears }, (_, i) => Math.max(0, (gears - 1 - i) * 120));
}

function buildTransmission(c: DrivetrainPersonalityConfig["transmission"]): TransmissionProfile {
  const gears = c.gearRatios.length;
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
  };
}

export function personalityToPowertrain(c: DrivetrainPersonalityConfig): PowertrainProfile {
  return {
    id: c.id,
    name: c.name,
    engine: c.engine,
    transmission: buildTransmission(c.transmission),
    wheelCircumferenceM: c.wheelCircumferenceM,
    throttle: c.throttle,
    overrun: c.overrun,
    behavior: c.behavior,
  };
}

/** Legacy transmission block on SoundProfile (computeDriveState path). */
export function personalityLegacyTransmission(c: DrivetrainPersonalityConfig) {
  return {
    gearRatios: c.legacy.gearRatios,
    idleRpm: c.engine.idleRpm,
    redlineRpm: c.engine.redlineRpm,
    shiftSmoothing: c.legacy.shiftSmoothing,
  };
}

export const DRIVETRAIN_PERSONALITY_IDS = [
  "flat-six-sport",
  "american-v8",
  "turbo-inline-6",
  "gt-v8",
  "synthetic-ev",
  "motorcycle-inline-4",
  "v-twin-cruiser",
  "single-cylinder-ag",
] as const;

/** Primary launch personalities — referenced by featured Sound Profiles. */
export const CORE_DRIVETRAIN_PERSONALITY_IDS = [
  "flat-six-sport",
  "american-v8",
  "turbo-inline-6",
  "gt-v8",
  "synthetic-ev",
] as const;

export type CoreDrivetrainPersonalityId = (typeof CORE_DRIVETRAIN_PERSONALITY_IDS)[number];

export type DrivetrainPersonalityId = (typeof DRIVETRAIN_PERSONALITY_IDS)[number];

export const DRIVETRAIN_PERSONALITIES: DrivetrainPersonalityConfig[] = [
  {
    id: "flat-six-sport",
    name: "Flat-Six Sport",
    engine: { idleRpm: 880, redlineRpm: 8000 },
    transmission: {
      gearRatios: [3.15, 2.05, 1.52, 1.18, 0.96, 0.8, 0.68],
      finalDrive: 3.44,
      upshiftRpm: { lowLoad: 5200, mediumLoad: 6400, highLoad: 7200 },
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
        maxSteps: 1,
      },
      shift: {
        upshiftDurationMs: 110,
        downshiftDurationMs: 160,
        minGearHoldMs: 750,
        torqueDipUp: 0.28,
        torqueDipDown: 0.1,
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
        maxRateRpmPerSec: 5200,
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
      upshiftStrength: 0.82,
      downshiftStrength: 0.78,
      revMatchStrength: 0.8,
      overrunStrength: 0.58,
      highLoadThreshold: 0.4,
      upshiftPitchDrop: 0.16,
      downshiftPitchFlare: 0.13,
      overrunPitchBias: 0.06,
      bandWidth: { idle: 0.1, low: 0.16, mid: 0.18, high: 0.16, redline: 0.12 },
      maxLayerGain: 0.42,
    },
    motion: {
      pitchTauBase: 0.038,
      pitchTauShiftScale: 0.07,
      pitchTauRevMatchExtra: 0.04,
      speedSlowTau: 0.52,
    },
    legacy: { shiftSmoothing: 0.11, gearRatios: [14.5, 9.2, 6.8, 5.2, 4.2, 3.5, 3.0] },
  },
  {
    id: "american-v8",
    name: "American V8",
    engine: { idleRpm: 680, redlineRpm: 6000 },
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
    legacy: { shiftSmoothing: 0.28, gearRatios: [12.5, 7.8, 5.2, 3.9, 3.1] },
  },
  {
    id: "turbo-inline-6",
    name: "Turbo Inline-6",
    engine: { idleRpm: 750, redlineRpm: 7000 },
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
        upshiftDurationMs: 130,
        downshiftDurationMs: 180,
        minGearHoldMs: 850,
        torqueDipUp: 0.3,
        torqueDipDown: 0.11,
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
      upshiftStrength: 0.75,
      downshiftStrength: 0.72,
      revMatchStrength: 0.68,
      overrunStrength: 0.7,
      highLoadThreshold: 0.38,
      upshiftPitchDrop: 0.15,
      downshiftPitchFlare: 0.11,
      overrunPitchBias: 0.08,
      bandWidth: { idle: 0.11, low: 0.17, mid: 0.19, high: 0.17, redline: 0.13 },
      maxLayerGain: 0.41,
    },
    motion: {
      pitchTauBase: 0.042,
      pitchTauShiftScale: 0.075,
      pitchTauRevMatchExtra: 0.035,
      speedSlowTau: 0.55,
    },
    legacy: { shiftSmoothing: 0.14, gearRatios: [13.8, 8.6, 6.2, 4.8, 3.9, 3.3, 2.9] },
  },
  {
    id: "gt-v8",
    name: "GT V8",
    engine: { idleRpm: 900, redlineRpm: 6500 },
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
        maxSteps: 1,
      },
      shift: {
        upshiftDurationMs: 95,
        downshiftDurationMs: 140,
        minGearHoldMs: 800,
        torqueDipUp: 0.26,
        torqueDipDown: 0.1,
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
      upshiftStrength: 0.78,
      downshiftStrength: 0.74,
      revMatchStrength: 0.72,
      overrunStrength: 0.5,
      highLoadThreshold: 0.42,
      upshiftPitchDrop: 0.17,
      downshiftPitchFlare: 0.12,
      overrunPitchBias: 0.05,
      bandWidth: { idle: 0.11, low: 0.17, mid: 0.19, high: 0.17, redline: 0.13 },
      maxLayerGain: 0.42,
    },
    motion: {
      pitchTauBase: 0.045,
      pitchTauShiftScale: 0.08,
      pitchTauRevMatchExtra: 0.03,
      speedSlowTau: 0.55,
    },
    legacy: { shiftSmoothing: 0.16, gearRatios: [13.2, 8.1, 5.6, 4.1, 3.2, 2.6] },
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
    legacy: { shiftSmoothing: 0.08, gearRatios: [16, 10.5, 7.2, 5.1, 3.8, 3.0] },
  },
  {
    id: "motorcycle-inline-4",
    name: "Motorcycle Inline-4",
    engine: { idleRpm: 1200, redlineRpm: 14000 },
    transmission: {
      gearRatios: [2.85, 2.05, 1.58, 1.32, 1.14, 1.0],
      finalDrive: 2.54,
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
    legacy: { shiftSmoothing: 0.05, gearRatios: [18, 13, 10.2, 8.4, 7.2, 6.4] },
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
    legacy: { shiftSmoothing: 0.22, gearRatios: [14, 9.5, 7.0, 5.5, 4.5, 3.8] },
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
    legacy: { shiftSmoothing: 0.55, gearRatios: [22, 14, 10, 7.5] },
  },
];

const byId = new Map(DRIVETRAIN_PERSONALITIES.map((p) => [p.id, p]));

export function getDrivetrainPersonality(id: string): DrivetrainPersonalityConfig {
  return byId.get(id) ?? DRIVETRAIN_PERSONALITIES[0]!;
}

export function listDrivetrainPersonalities(): DrivetrainPersonalityConfig[] {
  return DRIVETRAIN_PERSONALITIES;
}
