import type { VehicleMotionState } from "@/lib/motion/types";
import type { SimulatorControls } from "@/lib/powertrain/dev-simulator";
import {
  createSimulatorRuntime,
  motionFromSimulator,
  stepSimulatorControls,
} from "@/lib/powertrain/dev-simulator";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";

export interface PowertrainTraceSample {
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
}

export interface PowertrainScenario {
  id: string;
  label: string;
  profileId?: string;
  /** Fixed dt per step in seconds. */
  dt: number;
  steps: number;
  integrateSpeed: boolean;
  /** Control inputs per frame. */
  drive: (frame: number, speedKmh: number) => SimulatorControls;
}

export interface ScenarioRunResult {
  scenarioId: string;
  profileId: string;
  samples: PowertrainTraceSample[];
  shiftCount: number;
  gearChanges: { atMs: number; from: number; to: number }[];
}

export const POWERTRAIN_SCENARIOS: PowertrainScenario[] = [
  {
    id: "hard-0-100",
    label: "0–100 hard acceleration",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 900,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, accelerationMs2: 0, throttle: 1, braking: 0 }),
  },
  {
    id: "gentle-city",
    label: "Gentle city acceleration",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 700,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, accelerationMs2: 0, throttle: 0.42, braking: 0 }),
  },
  {
    id: "highway-kickdown",
    label: "Highway kickdown",
    profileId: "gt-v8",
    dt: 0.016,
    steps: 800,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 350) {
        return { speedKmh: Math.max(speed, 110), accelerationMs2: 0, throttle: 0.32, braking: 0 };
      }
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0.95, braking: 0 };
    },
  },
  {
    id: "brake-120",
    label: "Braking from 120",
    profileId: "american-v8",
    dt: 0.016,
    steps: 700,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 40) {
        return { speedKmh: 120, accelerationMs2: 0, throttle: 0.25, braking: 0 };
      }
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0, braking: 0.9 };
    },
  },
  {
    id: "stop-and-go",
    label: "Stop-and-go",
    profileId: "turbo-inline-6",
    dt: 0.016,
    steps: 1200,
    integrateSpeed: true,
    drive: (frame, speed) => {
      const cycle = frame % 220;
      if (cycle < 100) {
        return { speedKmh: speed, accelerationMs2: 0, throttle: 0.75, braking: 0 };
      }
      if (cycle < 160) {
        return { speedKmh: speed, accelerationMs2: 0, throttle: 0, braking: 0.85 };
      }
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0, braking: 0 };
    },
  },
];

export function getPowertrainScenario(id: string): PowertrainScenario | undefined {
  return POWERTRAIN_SCENARIOS.find((s) => s.id === id);
}

export function runPowertrainScenario(
  scenario: PowertrainScenario,
  profile?: PowertrainProfile,
): ScenarioRunResult {
  const p = profile ?? getPowertrainProfile(scenario.profileId ?? "flat-six-sport");
  const sim = new PowertrainSimulator({ profile: p });
  const runtime = createSimulatorRuntime(undefined, {
    integrateSpeed: scenario.integrateSpeed,
    maxAccelMs2: 4.8,
    maxBrakeMs2: 8.5,
  });

  let controls: SimulatorControls = { speedKmh: 0, accelerationMs2: 0, throttle: 0, braking: 0 };
  const samples: PowertrainTraceSample[] = [];
  const gearChanges: ScenarioRunResult["gearChanges"] = [];
  let prevGear = 0;
  let shiftCount = 0;

  for (let i = 0; i < scenario.steps; i += 1) {
    controls = scenario.drive(i, controls.speedKmh);
    if (scenario.integrateSpeed) {
      controls = stepSimulatorControls(runtime, controls, scenario.dt);
    }

    const tMs = Math.round(i * scenario.dt * 1000);
    const motion: VehicleMotionState = motionFromSimulator(controls, runtime, tMs, scenario.dt);
    const out: VirtualPowertrainState = sim.tick(motion, scenario.dt, {
      directThrottle: controls.throttle,
      braking: controls.braking,
    });

    if (out.gear !== prevGear && i > 0) {
      gearChanges.push({ atMs: tMs, from: prevGear, to: out.gear });
      if (prevGear > 0 && out.gear > 0) shiftCount += 1;
    }
    prevGear = out.gear;

    samples.push({
      tMs,
      speedKmh: controls.speedKmh,
      rpm: out.rpm,
      gear: out.gear,
      targetGear: out.targetGear,
      throttle: out.throttle,
      load: out.load,
      shifting: out.shifting,
      revMatchActive: out.revMatchActive,
      overrun: out.overrun,
      drivingMode: out.drivingMode,
    });
  }

  return {
    scenarioId: scenario.id,
    profileId: p.id,
    samples,
    shiftCount,
    gearChanges,
  };
}

export interface TraceValidation {
  ok: boolean;
  issues: string[];
}

