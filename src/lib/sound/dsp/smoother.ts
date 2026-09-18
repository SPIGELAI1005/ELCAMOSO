/**
 * Dual-timescale motion smoothers.
 * FAST: throttle transients, jerk, shifts.
 * SLOW: speed, ambient load, wind, body resonance.
 */

export interface DualSmootherState {
  fast: number;
  slow: number;
}

export function createDualSmoother(initial = 0): DualSmootherState {
  return { fast: initial, slow: initial };
}

/**
 * One-pole toward target. `tau` is approximate time constant in seconds.
 * Smaller tau = snappier.
 */
export function smoothToward(current: number, target: number, dt: number, tau: number) {
  const a = 1 - Math.exp(-Math.max(0.0001, dt) / Math.max(0.001, tau));
  return current + (target - current) * a;
}

export function updateDual(
  state: DualSmootherState,
  target: number,
  dt: number,
  fastTau: number,
  slowTau: number,
) {
  state.fast = smoothToward(state.fast, target, dt, fastTau);
  state.slow = smoothToward(state.slow, target, dt, slowTau);
  return state;
}

/** Schedule AudioParam without zipper noise. */
export function targetParam(param: AudioParam, value: number, time: number, tau = 0.05) {
  const safe = Math.max(0.0001, value);
  param.setTargetAtTime(safe, time, Math.max(0.005, tau));
}

/** Fade layer gain to near-silence when inactive - avoids stacked idle hiss. */
export function targetLayerGain(param: AudioParam, value: number, time: number, tau = 0.05) {
  const silent = 0.00001;
  const floor = 0.0001;
  if (value <= silent) {
    param.setTargetAtTime(silent, time, Math.max(0.005, tau));
    return;
  }
  param.setTargetAtTime(Math.max(floor, value), time, Math.max(0.005, tau));
}

export function rampParam(param: AudioParam, value: number, time: number, seconds = 0.08) {
  const safe = Math.max(0.0001, value);
  param.cancelScheduledValues(time);
  param.setValueAtTime(Math.max(0.0001, param.value), time);
  param.linearRampToValueAtTime(safe, time + Math.max(0.01, seconds));
}
