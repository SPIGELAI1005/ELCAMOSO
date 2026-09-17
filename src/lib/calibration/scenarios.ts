import { buildCalibrationTrace } from "@/lib/calibration/serialize";
import type { CalibrationTrace, CalibrationTraceSample } from "@/lib/calibration/types";
import { createEmptySample } from "@/lib/calibration/types";
import { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";

export interface CalibrationScenarioDef {
  id: string;
  label: string;
  description: string;
  profileId: string;
  dt: number;
  steps: number;
  /** Build control inputs; speed may be integrated if integrateSpeed. */
  integrateSpeed: boolean;
  drive: (
    frame: number,
    speedKmh: number,
  ) => {
    speedKmh: number;
    throttle: number;
    braking: number;
    accelerationMs2?: number;
  };
  motionPatch?: (frame: number) => Partial<{
    primarySource: string;
    fallbackTier: string;
    transitioning: boolean;
    motionConfidence: number;
    speedKmh: number;
  }>;
}

function integrate(speed: number, throttle: number, braking: number, dt: number): number {
  const accel = throttle * 4.2 - braking * 7.5 - speed * 0.015;
  return Math.max(0, speed + accel * dt * 3.6);
}

export const CALIBRATION_SCENARIOS: CalibrationScenarioDef[] = [
  {
    id: "gentle-city-launch",
    label: "Gentle city launch",
    description: "Light throttle 0→50 km/h",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 500,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, throttle: 0.28, braking: 0 }),
  },
  {
    id: "normal-city-accel",
    label: "Normal city acceleration",
    description: "Medium throttle 0→80 km/h",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 600,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, throttle: 0.5, braking: 0 }),
  },
  {
    id: "hard-accel",
    label: "Hard acceleration",
    description: "WOT 0→120 km/h",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 700,
    integrateSpeed: true,
    drive: (_, speed) => ({ speedKmh: speed, throttle: 1, braking: 0 }),
  },
  {
    id: "stop-and-go",
    label: "Slow stop-and-go",
    description: "Cyclic creep and brake",
    profileId: "flat-six-sport",
    dt: 0.05,
    steps: 800,
    integrateSpeed: true,
    drive: (frame, speed) => {
      const c = frame % 160;
      if (c < 70) return { speedKmh: speed, throttle: 0.45, braking: 0 };
      if (c < 120) return { speedKmh: speed, throttle: 0, braking: 0.7 };
      return { speedKmh: speed, throttle: 0, braking: 0 };
    },
  },
  {
    id: "cruise-50",
    label: "50 km/h steady",
    description: "Stable cruise",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 400,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 50, throttle: 0.12, braking: 0 }),
  },
  {
    id: "cruise-80",
    label: "80 km/h steady",
    description: "Stable cruise",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 400,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 80, throttle: 0.14, braking: 0 }),
  },
  {
    id: "cruise-120",
    label: "120 km/h steady",
    description: "Highway cruise",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 400,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 120, throttle: 0.18, braking: 0 }),
  },
  {
    id: "highway-kickdown",
    label: "Highway kickdown",
    description: "80 km/h cruise then tip-in",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 500,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 200) return { speedKmh: 80, throttle: 0.16, braking: 0 };
      return { speedKmh: Math.min(140, Math.max(speed, 80)), throttle: 0.95, braking: 0 };
    },
  },
  {
    id: "lift-off-100",
    label: "Lift-off from 100 km/h",
    description: "Steady then closed throttle",
    profileId: "american-muscle-v8",
    dt: 0.05,
    steps: 400,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 80) return { speedKmh: 100, throttle: 0.35, braking: 0 };
      return { speedKmh: speed, throttle: 0, braking: 0 };
    },
  },
  {
    id: "progressive-brake",
    label: "Progressive braking to stop",
    description: "100→0 with rising brake",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 400,
    integrateSpeed: true,
    drive: (frame, speed) => {
      if (frame < 40) return { speedKmh: 100, throttle: 0.2, braking: 0 };
      const b = Math.min(1, 0.25 + (frame - 40) * 0.004);
      return { speedKmh: speed, throttle: 0, braking: b };
    },
  },
  {
    id: "urban-30-50",
    label: "Repeated 30–50 urban",
    description: "Accel/decel cycles",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 900,
    integrateSpeed: true,
    drive: (frame, speed) => {
      const c = frame % 180;
      if (c < 90) return { speedKmh: speed, throttle: 0.55, braking: 0 };
      return { speedKmh: speed, throttle: 0, braking: 0.45 };
    },
  },
  {
    id: "noisy-gps-2",
    label: "Noisy GPS ±2 km/h",
    description: "Threshold oscillation",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 400,
    integrateSpeed: false,
    drive: (frame) => {
      const base = 80;
      const n = frame % 8 < 4 ? 2 : -2;
      return { speedKmh: base + n, throttle: 0.14, braking: 0 };
    },
  },
  {
    id: "gps-spike",
    label: "Single GPS spike",
    description: "Brief +15 km/h spike then recover",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 300,
    integrateSpeed: false,
    drive: (frame) => {
      const speed = frame >= 100 && frame < 104 ? 95 : 80;
      return { speedKmh: speed, throttle: 0.14, braking: 0 };
    },
  },
  {
    id: "gps-dropout",
    label: "GPS dropout",
    description: "Hold/decay then restore",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 360,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 70, throttle: 0.2, braking: 0 }),
    motionPatch: (frame) => {
      if (frame >= 100 && frame < 180) {
        return {
          fallbackTier: "hold",
          transitioning: true,
          motionConfidence: 0.25,
          primarySource: "tesla-browser",
        };
      }
      if (frame >= 180 && frame < 220) {
        return { fallbackTier: "browser", transitioning: true, motionConfidence: 0.6 };
      }
      return {};
    },
  },
  {
    id: "phone-relay-reconnect",
    label: "Phone relay disconnect/reconnect",
    description: "Source switch without route data",
    profileId: "gt-v8",
    dt: 0.05,
    steps: 360,
    integrateSpeed: false,
    drive: () => ({ speedKmh: 80, throttle: 0.14, braking: 0 }),
    motionPatch: (frame) => {
      if (frame < 120) {
        return { primarySource: "tesla-browser", fallbackTier: "browser", transitioning: false };
      }
      return {
        primarySource: "phone",
        fallbackTier: "phone",
        transitioning: frame < 160,
        motionConfidence: frame < 160 ? 0.5 : 0.9,
      };
    },
  },
];

