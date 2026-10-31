/**
 * Police siren overlay (self-made Web Audio): a two-oscillator wail that
 * switches to a fast yelp when you accelerate hard or drive fast.
 * Sits on top of the base engine, bright enough to cut through it but
 * level-limited so the engine stays in front.
 */
import type { DriveState } from "@/lib/drive/model";

export const SIREN_LOW_HZ = 680;
export const SIREN_HIGH_HZ = 1480;
export const SIREN_WAIL_PERIOD = 4.2;
export const SIREN_YELP_PERIOD = 0.32;

export interface SirenOverlay {
  update(state: DriveState, t: number): void;
  dispose(): void;
  /** current mode, for tests/diagnostics */
  mode(): "wail" | "yelp";
  diagnostics(): { gain: number; connected: boolean };
}

/** Yelp when pushing hard or above 90 km/h, otherwise wail. */
export function sirenModeFor(state: Pick<DriveState, "speed" | "throttle" | "acceleration">): "wail" | "yelp" {
  const kmh = state.speed * 3.6;
  return kmh > 90 || (state.throttle > 0.7 && state.acceleration > 2.2) ? "yelp" : "wail";
}

/** Idle siren level; rises ~+2.6 dB by 130 km/h. Tuned to sit ~4–6 dB under the V8. */
export const SIREN_LEVEL = 0.24;

export function sirenTargetGain(kmh: number, level = SIREN_LEVEL): number {
  const k = Math.min(130, Math.max(0, kmh));
  return level * (1 + 0.35 * (k / 130));
}

export function createSirenOverlay(ctx: BaseAudioContext, destination: AudioNode, level = SIREN_LEVEL): SirenOverlay {
  const out = ctx.createGain();
  // Audible from the first sample - never wait for a drive update to lift it.
  out.gain.value = sirenTargetGain(0, level);
  let connected = false;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 450;
  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 1600;
  presence.Q.value = 0.8;
  presence.gain.value = 5;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 5200;
  hp.connect(presence);
  presence.connect(lp);
  lp.connect(out);
  out.connect(destination);
  connected = true;

  // pitch sweep = centre + depth * lfo
  const centre = (SIREN_LOW_HZ + SIREN_HIGH_HZ) / 2;
  const depth = (SIREN_HIGH_HZ - SIREN_LOW_HZ) / 2;
  const lfo = ctx.createOscillator();
  lfo.type = "triangle";
  lfo.frequency.value = 1 / SIREN_WAIL_PERIOD;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = depth;
  lfo.connect(lfoAmt);

  const voices = [
    { type: "sawtooth" as OscillatorType, ratio: 1, g: 0.55 },
    { type: "square" as OscillatorType, ratio: 1.004, g: 0.3 },
  ].map(({ type, ratio, g }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = centre * ratio;
    const amt = ctx.createGain();
    amt.gain.value = ratio;
    lfoAmt.connect(amt);
    amt.connect(osc.frequency);
    const vg = ctx.createGain();
    vg.gain.value = g;
    osc.connect(vg);
    vg.connect(hp);
    return osc;
  });
  const t0 = ctx.currentTime;
  lfo.start(t0);
  voices.forEach((o) => o.start(t0));

  let current: "wail" | "yelp" = "wail";
  let disposed = false;
  return {
    update(state, t) {
      if (disposed) return;
      const mode = sirenModeFor(state);
      if (mode !== current) {
        current = mode;
        lfo.frequency.setTargetAtTime(1 / (mode === "yelp" ? SIREN_YELP_PERIOD : SIREN_WAIL_PERIOD), t, 0.05);
        lfo.type = mode === "yelp" ? "sawtooth" : "triangle";
      }
      // a touch louder with speed so wind/road noise doesn't bury it
      const target = sirenTargetGain(state.speed * 3.6, level);
      out.gain.setTargetAtTime(target, t, 0.3);
    },
    mode: () => current,
    diagnostics: () => ({ gain: disposed ? 0 : out.gain.value, connected: connected && !disposed }),
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.05);
        lfo.stop(t + 0.3);
        voices.forEach((o) => o.stop(t + 0.3));
      } catch {
        /* closed context */
      }
      setTimeout(() => out.disconnect(), 400);
      connected = false;
    },
  };
}
