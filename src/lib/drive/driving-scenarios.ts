import {
  markPhoneRelayLost,
  markPhoneRelayRestored,
  createSensorFusion,
  phoneRelayMotionSample,
  pushMotionSample,
  tickSensorFusion,
  vehicleTelemetryMotionSample,
} from "@/lib/motion/sensor-fusion";
import type { MotionFallbackTier } from "@/lib/motion/types";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import {
  findFirstUpshiftMs,
  type PlausibilityResult,
  runPowertrainScenario,
  type PowertrainScenario,
  type ScenarioRunResult,
  verifyUpshiftRpmDrops,
} from "@/lib/powertrain/scenarios";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";

const DT = 0.016;

/** Deterministic driving scenarios A–E (powertrain domain). */
export const DRIVING_SCENARIOS: PowertrainScenario[] = [
  {
    id: "scenario-a",
    label: "Scenario A: 0→100 full acceleration",
    profileId: "flat-six-sport",
    dt: DT,
    steps: 820,
    integrateSpeed: true,
    drive: (_, speed) => ({
      speedKmh: speed,
      accelerationMs2: 0,
      throttle: 1,
      braking: 0,
    }),
  },
  {
    id: "scenario-b",
    label: "Scenario B: 0→80 gentle acceleration",
    profileId: "flat-six-sport",
    dt: DT,
    steps: 900,
    integrateSpeed: true,
    drive: (_, speed) => ({
      speedKmh: speed,
      accelerationMs2: 0,
      throttle: speed >= 78 ? 0.18 : 0.36,
      braking: 0,
    }),
  },
  {
    id: "scenario-c",
    label: "Scenario C: 80 km/h cruise → hard acceleration",
    profileId: "gt-v8",
    dt: DT,
    steps: 1400,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 560) {
        return { speedKmh: speed, accelerationMs2: 0, throttle: 0.78, braking: 0 };
      }
      if (frame < 720) {
        return { speedKmh: speed, accelerationMs2: 0, throttle: 0, braking: 0.48 };
      }
      if (frame < 980) {
        return {
          speedKmh: Math.max(77, Math.min(83, speed)),
          accelerationMs2: 0,
          throttle: 0.27,
          braking: 0,
        };
      }
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0.98, braking: 0 };
    },
  },
  {
    id: "scenario-d",
    label: "Scenario D: 120→60 braking",
    profileId: "american-v8",
    dt: DT,
    steps: 1400,
    integrateSpeed: false,
    drive: (frame) => {
      // Hold 120 long enough to settle in a high gear before braking.
      if (frame < 420) {
        return { speedKmh: 120, accelerationMs2: 0, throttle: 0.32, braking: 0 };
      }
      const elapsed = (frame - 420) * DT;
      return {
        speedKmh: Math.max(48, 120 - elapsed * 5.5),
        accelerationMs2: -1.6,
        throttle: 0.02,
        braking: 0.7,
      };
    },
  },
  {
    id: "scenario-e",
    label: "Scenario E: 100 km/h lift throttle",
    profileId: "american-v8",
    dt: DT,
    steps: 700,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 260) {
        return {
          speedKmh: Math.max(speed, 100),
          accelerationMs2: 0,
          throttle: 0.72,
          braking: 0,
        };
      }
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0.04, braking: 0 };
    },
  },
];

export function getDrivingScenario(id: string): PowertrainScenario | undefined {
  return DRIVING_SCENARIOS.find((scenario) => scenario.id === id);
}

export function runDrivingScenario(id: string, profile?: PowertrainProfile): ScenarioRunResult {
  const scenario = getDrivingScenario(id);
  if (!scenario) throw new Error(`Unknown driving scenario: ${id}`);

  if (id === "scenario-c") {
    const base = profile ?? getPowertrainProfile(scenario.profileId ?? "gt-v8");
    const kickdownProfile: PowertrainProfile = {
      ...base,
      transmission: {
        ...base.transmission,
        kickdown: {
          ...base.transmission.kickdown,
          rpmFractionOfUpshift: 0.62,
        },
      },
    };
    return runPowertrainScenario(scenario, kickdownProfile);
  }

  if (id === "scenario-e") {
    const base = profile ?? getPowertrainProfile(scenario.profileId ?? "american-v8");
    const deterministic: PowertrainProfile = {
      ...base,
      overrun: { ...base.overrun, probability: 1 },
    };
    return runPowertrainScenario(scenario, deterministic);
  }

  return runPowertrainScenario(scenario, profile);
}

export interface FusionScenarioSample {
  tMs: number;
  speedKmh: number;
  rpm: number;
  gear: number;
  targetGear: number;
  throttle: number;
  load: number;
  shifting: boolean;
  revMatchActive: boolean;
  overrun: boolean;
  drivingMode: string;
  fallbackTier: MotionFallbackTier;
  transitioning: boolean;
}

export interface FusionScenarioResult {
  scenarioId: string;
  profileId: string;
  samples: FusionScenarioSample[];
  maxSpeedJumpKmh: number;
  maxRpmJump: number;
}

