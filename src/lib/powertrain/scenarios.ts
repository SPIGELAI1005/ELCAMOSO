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
  rawSpeedKmh?: number;
  displaySpeedKmh?: number;
  mechanicalSpeedKmh?: number;
  shiftDecisionSpeedKmh?: number;
  rpm: number;
  mechanicalRpm?: number;
  gear: number;
  targetGear: number;
  queuedTargetGear?: number;
  throttle: number;
  driverDemand?: number;
  load: number;
  engineLoad?: number;
  shifting: boolean;
  shiftPhase?: string;
  lastShiftReason?: string;
  revMatchActive: boolean;
  overrun: boolean;
  drivingMode: string;
  powertrainBackend?: string;
  motionSource?: string;
  fallbackTier?: string;
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
  /** Optional motion overrides after simulator mapping (GPS dropout, source switch). */
  motionPatch?: (frame: number, motion: VehicleMotionState) => Partial<VehicleMotionState>;
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
    id: "gentle-0-60",
    label: "Gentle 0–60 km/h",
    profileId: "gt-v8",
    dt: 0.016,
    steps: 900,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, accelerationMs2: 0, throttle: 0.3, braking: 0 }),
  },
  {
    id: "medium-0-100",
    label: "Medium 0–100 km/h",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 1000,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, accelerationMs2: 0, throttle: 0.55, braking: 0 }),
  },
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
    id: "wot-0-140",
    label: "WOT 0–140 km/h",
    profileId: "gt-v8",
    dt: 0.016,
    steps: 1200,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, accelerationMs2: 0, throttle: 1, braking: 0 }),
  },
  {
    id: "hard-0-140",
    label: "Hard 0–140 km/h",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 1300,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, accelerationMs2: 0, throttle: 0.92, braking: 0 }),
  },
  {
    id: "gentle-city",
    label: "Gentle city acceleration",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 900,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, accelerationMs2: 0, throttle: 0.28, braking: 0 }),
  },
  {
    id: "lift-100",
    label: "100 km/h accelerator lift",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 600,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 80) {
        return { speedKmh: 100, accelerationMs2: 0, throttle: 0.35, braking: 0 };
      }
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0, braking: 0 };
    },
  },
  {
    id: "gps-jitter-cruise",
    label: "±2 km/h GPS jitter at cruise",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 500,
    integrateSpeed: false,
    drive: (frame) => {
      const base = 80;
      const speed = base + (frame % 16 < 8 ? 2 : -2);
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0.14, braking: 0 };
    },
  },
  {
    id: "cruise-30",
    label: "30 km/h steady cruise",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 400,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 30, accelerationMs2: 0, throttle: 0.12, braking: 0 }),
  },
  {
    id: "cruise-50",
    label: "50 km/h steady cruise",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 400,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 50, accelerationMs2: 0, throttle: 0.12, braking: 0 }),
  },
  {
    id: "cruise-80",
    label: "80 km/h steady cruise",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 400,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 80, accelerationMs2: 0, throttle: 0.14, braking: 0 }),
  },
  {
    id: "cruise-100",
    label: "100 km/h steady cruise",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 400,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 100, accelerationMs2: 0, throttle: 0.14, braking: 0 }),
  },
  {
    id: "cruise-120",
    label: "120 km/h steady cruise",
    profileId: "gt-v8",
    dt: 0.016,
    steps: 400,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 120, accelerationMs2: 0, throttle: 0.16, braking: 0 }),
  },
  {
    id: "highway-kickdown",
    label: "80→120 kickdown",
    profileId: "gt-v8",
    dt: 0.016,
    steps: 800,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 350) {
        // Hold true cruise before tip-in so kickdown has a tall gear to leave.
        return { speedKmh: 80, accelerationMs2: 0, throttle: 0.18, braking: 0 };
      }
      return {
        speedKmh: Math.min(140, Math.max(speed, 80)),
        accelerationMs2: 0,
        throttle: 0.95,
        braking: 0,
      };
    },
  },
  {
    id: "decel-100-50",
    label: "100→50 deceleration",
    profileId: "american-v8",
    dt: 0.016,
    steps: 700,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 40) {
        return { speedKmh: 100, accelerationMs2: 0, throttle: 0.2, braking: 0 };
      }
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0, braking: 0.55 };
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
    label: "Stop-and-go city traffic",
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
  {
    id: "threshold-oscillation",
    label: "±2 km/h around shift threshold",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 600,
    integrateSpeed: false,
    drive: (frame) => {
      // Mid-band for gear 3 on flat-six - not on an upshift knife-edge.
      const base = 48;
      const speed = base + (frame % 20 < 10 ? 2 : -2);
      return { speedKmh: speed, accelerationMs2: 0, throttle: 0.32, braking: 0 };
    },
  },
  {
    id: "gps-dropout",
    label: "GPS dropout / reconnect",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 500,
    integrateSpeed: false,
    drive: (frame) => {
      if (frame < 90) {
        return {
          speedKmh: Math.min(70, 20 + frame * 0.6),
          accelerationMs2: 0.4,
          throttle: 0.45,
          braking: 0,
        };
      }
      return { speedKmh: 70, accelerationMs2: 0, throttle: 0.18, braking: 0 };
    },
    motionPatch: (frame, motion) => {
      if (frame >= 150 && frame < 280) {
        return {
          ...motion,
          speedKmh: 70,
          fallbackTier: "hold",
          transitioning: true,
          primarySource: "tesla-browser",
          motionConfidence: 0.3,
        };
      }
      if (frame >= 280 && frame < 320) {
        return {
          speedKmh: 70,
          fallbackTier: "browser",
          transitioning: true,
          primarySource: "tesla-browser",
          motionConfidence: 0.65,
        };
      }
      return {};
    },
  },
  {
    id: "source-transition",
    label: "Sensor-source transition",
    profileId: "flat-six-sport",
    dt: 0.016,
    steps: 500,
    integrateSpeed: false,
    // Mid-band cruise well clear of light-demand upshift boundaries after Road Feel V3.
    drive: () => ({ speedKmh: 70, accelerationMs2: 0, throttle: 0.14, braking: 0 }),
    motionPatch: (frame) => {
      if (frame < 200) {
        return { primarySource: "tesla-browser", fallbackTier: "browser", transitioning: false };
      }
      return {
        primarySource: "phone",
        fallbackTier: "phone",
        transitioning: frame < 230,
        sourceHealth: { phone: true, browser: true, vehicleTelemetry: false },
      };
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
    let motion: VehicleMotionState = motionFromSimulator(controls, runtime, tMs, scenario.dt);
    if (scenario.motionPatch) {
      motion = { ...motion, ...scenario.motionPatch(i, motion) };
    }
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
      mechanicalRpm: out.mechanicalRpm,
      gear: out.gear,
      targetGear: out.targetGear,
      queuedTargetGear: out.queuedTargetGear,
      throttle: out.throttle,
      driverDemand: out.driverDemand,
      load: out.load,
      engineLoad: out.engineLoad,
      shifting: out.shifting,
      revMatchActive: out.revMatchActive,
      overrun: out.overrun,
      drivingMode: out.drivingMode,
      ...(out.diagnostics?.displaySpeedKmh !== undefined
        ? {
            displaySpeedKmh: out.diagnostics.displaySpeedKmh,
            rawSpeedKmh: out.diagnostics.displaySpeedKmh,
          }
        : {}),
      ...(out.diagnostics?.mechanicalSpeedKmh !== undefined
        ? { mechanicalSpeedKmh: out.diagnostics.mechanicalSpeedKmh }
        : {}),
      ...(out.diagnostics?.shiftDecisionSpeedKmh !== undefined
        ? { shiftDecisionSpeedKmh: out.diagnostics.shiftDecisionSpeedKmh }
        : {}),
      ...(out.shiftPhase !== undefined ? { shiftPhase: out.shiftPhase } : {}),
      ...(out.lastShiftReason !== undefined ? { lastShiftReason: out.lastShiftReason } : {}),
      ...(out.diagnostics?.powertrainBackend !== undefined
        ? { powertrainBackend: out.diagnostics.powertrainBackend }
        : {}),
      ...(out.diagnostics?.motionSource !== undefined
        ? { motionSource: out.diagnostics.motionSource }
        : {}),
      ...(out.diagnostics?.fallbackTier !== undefined
        ? { fallbackTier: out.diagnostics.fallbackTier }
        : {}),
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
    } else if (dt < minHold && prev.to > 0 && cur.to > 0 && prev.from > 0) {
      issues.push(`Gear shift too soon: ${prev.to}→${cur.to} after ${dt}ms (min ${minHold}ms)`);
    }
    if (Math.abs(cur.to - cur.from) > 1 && cur.from > 0 && cur.to > 0) {
      issues.push(`Impossible multi-gear jump: ${cur.from}→${cur.to} at ${cur.atMs}ms`);
    }
  }

  for (let i = 1; i < result.samples.length; i += 1) {
    const a = result.samples[i - 1]!;
    const b = result.samples[i]!;
    if (a.shifting || b.shifting) continue;
    const drpm = Math.abs(b.rpm - a.rpm);
    if (drpm > maxRpmStep && b.speedKmh > 5 && a.gear === b.gear && b.gear > 0) {
      issues.push(`RPM jump ${drpm.toFixed(0)} at ${b.tMs}ms without shift`);
    }
    if (b.powertrainBackend && b.powertrainBackend !== "dynamic") {
      issues.push(`Expected dynamic backend, got ${b.powertrainBackend}`);
    }
  }

  let bounce = 0;
  for (let i = 2; i < result.gearChanges.length; i += 1) {
    const a = result.gearChanges[i - 2]!;
    const b = result.gearChanges[i - 1]!;
    const c = result.gearChanges[i]!;
    // Ignore N↔1 creep chatter - covered by engagement hold tests.
    if (a.to === 0 || b.to === 0 || c.to === 0 || a.from === 0) continue;
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
    if (change.from < 1 || change.to !== change.from + 1) continue;
    const idx = result.samples.findIndex((sample) => sample.tMs >= change.atMs);
    if (idx < 1) continue;

    const beforeRpm = Math.max(
      ...result.samples.slice(Math.max(0, idx - 10), idx).map((sample) => sample.rpm),
    );
    const afterWindow = result.samples.slice(idx + 1, Math.min(result.samples.length, idx + 50));
    const settled = afterWindow.filter((sample, j) => !sample.shifting && j > 2);
    if (settled.length === 0) continue; // next shift queued immediately - skip this edge
    const afterRpm = Math.min(...settled.slice(0, 12).map((sample) => sample.rpm));

    const beforeSample = result.samples[Math.max(0, idx - 3)]!;
    const afterSample = result.samples[Math.min(result.samples.length - 1, idx + 12)]!;
    if (afterSample.speedKmh > beforeSample.speedKmh + 8) continue;

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