/** Validate trace for hunting, impossible shifts, and RPM spikes. */
export function validatePowertrainTrace(
  result: ScenarioRunResult,
  profile: PowertrainProfile,
): TraceValidation {
  const issues: string[] = [];
  const minHold =
    Math.max(
      profile.transmission.shift.minGearHoldMs,
      profile.transmission.shift.shiftLockoutMs ?? 90,
    ) * 0.85;
  const maxRpmStep = profile.transmission.rpm.maxRateRpmPerSec * 0.02 * 1.35;

  for (let i = 1; i < result.gearChanges.length; i += 1) {
    const prev = result.gearChanges[i - 1]!;
    const cur = result.gearChanges[i]!;
    const dt = cur.atMs - prev.atMs;
    if (dt <= 0) {
      issues.push(`Repeated shift within same tick: ${prev.to}→${cur.to} at ${cur.atMs}ms`);
    } else if (dt < minHold) {
      issues.push(`Gear shift too soon: ${prev.to}→${cur.to} after ${dt}ms (min ${minHold}ms)`);
    }
    if (Math.abs(cur.to - prev.to) > 1 && prev.to > 0 && cur.to > 0) {
      issues.push(`Impossible multi-gear jump: ${prev.to}→${cur.to} at ${cur.atMs}ms`);
    }
  }

  for (let i = 1; i < result.samples.length; i += 1) {
    const a = result.samples[i - 1]!;
    const b = result.samples[i]!;
    if (a.shifting || b.shifting) continue;
    const drpm = Math.abs(b.rpm - a.rpm);
    if (drpm > maxRpmStep && b.speedKmh > 5) {
      issues.push(`RPM jump ${drpm.toFixed(0)} at ${b.tMs}ms without shift`);
    }
  }

  let bounce = 0;
  for (let i = 2; i < result.gearChanges.length; i += 1) {
    const a = result.gearChanges[i - 2]!;
    const b = result.gearChanges[i - 1]!;
    const c = result.gearChanges[i]!;
    if (a.to === c.to && b.to !== a.to && c.atMs - a.atMs < 2500) bounce += 1;
  }
  if (bounce > 2) {
    issues.push(`Gear hunting detected: ${bounce} bounce cycles`);
  }

  return { ok: issues.length === 0, issues };
}

export interface PlausibilityResult {
  ok: boolean;
  issues: string[];
}

/** Broader physical bounds on top of transmission trace validation. */
export function assertPhysicalPlausibility(
  result: ScenarioRunResult,
  profile: PowertrainProfile,
): PlausibilityResult {
  const issues = [...validatePowertrainTrace(result, profile).issues];
  const maxGear = profile.transmission.gears;

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
    if (sample.load < -0.01 || sample.load > 1.01) {
      issues.push(`Invalid load ${sample.load.toFixed(3)} at ${sample.tMs}ms`);
    }
    if (sample.gear > 0) {
      if (sample.rpm < profile.engine.idleRpm * 0.65) {
        issues.push(`RPM ${sample.rpm.toFixed(0)} below idle at ${sample.tMs}ms`);
      }
      if (sample.rpm > profile.engine.redlineRpm * 1.08) {
        issues.push(`RPM ${sample.rpm.toFixed(0)} above redline at ${sample.tMs}ms`);
      }
    }
  }

  for (let i = 1; i < result.samples.length; i += 1) {
    const prev = result.samples[i - 1]!;
    const cur = result.samples[i]!;
    if (prev.shifting || cur.shifting) continue;
    const ds = Math.abs(cur.speedKmh - prev.speedKmh);
    const dtSec = (cur.tMs - prev.tMs) / 1000;
    if (dtSec > 0 && ds / dtSec > 55) {
      issues.push(`Implausible speed rate ${(ds / dtSec).toFixed(1)} km/h/s at ${cur.tMs}ms`);
    }
  }

  return { ok: issues.length === 0, issues };
}

export function findFirstUpshiftMs(result: ScenarioRunResult): number | null {
  for (const change of result.gearChanges) {
    if (change.from >= 1 && change.to > change.from) return change.atMs;
  }
  return null;
}

/** Returns issues when upshifts fail to lower RPM after completion. */
export function verifyUpshiftRpmDrops(result: ScenarioRunResult): string[] {
  const issues: string[] = [];

  for (const change of result.gearChanges) {
    if (change.from < 1 || change.to <= change.from) continue;
    const idx = result.samples.findIndex((sample) => sample.tMs >= change.atMs);
    if (idx < 1) continue;

    const beforeRpm = Math.max(
      ...result.samples.slice(Math.max(0, idx - 10), idx).map((sample) => sample.rpm),
    );
    let afterRpm = beforeRpm;
    for (let j = idx + 1; j < Math.min(result.samples.length, idx + 45); j += 1) {
      const sample = result.samples[j]!;
      if (!sample.shifting && j > idx + 2) {
        afterRpm = sample.rpm;
        break;
      }
    }

    if (afterRpm >= beforeRpm * 0.992) {
      issues.push(
        `Upshift ${change.from}→${change.to} at ${change.atMs}ms did not drop RPM (${beforeRpm.toFixed(0)}→${afterRpm.toFixed(0)})`,
      );
    }
  }

  return issues;
}

export function expectPlausible(result: ScenarioRunResult, profile: PowertrainProfile) {
  const plausibility = assertPhysicalPlausibility(result, profile);
  if (!plausibility.ok) {
    throw new Error(plausibility.issues.join("; "));
  }
}