export type DrivingScenarioId =
  | "scenario-a"
  | "scenario-b"
  | "scenario-c"
  | "scenario-d"
  | "scenario-e"
  | "scenario-f"
  | "scenario-g";

export const ALL_DRIVING_SCENARIO_IDS: DrivingScenarioId[] = [
  "scenario-a",
  "scenario-b",
  "scenario-c",
  "scenario-d",
  "scenario-e",
  "scenario-f",
  "scenario-g",
];

export type DrivingScenarioResult = ScenarioRunResult | FusionScenarioResult;

export function isFusionScenarioResult(
  result: DrivingScenarioResult,
): result is FusionScenarioResult {
  return "maxSpeedJumpKmh" in result;
}

function fusionSampleFromTick(
  tMs: number,
  motion: ReturnType<typeof tickSensorFusion>,
  pt: ReturnType<PowertrainSimulator["tick"]>,
): FusionScenarioSample {
  return {
    tMs,
    speedKmh: motion.speedKmh,
    rpm: pt.rpm,
    gear: pt.gear,
    targetGear: pt.targetGear,
    throttle: pt.throttle,
    load: pt.load,
    shifting: pt.shifting,
    revMatchActive: pt.revMatchActive,
    overrun: pt.overrun,
    drivingMode: pt.drivingMode,
    fallbackTier: motion.fallbackTier,
    transitioning: motion.transitioning,
  };
}

/** Apply physical bounds to fusion-backed scenarios F/G (fallback focus, not shift tuning). */
export function assertFusionScenarioPlausibility(
  result: FusionScenarioResult,
  profile?: PowertrainProfile,
): PlausibilityResult {
  const p = profile ?? getPowertrainProfile(result.profileId);
  const issues: string[] = [];
  const maxGear = p.transmission.gears;
  const maxRpmStep = p.transmission.rpm.maxRateRpmPerSec * 0.02 * 1.35;

  for (const sample of result.samples) {
    if (sample.speedKmh < -0.5) {
      issues.push(`Negative speed ${sample.speedKmh.toFixed(1)} km/h at ${sample.tMs}ms`);
    }
    if (sample.gear < 0 || sample.gear > maxGear) {
      issues.push(`Invalid gear ${sample.gear} at ${sample.tMs}ms`);
    }
    if (sample.throttle < -0.01 || sample.throttle > 1.01) {
      issues.push(`Invalid throttle ${sample.throttle.toFixed(3)} at ${sample.tMs}ms`);
    }
    if (sample.gear > 0 && sample.rpm > p.engine.redlineRpm * 1.08) {
      issues.push(`RPM ${sample.rpm.toFixed(0)} above redline at ${sample.tMs}ms`);
    }
  }

  for (let i = 1; i < result.samples.length; i += 1) {
    const prev = result.samples[i - 1]!;
    const cur = result.samples[i]!;
    if (prev.shifting || cur.shifting) continue;
    const drpm = Math.abs(cur.rpm - prev.rpm);
    if (drpm > maxRpmStep && cur.speedKmh > 5) {
      issues.push(`RPM jump ${drpm.toFixed(0)} at ${cur.tMs}ms without shift`);
    }
    const ds = Math.abs(cur.speedKmh - prev.speedKmh);
    const dtSec = (cur.tMs - prev.tMs) / 1000;
    if (dtSec > 0 && ds / dtSec > 55) {
      issues.push(`Implausible speed rate ${(ds / dtSec).toFixed(1)} km/h/s at ${cur.tMs}ms`);
    }
  }

  if (result.maxSpeedJumpKmh > 8) {
    issues.push(`Speed jump ${result.maxSpeedJumpKmh.toFixed(1)} km/h exceeds fusion limit`);
  }
  if (result.maxRpmJump > 1200) {
    issues.push(`RPM jump ${result.maxRpmJump.toFixed(0)} exceeds fusion limit`);
  }

  return { ok: issues.length === 0, issues };
}

export function runDrivingScenarioById(id: DrivingScenarioId): DrivingScenarioResult {
  switch (id) {
    case "scenario-f":
      return runPhoneSensorLossScenario();
    case "scenario-g":
      return runTelemetryReconnectScenario();
    default:
      return runDrivingScenario(id);
  }
}

export function runAllDrivingScenarios(): DrivingScenarioResult[] {
  return ALL_DRIVING_SCENARIO_IDS.map((id) => runDrivingScenarioById(id));
}

function maxFrameDelta(values: number[]): number {
  let max = 0;
  for (let i = 1; i < values.length; i += 1) {
    max = Math.max(max, Math.abs(values[i]! - values[i - 1]!));
  }
  return max;
}