export function getCalibrationScenario(id: string): CalibrationScenarioDef | undefined {
  return CALIBRATION_SCENARIOS.find((s) => s.id === id);
}

/** Generate a deterministic calibration trace from a named scenario. */
export function runCalibrationScenario(def: CalibrationScenarioDef): CalibrationTrace {
  const profile = getPowertrainProfile(
    def.profileId === "american-muscle-v8"
      ? "american-v8"
      : def.profileId === "gt-v8"
        ? "gt-v8"
        : "flat-six-sport",
  );
  // Prefer matching powertrain id when available
  let ptId = "gt-v8";
  try {
    const ids = ["gt-v8", "flat-six-sport", "american-v8", "turbo-inline-6"];
    if (def.profileId === "american-muscle-v8") ptId = "american-v8";
    else if (ids.includes(def.profileId)) ptId = def.profileId;
    else if (def.profileId === "flat-six-sport") ptId = "flat-six-sport";
  } catch {
    ptId = "gt-v8";
  }
  const sim = new PowertrainSimulator({
    profile: getPowertrainProfile(ptId) ?? profile,
  });

  const samples: CalibrationTraceSample[] = [];
  let speed = 0;
  let prevAccel = 0;

  for (let i = 0; i < def.steps; i += 1) {
    let controls = def.drive(i, speed);
    if (def.integrateSpeed) {
      speed = integrate(speed, controls.throttle, controls.braking, def.dt);
      controls = { ...controls, speedKmh: speed };
    } else {
      speed = controls.speedKmh;
    }
    const tMs = Math.round(i * def.dt * 1000);
    const patch = def.motionPatch?.(i) ?? {};
    const accel =
      controls.accelerationMs2 ?? controls.throttle * 3.5 - controls.braking * 6 - speed * 0.01;
    const motion = {
      ...IDLE_VEHICLE_MOTION,
      timestamp: tMs,
      speedKmh: patch.speedKmh ?? controls.speedKmh,
      accelerationMs2: accel,
      accelerationFiltered: accel * 0.85 + prevAccel * 0.15,
      inferredThrottle: controls.throttle,
      motionConfidence: patch.motionConfidence ?? 1,
      primarySource:
        (patch.primarySource as typeof IDLE_VEHICLE_MOTION.primarySource) ?? "simulator",
      fallbackTier: (patch.fallbackTier as typeof IDLE_VEHICLE_MOTION.fallbackTier) ?? "decay",
      transitioning: patch.transitioning ?? false,
      sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
      decelerationMs2: Math.max(0, -accel),
    };
    const out = sim.tick(motion, def.dt, {
      directThrottle: controls.throttle,
      braking: controls.braking,
    });
    const jerk = (motion.accelerationFiltered - prevAccel) / def.dt;
    prevAccel = motion.accelerationFiltered;
    samples.push({
      ...createEmptySample(tMs),
      speedKmh: motion.speedKmh,
      rawSpeedKmh: motion.speedKmh,
      fusedSpeedKmh: out.diagnostics?.displaySpeedKmh ?? motion.speedKmh,
      mechanicalSpeedKmh: out.diagnostics?.mechanicalSpeedKmh ?? null,
      shiftDecisionSpeedKmh: out.diagnostics?.shiftDecisionSpeedKmh ?? null,
      accelerationMs2: motion.accelerationMs2,
      accelerationFilteredMs2: motion.accelerationFiltered,
      jerk,
      driverDemand: out.driverDemand,
      engineLoad: out.engineLoad,
      braking: controls.braking,
      motionSource: motion.primarySource,
      motionConfidence: motion.motionConfidence,
      fallbackTier: motion.fallbackTier,
      transitioning: motion.transitioning,
      gear: out.gear,
      targetGear: out.targetGear,
      queuedTargetGear: out.queuedTargetGear,
      rpm: out.rpm,
      mechanicalRpm: out.mechanicalRpm,
      shifting: out.shifting,
      shiftPhase: out.shiftPhase ?? "idle",
      shiftProgress: out.shiftProgress ?? 0,
      shiftDirection: out.shiftDirection ?? null,
      lastShiftReason: out.lastShiftReason ?? "none",
      overrun: out.overrun,
      powertrainBackend: "dynamic",
    });
  }

  return buildCalibrationTrace(
    samples,
    {
      profileId: def.profileId,
      personalityId: ptId,
      realismEngine: "unknown",
      dynamicDrive: true,
      synthesisMode: "improved",
      label: def.label,
      recordedAt: new Date().toISOString(),
      origin: "scenario",
      scenarioId: def.id,
    },
    [],
    `scenario-${def.id}`,
  );
}
