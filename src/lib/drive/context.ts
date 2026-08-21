import type { DriveState } from "@/lib/drive/model";

/** On-device driving context. No GPS trail. */
export type DriveContext = "city" | "cruise" | "spirited" | "regen";

export const DRIVE_CONTEXTS: { id: DriveContext; name: string; hint: string }[] = [
  { id: "city", name: "City", hint: "Crawling and stop-start" },
  { id: "cruise", name: "Cruise", hint: "Steady highway pace" },
  { id: "spirited", name: "Spirited", hint: "Back-road throttle" },
  { id: "regen", name: "Regen", hint: "Downhill recovery" },
];

const WINDOW = 48;

/**
 * Rolling classifier over fused DriveState. Uses short averages of speed,
 * throttle, regen and acceleration so profile rules can react without a map.
 */
export class ContextClassifier {
  private speeds: number[] = [];
  private throttles: number[] = [];
  private regens: number[] = [];
  private accels: number[] = [];
  private current: DriveContext = "city";

  reset() {
    this.speeds = [];
    this.throttles = [];
    this.regens = [];
    this.accels = [];
    this.current = "city";
  }

  push(state: DriveState): DriveContext {
    this.speeds.push(state.speed);
    this.throttles.push(state.throttle);
    this.regens.push(state.regen);
    this.accels.push(state.acceleration);
    if (this.speeds.length > WINDOW) {
      this.speeds.shift();
      this.throttles.shift();
      this.regens.shift();
      this.accels.shift();
    }
    this.current = classifyWindow(this.speeds, this.throttles, this.regens, this.accels);
    return this.current;
  }

  value(): DriveContext {
    return this.current;
  }
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function classifyWindow(
  speeds: number[],
  throttles: number[],
  regens: number[],
  accels: number[],
): DriveContext {
  const kmh = mean(speeds) * 3.6;
  const throttle = mean(throttles);
  const regen = mean(regens);
  const accel = mean(accels);

  if (regen > 0.35 && accel < -0.4) return "regen";
  if (throttle > 0.55 && accel > 0.8 && kmh > 25) return "spirited";
  if (kmh >= 70 && throttle < 0.55 && regen < 0.3) return "cruise";
  if (kmh < 45) return "city";
  if (throttle > 0.45 && kmh >= 45) return "spirited";
  return "cruise";
}

/** Extrapolate speed for Bluetooth latency compensation (motion lookahead). */
export function predictState(state: DriveState, lookaheadMs: number): DriveState {
  const dt = Math.min(0.25, Math.max(0, lookaheadMs) / 1000);
  if (dt <= 0) return state;
  const speed = Math.max(0, state.speed + state.acceleration * dt);
  return { ...state, speed };
}
