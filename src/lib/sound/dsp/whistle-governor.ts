/**
 * Whistle governor: keeps tonal whistle / shimmer layers brief.
 *
 * George: a sustained whistle in the space sounds gets annoying over long periods. Shimmer may
 * swell only transiently (a launch or a build onset, ~1-1.5 s, then it decays back to a low
 * floor) and it ducks under the thrust bass. Returns a gain factor (0..1) to multiply into the
 * whistle layers.
 */
import { clamp } from "@/lib/sound/dsp/math";

export interface WhistleGovernorOpts {
  /** Sustained level relative to the authored gain (0..1). */
  floor: number;
  /** How much thrust ducks the whistle (0..1). */
  duck: number;
  /** Seconds the swell holds at full before decaying. */
  holdS?: number;
  /** Decay time constant (s) after the hold. */
  decayS?: number;
  /** Minimum seconds between swells. */
  cooldownS?: number;
}

export interface WhistleGovernor {
  /** Start a swell (ignored inside the cooldown). */
  trigger(t: number, strength?: number): boolean;
  /**
   * Current factor. `thrust` 0..1 ducks it; `moving` 0..1 blends from 1 (standstill, authored
   * behaviour kept) to the governed factor while driving.
   */
  factor(t: number, thrust: number, moving?: number): number;
  readonly swells: number;
}

export function createWhistleGovernor(o: WhistleGovernorOpts): WhistleGovernor {
  const hold = o.holdS ?? 0.5;
  const decay = o.decayS ?? 0.4;
  const cooldown = o.cooldownS ?? 8;
  let start = -1e9;
  let strengthNow = 1;
  let next = -1e9;
  let swells = 0;
  return {
    get swells() {
      return swells;
    },
    trigger(t, strength = 1) {
      if (t < next) return false;
      start = t;
      strengthNow = clamp(strength);
      next = t + cooldown;
      swells += 1;
      return true;
    },
    factor(t, thrust, moving = 1) {
      const age = t - start;
      // ~0.15 s rise, hold, then exponential decay: ~1-1.5 s total above the floor.
      let env = 0;
      if (age >= 0) {
        if (age < hold) env = Math.min(1, age / 0.15);
        else env = Math.exp(-(age - hold) / decay);
      }
      const swell = o.floor + (1 - o.floor) * env * strengthNow;
      const ducked = swell * (1 - o.duck * clamp(thrust));
      const m = clamp(moving);
      return 1 + (ducked - 1) * m;
    },
  };
}
