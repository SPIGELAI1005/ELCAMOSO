import type { DriveState } from "@/lib/drive/model";
import type { DriveEnergyState, SymphonySemanticEvent } from "./types";

export interface SemanticEventRecord {
  type: SymphonySemanticEvent;
  at: number;
}

interface EventBusOptions {
  /** Min seconds between same event type */
  cooldownSec?: Partial<Record<SymphonySemanticEvent, number>>;
  seed?: number;
}

const DEFAULT_COOLDOWNS: Partial<Record<SymphonySemanticEvent, number>> = {
  energy_rise: 2.5,
  energy_fall: 2.5,
  strong_acceleration: 3.5,
  upshift: 1.8,
  downshift: 1.8,
  kickdown: 4,
  cruise_enter: 4,
  cruise_exit: 3,
  regen_started: 2.5,
  lift: 2,
  vehicle_stopped: 2,
};

/**
 * Semantic musical event bus - rate-limited, no Powertrain internals.
 */
export function createSymphonyEventBus(options: EventBusOptions = {}) {
  const cooldowns = { ...DEFAULT_COOLDOWNS, ...options.cooldownSec };
  const lastFired = new Map<SymphonySemanticEvent, number>();
  const pending: SemanticEventRecord[] = [];
  let prevEnergy = 0;
  let prevMovement = "";
  let prevRegen = 0;
  let prevThrottle = 0;
  let prevGear = 0;
  let prevShifting = false;
  let started = false;
  let moving = false;

  function tryEmit(type: SymphonySemanticEvent, at: number): boolean {
    const cd = cooldowns[type] ?? 1.5;
    const last = lastFired.get(type) ?? -Infinity;
    if (at - last < cd) return false;
    lastFired.set(type, at);
    pending.push({ type, at });
    return true;
  }

  return {
    reset() {
      lastFired.clear();
      pending.length = 0;
      prevEnergy = 0;
      prevMovement = "";
      prevRegen = 0;
      prevThrottle = 0;
      prevGear = 0;
      prevShifting = false;
      started = false;
      moving = false;
    },
    drain(): SemanticEventRecord[] {
      return pending.splice(0, pending.length);
    },
    pendingCount() {
      return pending.length;
    },
    observe(state: DriveState, energy: DriveEnergyState, audioTime: number) {
      if (!started) {
        started = true;
        tryEmit("drive_started", audioTime);
      }

      const speedKmh = state.speed * 3.6;
      if (!moving && speedKmh > 3) {
        moving = true;
        tryEmit("movement_started", audioTime);
      }
      if (moving && speedKmh < 1.2 && energy.energy < 0.12) {
        moving = false;
        tryEmit("vehicle_stopped", audioTime);
      }

      if (energy.energy - prevEnergy > 0.12) tryEmit("energy_rise", audioTime);
      if (prevEnergy - energy.energy > 0.12) tryEmit("energy_fall", audioTime);

      if (state.throttle > 0.78 && state.acceleration > 1.8) {
        tryEmit("strong_acceleration", audioTime);
      }
      if (prevThrottle > 0.45 && state.throttle < 0.2 && state.acceleration < 0.2) {
        tryEmit("lift", audioTime);
      }
      if (state.regen > 0.4 && prevRegen <= 0.4) tryEmit("regen_started", audioTime);

      if (energy.movementState === "cruise" && prevMovement !== "cruise") {
        tryEmit("cruise_enter", audioTime);
      }
      if (prevMovement === "cruise" && energy.movementState !== "cruise") {
        tryEmit("cruise_exit", audioTime);
      }

      const gear = state.powertrain?.gear ?? state.gear;
      const shifting = Boolean(state.powertrain?.shifting ?? state.isShifting);
      if (shifting && !prevShifting && gear > 0 && prevGear > 0) {
        if (gear > prevGear) tryEmit("upshift", audioTime);
        else if (gear < prevGear) tryEmit("downshift", audioTime);
      }
      if (
        state.throttle > 0.85 &&
        (state.powertrain?.driverDemand ?? state.throttle) > 0.9 &&
        state.acceleration > 2.2
      ) {
        tryEmit("kickdown", audioTime);
      }

      prevEnergy = energy.energy;
      prevMovement = energy.movementState;
      prevRegen = state.regen;
      prevThrottle = state.throttle;
      if (gear > 0) prevGear = gear;
      prevShifting = shifting;
    },
  };
}

export type SymphonyEventBus = ReturnType<typeof createSymphonyEventBus>;
