import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import type { DemoDriveId } from "./types";

export interface StudioDemoTrace {
  id: DemoDriveId;
  label: string;
  durationSec: number;
  /** Deterministic seed for A/B */
  seed: number;
}

export const STUDIO_DEMO_TRACES: StudioDemoTrace[] = [
  { id: "gentle", label: "Gentle", durationSec: 28, seed: 11 },
  { id: "city", label: "City", durationSec: 32, seed: 22 },
  { id: "highway", label: "Highway", durationSec: 36, seed: 33 },
  { id: "energetic", label: "Energetic", durationSec: 30, seed: 44 },
];

/**
 * Scripted motion for Studio demos - replayable while editing.
 * Same id + elapsed → same DriveState (A/B safe).
 */
export function studioDemoStateAt(id: DemoDriveId, elapsedSec: number): DriveState {
  const trace = STUDIO_DEMO_TRACES.find((t) => t.id === id) ?? STUDIO_DEMO_TRACES[0]!;
  const t = ((elapsedSec % trace.durationSec) + trace.durationSec) % trace.durationSec;
  const u = t / trace.durationSec;

  let speed = 0;
  let throttle = 0;
  let regen = 0;
  let accel = 0;

  switch (id) {
    case "gentle":
      speed =
        u < 0.15 ? u * 40 : u < 0.75 ? 8 + Math.sin(u * 6) * 1.5 : 8 * (1 - (u - 0.75) / 0.25);
      throttle = u > 0.1 && u < 0.7 ? 0.25 : 0.08;
      regen = u > 0.8 ? 0.35 : 0;
      accel = throttle * 0.8 - regen;
      break;
    case "city":
      speed = 6 + Math.sin(u * 14) * 5 + u * 4;
      throttle = 0.35 + Math.sin(u * 18) * 0.25;
      regen = Math.sin(u * 9) < -0.6 ? 0.45 : 0.05;
      accel = throttle * 1.2 - regen * 1.5;
      break;
    case "highway":
      speed =
        u < 0.2 ? u * 100 : u < 0.85 ? 28 + Math.sin(u * 4) * 1.2 : 28 * (1 - (u - 0.85) / 0.15);
      throttle = u > 0.15 && u < 0.8 ? 0.32 : 0.1;
      regen = u > 0.88 ? 0.4 : 0;
      accel = u < 0.2 ? 1.5 : throttle * 0.4 - regen;
      break;
    case "energetic":
      speed = 10 + u * 25 + Math.sin(u * 20) * 4;
      throttle = 0.55 + Math.sin(u * 22) * 0.35;
      regen = Math.sin(u * 11) < -0.7 ? 0.55 : 0;
      accel = throttle * 2.2 - regen * 2;
      break;
  }

  speed = Math.max(0, speed);
  const load = Math.min(1, throttle * 0.65 + speed / 40 + Math.max(0, accel) * 0.08);
  return {
    ...IDLE_STATE,
    speed,
    acceleration: accel,
    throttle: Math.min(1, Math.max(0, throttle)),
    regen: Math.min(1, Math.max(0, regen)),
    load,
    rpm: 800 + load * 4500,
    gear: speed < 8 ? 2 : speed < 18 ? 3 : speed < 28 ? 4 : 5,
    jerk: Math.max(-1, Math.min(1, accel * 0.15)),
    timestamp: Date.now(),
    speedNormalized: Math.min(1, speed / 44),
    accelerationNormalized: Math.min(1, Math.abs(accel) / 4.5),
    isShifting: false,
  };
}
