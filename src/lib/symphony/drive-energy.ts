import type { DriveState } from "@/lib/drive/model";
import type {
  DriveEnergyState,
  DriveEnergyWeights,
  MovementState,
  SymphonyEnergyConfig,
} from "./types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Documented default weights for Drive Energy (sum need not be 1). */
export const DEFAULT_ENERGY_WEIGHTS: DriveEnergyWeights = {
  demand: 0.34,
  accel: 0.28,
  speed: 0.18,
  load: 0.22,
  regen: 0.35,
};

export const DEFAULT_ENERGY_CONFIG: SymphonyEnergyConfig = {
  weights: DEFAULT_ENERGY_WEIGHTS,
  energyTau: 0.55,
  momentumTau: 0.9,
  smoothnessTau: 1.1,
  tensionTau: 0.4,
};

function ema(prev: number, next: number, dt: number, tau: number): number {
  const a = 1 - Math.exp(-Math.max(dt, 1e-3) / Math.max(tau, 0.05));
  return prev + (next - prev) * a;
}

/** Speed context: highway cruise is medium, not peak. */
function speedEnergy(speedKmh: number): number {
  if (speedKmh < 2) return 0;
  // Soft curve - 120 km/h steady ≈ 0.45, not 0.75
  const n = clamp01(speedKmh / 160);
  return Math.pow(n, 0.65) * 0.72;
}

function accelEnergy(accelMps2: number, throttle: number): number {
  const a = clamp01(Math.abs(accelMps2) / 3.5);
  return clamp01(a * 0.7 + throttle * 0.45);
}

/**
 * Drive Energy: contextual intensity, not speed/maxSpeed.
 *
 * Examples (steady-state targets before smoothing):
 * - 0 km/h → ~0
 * - 120 km/h cruise, low demand → medium (~0.35–0.5)
 * - 40 km/h strong accel → high
 * - 80 km/h kickdown → high
 */
export function computeRawDriveEnergy(
  state: DriveState,
  weights: DriveEnergyWeights = DEFAULT_ENERGY_WEIGHTS,
): {
  energy: number;
  driverDemand: number;
  regenIntensity: number;
  tension: number;
  momentum: number;
  smoothness: number;
} {
  const speedKmh = state.speed * 3.6;
  const demand = clamp01(
    state.powertrain?.driverDemand ?? Math.max(state.throttle, state.load * 0.85),
  );
  const load = clamp01(state.powertrain?.engineLoad ?? state.load);
  const regen = clamp01(state.regen);
  const accel = accelEnergy(state.acceleration, state.throttle);
  const speed = speedEnergy(speedKmh);

  const positive =
    weights.demand * demand + weights.accel * accel + weights.speed * speed + weights.load * load;
  const denom = weights.demand + weights.accel + weights.speed + weights.load;
  let energy = clamp01(positive / Math.max(denom, 1e-6));
  energy = clamp01(energy * (1 - weights.regen * regen * 0.85));

  const jerkMag = clamp01(Math.abs(state.jerk));
  const tension = clamp01(accel * 0.55 + jerkMag * 0.35 + demand * 0.25);
  const momentum = clamp01(speed * 0.6 + energy * 0.4);
  const smoothness = clamp01(
    1 - jerkMag * 0.7 - Math.abs(state.accelerationNormalized - 0.15) * 0.3,
  );

  return {
    energy,
    driverDemand: demand,
    regenIntensity: regen,
    tension,
    momentum,
    smoothness,
  };
}

export interface DriveEnergyTracker {
  update(state: DriveState, dt: number): DriveEnergyState;
  snapshot(): DriveEnergyState;
  reset(): void;
}

const STATE_ENTER: Record<MovementState, number> = {
  stopped: 0.04,
  calm: 0.12,
  cruise: 0.28,
  building: 0.45,
  energetic: 0.62,
  peak: 0.82,
  decelerating: 0.35,
};

const STATE_EXIT: Record<MovementState, number> = {
  stopped: 0.08,
  calm: 0.22,
  cruise: 0.4,
  building: 0.58,
  energetic: 0.78,
  peak: 1.01,
  decelerating: 0.55,
};

function pickMovementState(
  prev: MovementState,
  energy: number,
  regen: number,
  speedKmh: number,
  accel: number,
): MovementState {
  if (speedKmh < 1.2 && energy < 0.1) return "stopped";
  if (regen > 0.35 || accel < -0.8) {
    if (prev === "stopped") return "stopped";
    return "decelerating";
  }

  const order: MovementState[] = ["stopped", "calm", "cruise", "building", "energetic", "peak"];
  let idx = order.indexOf(prev === "decelerating" ? "cruise" : prev);
  if (idx < 0) idx = 1;

  // Hysteresis: need to cross exit to go up, enter of lower to go down
  while (idx < order.length - 1 && energy >= STATE_EXIT[order[idx]!]) idx += 1;
  while (idx > 0 && energy < STATE_ENTER[order[idx]!]) idx -= 1;

  return order[idx]!;
}

export function createDriveEnergyTracker(
  config: SymphonyEnergyConfig = DEFAULT_ENERGY_CONFIG,
): DriveEnergyTracker {
  let energy = 0;
  let smoothness = 1;
  let momentum = 0;
  let tension = 0;
  let regenIntensity = 0;
  let driverDemand = 0;
  let movementState: MovementState = "stopped";
  let lastTs = 0;

  return {
    reset() {
      energy = 0;
      smoothness = 1;
      momentum = 0;
      tension = 0;
      regenIntensity = 0;
      driverDemand = 0;
      movementState = "stopped";
      lastTs = 0;
    },
    snapshot(): DriveEnergyState {
      return {
        energy,
        smoothness,
        momentum,
        tension,
        regenIntensity,
        driverDemand,
        movementState,
      };
    },
    update(state: DriveState, dtHint: number): DriveEnergyState {
      const dt =
        dtHint > 0
          ? dtHint
          : lastTs > 0
            ? Math.min(0.1, Math.max(0.001, (state.timestamp - lastTs) / 1000))
            : 1 / 60;
      lastTs = state.timestamp || lastTs;

      const raw = computeRawDriveEnergy(state, config.weights);
      energy = ema(energy, raw.energy, dt, config.energyTau);
      momentum = ema(momentum, raw.momentum, dt, config.momentumTau);
      smoothness = ema(smoothness, raw.smoothness, dt, config.smoothnessTau);
      tension = ema(tension, raw.tension, dt, config.tensionTau);
      regenIntensity = ema(regenIntensity, raw.regenIntensity, dt, 0.35);
      driverDemand = ema(driverDemand, raw.driverDemand, dt, 0.3);

      movementState = pickMovementState(
        movementState,
        energy,
        regenIntensity,
        state.speed * 3.6,
        state.acceleration,
      );

      return this.snapshot();
    },
  };
}
