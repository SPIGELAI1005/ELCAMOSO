import type { DriveState } from "@/lib/drive/model";
import { IDLE_STATE } from "@/lib/drive/model";

export interface SymphonyDemoStep {
  label: string;
  durationSec: number;
  state: Partial<DriveState>;
}

/** ~32s parked demo: Watch your drive become an arrangement. */
export const SYMPHONY_DEMO_SEQUENCE: readonly SymphonyDemoStep[] = [
  { label: "Stopped", durationSec: 3, state: { speed: 0, throttle: 0, acceleration: 0, load: 0 } },
  {
    label: "Gentle launch",
    durationSec: 5,
    state: { speed: 8, throttle: 0.45, acceleration: 1.2, load: 0.4, speedNormalized: 0.15 },
  },
  {
    label: "Cruise",
    durationSec: 6,
    state: { speed: 22, throttle: 0.25, acceleration: 0.1, load: 0.35, speedNormalized: 0.4 },
  },
  {
    label: "Strong acceleration",
    durationSec: 5,
    state: {
      speed: 28,
      throttle: 0.9,
      acceleration: 2.8,
      load: 0.85,
      jerk: 0.6,
      speedNormalized: 0.5,
      accelerationNormalized: 0.7,
    },
  },
  {
    label: "Cruise",
    durationSec: 5,
    state: { speed: 30, throttle: 0.3, acceleration: 0, load: 0.4, speedNormalized: 0.55 },
  },
  {
    label: "Regen",
    durationSec: 4,
    state: {
      speed: 18,
      throttle: 0,
      acceleration: -1.5,
      regen: 0.65,
      load: 0.25,
      speedNormalized: 0.35,
    },
  },
  {
    label: "Stop",
    durationSec: 4,
    state: { speed: 0, throttle: 0, regen: 0.2, acceleration: -0.3, load: 0.05 },
  },
];

export function demoStateAt(elapsedSec: number, now = Date.now()): DriveState {
  let t = elapsedSec;
  for (const step of SYMPHONY_DEMO_SEQUENCE) {
    if (t <= step.durationSec) {
      return {
        ...IDLE_STATE,
        ...step.state,
        timestamp: now,
      };
    }
    t -= step.durationSec;
  }
  return { ...IDLE_STATE, timestamp: now };
}

export function demoTotalDurationSec(): number {
  return SYMPHONY_DEMO_SEQUENCE.reduce((s, step) => s + step.durationSec, 0);
}

export function demoStepLabel(elapsedSec: number): string {
  let t = elapsedSec;
  for (const step of SYMPHONY_DEMO_SEQUENCE) {
    if (t <= step.durationSec) return step.label;
    t -= step.durationSec;
  }
  return "Stopped";
}
