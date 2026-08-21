import type { DriveState } from "@/lib/drive/model";
import { computeDriveState, IDLE_STATE } from "@/lib/drive/model";
import { getProfile } from "@/lib/sound/profiles";

export interface DebugScenario {
  id: string;
  label: string;
  /** vehicle-style vs free-movement wording */
  family: "vehicle" | "motion";
  /** build a sequence of drive states at 60 Hz */
  build: (profileId: string, durationSec?: number) => DriveState[];
}

function simulate(
  profileId: string,
  seconds: number,
  sample: (t: number, prev: DriveState) => { speed: number; acceleration: number },
): DriveState[] {
  const profile = getProfile(profileId);
  const frames = Math.max(1, Math.floor(seconds * 60));
  const out: DriveState[] = [];
  let previous = { ...IDLE_STATE };
  for (let i = 0; i < frames; i += 1) {
    const t = i / frames;
    const { speed, acceleration } = sample(t, previous);
    previous = computeDriveState({
      speed,
      acceleration,
      previous,
      profile,
      dt: 1 / 60,
    });
    out.push(previous);
  }
  return out;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** km/h → m/s */
function mps(kmh: number) {
  return kmh / 3.6;
}

export const DEBUG_SCENARIOS: DebugScenario[] = [
  {
    id: "idle",
    label: "Idle",
    family: "vehicle",
    build: (id, dur = 4) => simulate(id, dur, () => ({ speed: 0, acceleration: 0 })),
  },
  {
    id: "0-30-gentle",
    label: "0 → 30 gentle",
    family: "vehicle",
    build: (id, dur = 8) =>
      simulate(id, dur, (t) => ({
        speed: mps(lerp(0, 30, t)),
        acceleration: 0.8,
      })),
  },
  {
    id: "0-100-hard",
    label: "0 → 100 hard",
    family: "vehicle",
    build: (id, dur = 7) =>
      simulate(id, dur, (t) => ({
        speed: mps(lerp(0, 100, Math.pow(t, 0.85))),
        acceleration: 3.2,
      })),
  },
  {
    id: "30-80-hard",
    label: "30 → 80 hard",
    family: "vehicle",
    build: (id, dur = 5) =>
      simulate(id, dur, (t) => ({
        speed: mps(lerp(30, 80, t)),
        acceleration: 2.6,
      })),
  },
  {
    id: "80-cruise",
    label: "80 constant cruise",
    family: "vehicle",
    build: (id, dur = 6) =>
      simulate(id, dur, () => ({ speed: mps(80), acceleration: 0.05 })),
  },
  {
    id: "100-0-lift",
    label: "100 → 0 lift-off",
    family: "vehicle",
    build: (id, dur = 6) =>
      simulate(id, dur, (t) => ({
        speed: mps(lerp(100, 0, t)),
        acceleration: -1.2,
      })),
  },
  {
    id: "100-0-regen",
    label: "100 → 0 strong regen",
    family: "vehicle",
    build: (id, dur = 5) =>
      simulate(id, dur, (t) => ({
        speed: mps(lerp(100, 0, t)),
        acceleration: -3.4,
      })),
  },
  {
    id: "rapid-throttle",
    label: "Rapid throttle changes",
    family: "vehicle",
    build: (id, dur = 8) =>
      simulate(id, dur, (t) => {
        const pulse = Math.sin(t * Math.PI * 8);
        return {
          speed: mps(40 + pulse * 12),
          acceleration: pulse * 3.5,
        };
      }),
  },
  {
    id: "slow-crawl",
    label: "Slow crawl",
    family: "motion",
    build: (id, dur = 5) =>
      simulate(id, dur, () => ({ speed: mps(6), acceleration: 0.2 })),
  },
  {
    id: "medium-move",
    label: "Medium movement",
    family: "motion",
    build: (id, dur = 5) =>
      simulate(id, dur, () => ({ speed: mps(28), acceleration: 0.4 })),
  },
  {
    id: "fast-move",
    label: "Fast movement",
    family: "motion",
    build: (id, dur = 5) =>
      simulate(id, dur, () => ({ speed: mps(70), acceleration: 0.3 })),
  },
  {
    id: "hard-accel",
    label: "Hard acceleration",
    family: "motion",
    build: (id, dur = 4) =>
      simulate(id, dur, (t) => ({
        speed: mps(lerp(0, 55, t)),
        acceleration: 3.0,
      })),
  },
  {
    id: "steady",
    label: "Steady movement",
    family: "motion",
    build: (id, dur = 5) =>
      simulate(id, dur, () => ({ speed: mps(45), acceleration: 0 })),
  },
  {
    id: "lift-off",
    label: "Lift-off",
    family: "motion",
    build: (id, dur = 4) =>
      simulate(id, dur, (t) => ({
        speed: mps(lerp(50, 10, t)),
        acceleration: -1.5,
      })),
  },
  {
    id: "stop",
    label: "Stop",
    family: "motion",
    build: (id, dur = 3) =>
      simulate(id, dur, (t) => ({
        speed: mps(lerp(20, 0, t)),
        acceleration: -2,
      })),
  },
];

export function getDebugScenario(id: string) {
  return DEBUG_SCENARIOS.find((s) => s.id === id) ?? DEBUG_SCENARIOS[0]!;
}