/** Scenario F: phone sensor stops for 3 seconds during cruise. */
export function runPhoneSensorLossScenario(profileId = "flat-six-sport"): FusionScenarioResult {
  const sim = new PowertrainSimulator({ profileId });
  const fusion = createSensorFusion();
  fusion.initialized = true;
  fusion.speedFilteredMs = 25;
  fusion.speedAnchorMs = 25;

  const samples: FusionScenarioSample[] = [];
  const speeds: number[] = [];
  const rpms: number[] = [];

  for (let i = 0; i < 130; i += 1) {
    const now = (i + 1) * DT * 1000;
    pushMotionSample(
      fusion,
      phoneRelayMotionSample({
        timestamp: Date.now(),
        source: "phone",
        speedKmh: 90,
        accelerationLongitudinal: 0.35,
        accuracy: 8,
      }),
      now,
    );
    const motion = tickSensorFusion(fusion, { now, dt: DT });
    const pt = sim.tick(motion, DT);
    samples.push(fusionSampleFromTick(now, motion, pt));
    speeds.push(motion.speedKmh);
    rpms.push(pt.rpm);
  }

  markPhoneRelayLost(fusion);

  const gapFrames = Math.round(3 / DT);
  for (let i = 0; i < gapFrames; i += 1) {
    const now = 2200 + (i + 1) * DT * 1000;
    const motion = tickSensorFusion(fusion, { now, dt: DT });
    const pt = sim.tick(motion, DT);
    samples.push(fusionSampleFromTick(now, motion, pt));
    speeds.push(motion.speedKmh);
    rpms.push(pt.rpm);
  }

  return {
    scenarioId: "scenario-f",
    profileId,
    samples,
    maxSpeedJumpKmh: maxFrameDelta(speeds),
    maxRpmJump: maxFrameDelta(rpms),
  };
}

/** Scenario G: telemetry reconnects after stale data without RPM snap. */
export function runTelemetryReconnectScenario(profileId = "flat-six-sport"): FusionScenarioResult {
  const sim = new PowertrainSimulator({ profileId });
  const fusion = createSensorFusion();
  fusion.initialized = true;
  fusion.speedAnchorMs = 55 / 3.6;
  fusion.speedFilteredMs = 55 / 3.6;

  const samples: FusionScenarioSample[] = [];
  const reconnectRpms: number[] = [];

  for (let i = 0; i < 35; i += 1) {
    const now = (i + 1) * 40;
    pushMotionSample(
      fusion,
      vehicleTelemetryMotionSample({
        timestamp: Date.now(),
        source: "vehicle-telemetry",
        speedKmh: 55,
        accelerationLongitudinal: 0.2,
      }),
      now,
    );
    pushMotionSample(
      fusion,
      phoneRelayMotionSample({
        timestamp: Date.now(),
        source: "phone",
        speedKmh: 54,
        accelerationLongitudinal: 0.15,
        accuracy: 10,
      }),
      now,
    );
    const motion = tickSensorFusion(fusion, { now, dt: 0.04 });
    sim.tick(motion, 0.04);
  }

  tickSensorFusion(fusion, { now: 3200, dt: 0.04 });

  for (let i = 0; i < 30; i += 1) {
    const now = 3200 + (i + 1) * 40;
    pushMotionSample(
      fusion,
      phoneRelayMotionSample({
        timestamp: Date.now(),
        source: "phone",
        speedKmh: 52,
        accelerationLongitudinal: 0.1,
        accuracy: 10,
      }),
      now,
    );
    // Keep powertrain warm during stale telemetry so reconnect cannot snap RPM from a frozen axle.
    const motion = tickSensorFusion(fusion, { now, dt: 0.04 });
    sim.tick(motion, 0.04);
  }

  pushMotionSample(
    fusion,
    vehicleTelemetryMotionSample({
      timestamp: Date.now(),
      source: "vehicle-telemetry",
      speedKmh: 58,
      accelerationLongitudinal: 0.25,
    }),
    4500,
  );
  markPhoneRelayRestored(fusion);

  let prevRpm = sim.tick(tickSensorFusion(fusion, { now: 4500, dt: 0.04 }), 0.04).rpm;

  for (let i = 0; i < 40; i += 1) {
    const now = 4500 + (i + 1) * 40;
    pushMotionSample(
      fusion,
      vehicleTelemetryMotionSample({
        timestamp: Date.now(),
        source: "vehicle-telemetry",
        speedKmh: 58,
        accelerationLongitudinal: 0.25,
      }),
      now,
    );
    pushMotionSample(
      fusion,
      phoneRelayMotionSample({
        timestamp: Date.now(),
        source: "phone",
        speedKmh: 54,
        accelerationLongitudinal: 0.12,
        accuracy: 10,
      }),
      now,
    );
    const motion = tickSensorFusion(fusion, { now, dt: 0.04 });
    const pt = sim.tick(motion, 0.04);
    samples.push(fusionSampleFromTick(now, motion, pt));
    reconnectRpms.push(Math.abs(pt.rpm - prevRpm));
    prevRpm = pt.rpm;
  }

  const reconnectSpeeds = samples.map((sample) => sample.speedKmh);
  return {
    scenarioId: "scenario-g",
    profileId,
    samples,
    maxSpeedJumpKmh: maxFrameDelta(reconnectSpeeds),
    maxRpmJump: Math.max(...reconnectRpms, 0),
  };
}
