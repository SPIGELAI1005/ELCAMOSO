import { audioRandom } from "@/lib/sound/rng";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";

export interface OverrunState {
  active: boolean;
  lastEventAt: number;
  cooldownUntil: number;
}

export function createOverrunState(): OverrunState {
  return { active: false, lastEventAt: 0, cooldownUntil: 0 };
}

export interface OverrunInput {
  throttle: number;
  previousThrottle: number;
  /** Instant pedal request before smoothing (simulator / future pedal telemetry). */
  pedalRequest?: number;
  accelerationFiltered: number;
  speedKmh: number;
  now: number;
  profile: PowertrainProfile;
  state: OverrunState;
}

export interface OverrunResult {
  overrun: boolean;
  state: OverrunState;
}

/** Lift-off detection with cooldown — no spam on every decel sample. */
export function updateOverrun(input: OverrunInput): OverrunResult {
  const { profile, now, state } = input;
  const cfg = profile.overrun;

  const pedal = input.pedalRequest ?? input.throttle;
  const wasLoaded = input.previousThrottle >= cfg.minPriorThrottle;
  const pedalLift = wasLoaded && pedal <= cfg.minPriorThrottle * 0.45;
  const filteredLift = input.throttle < input.previousThrottle - 0.08;
  const lifting = pedalLift || filteredLift;
  const accelLow = input.accelerationFiltered < cfg.liftOffAccelThreshold + 0.35;
  const moving = input.speedKmh > 25;
  const cooled = now >= state.cooldownUntil;

  let triggered = wasLoaded && lifting && accelLow && moving && cooled;
  if (triggered && cfg.probability < 1 && audioRandom() > cfg.probability) {
    triggered = false;
  }

  if (triggered) {
    const next: OverrunState = {
      active: true,
      lastEventAt: now,
      cooldownUntil: now + cfg.minIntervalMs,
    };
    return { overrun: true, state: next };
  }

  const stillActive = state.active && now - state.lastEventAt < 450;
  return {
    overrun: stillActive,
    state: { ...state, active: stillActive },
  };
}
