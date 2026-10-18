/**
 * Lift-off "thunder" for gearless propulsion voices (Rocket Car, Time Machine).
 *
 * The cars get their decel thunder from downshift blips + the bass enhancer's lift-off
 * boost. These voices have no gears, so they get the same feeling from:
 * - a propulsion cut-off thump: a deep sine drop (no highs, so no extra whistle) plus a
 *   low-passed noise "whoomp", fired once when you lift after real thrust;
 * - a lift-off amount (0..1) to drive the bass enhancer's liftOffBoost, so the sub
 *   blooms for a moment while the thrust dies away.
 * Speaker-safe: the thump ends at >= 34 Hz and is routed through the profile's bass
 * enhancer (30 Hz high-pass) by the caller; level is bounded by `level`.
 */
import { clamp } from "@/lib/sound/dsp/math";
import { getNoiseBuffer } from "@/lib/sound/dsp/noise";
import { audioRandom } from "@/lib/sound/rng";

export interface LiftOffThunderOpts {
  /** Thump sweep start / end (Hz). End >= 34 Hz. */
  startHz: number;
  endHz: number;
  /** Seconds for the main thump decay. */
  decayS: number;
  /** Peak linear gain of the thump at full strength. */
  level: number;
  /** Low-pass corner of the noise whoomp (Hz). */
  whoompHz: number;
  /** Relative level of the whoomp vs the thump. */
  whoompMix: number;
  /** Smoothed load needed before a lift-off counts (arms the thump). */
  armLoad: number;
  /** Minimum seconds between thumps. */
  cooldownS: number;
}

export const ROCKET_LIFTOFF_THUNDER: LiftOffThunderOpts = {
  startHz: 82,
  endHz: 34,
  decayS: 0.55,
  level: 0.3,
  whoompHz: 220,
  whoompMix: 0.55,
  armLoad: 0.32,
  cooldownS: 4,
};

export const TIME_MACHINE_LIFTOFF_THUNDER: LiftOffThunderOpts = {
  startHz: 105,
  endHz: 38,
  decayS: 0.45,
  level: 0.5,
  whoompHz: 260,
  whoompMix: 0.45,
  armLoad: 0.32,
  cooldownS: 4,
};

export interface LiftOffThunder {
  /**
   * Call every frame with the instantaneous load (0..1) and the speed (m/s). Acceleration
   * is derived from speed here, since the improved-synth motion frame carries no signed accel.
   * Returns the lift-off amount 0..1 for the bass enhancer.
   */
  update(load: number, speedMps: number, t: number): number;
  readonly fired: number;
}

/** Deceleration (m/s²) that counts as "lifting off" after thrust. */
const LIFT_DECEL = 0.35;
/** Deceleration (m/s²) that gives full lift-off bloom. */
const FULL_DECEL = 2.5;

export function createLiftOffThunder(
  ctx: BaseAudioContext,
  out: AudioNode,
  o: LiftOffThunderOpts,
): LiftOffThunder {
  const endHz = Math.max(34, o.endHz);
  let armed = false;
  let peak = 0;
  let next = 0;
  let lastT = -1;
  let lastSpeed = 0;
  let accel = 0;
  let fired = 0;
  const brown = getNoiseBuffer(ctx, "brown");

  function thump(t: number, strength: number) {
    const s = clamp(strength);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(o.startHz, t);
    osc.frequency.exponentialRampToValueAtTime(endHz, t + o.decayS * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.level * s, t + 0.02);
    g.gain.setTargetAtTime(0, t + 0.05, o.decayS / 3);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + o.decayS * 3 + 0.1);

    const src = ctx.createBufferSource();
    src.buffer = brown;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(o.whoompHz, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(60, o.whoompHz * 0.35), t + o.decayS);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0, t);
    wg.gain.linearRampToValueAtTime(o.level * o.whoompMix * s, t + 0.03);
    wg.gain.setTargetAtTime(0, t + 0.08, o.decayS / 2.5);
    src.connect(lp).connect(wg).connect(out);
    src.start(t, audioRandom() * 1.5);
    src.stop(t + o.decayS * 3 + 0.2);
    const cleanup = () => {
      osc.disconnect();
      g.disconnect();
      src.disconnect();
      lp.disconnect();
      wg.disconnect();
    };
    src.onended = cleanup;
  }

  return {
    get fired() {
      return fired;
    },
    update(load, speedMps, t) {
      const dt = lastT < 0 ? 0 : t - lastT;
      if (dt > 0 && dt < 1) {
        const raw = (speedMps - lastSpeed) / dt;
        accel += (raw - accel) * (1 - Math.exp(-dt / 0.6));
      }
      lastT = t;
      lastSpeed = speedMps;
      const accelMps2 = accel;
      // Arm on real thrust; remember how hard it pushed.
      if (load >= o.armLoad && accelMps2 > 0) {
        armed = true;
        peak = Math.max(peak, load);
      }
      // Lift-off: thrust has stopped and the vehicle is actually slowing.
      if (armed && accelMps2 < -LIFT_DECEL && t >= next) {
        thump(t, 0.6 + 0.4 * clamp(peak));
        armed = false;
        peak = 0;
        next = t + o.cooldownS;
        fired += 1;
      }
      return clamp(-accelMps2 / FULL_DECEL);
    },
  };
}
