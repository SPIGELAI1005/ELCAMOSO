/**
 * Debris / micro-impacts: small stones and grit pinging off a glass or metal shell.
 *
 * Fully procedural. Each burst is a sparse, randomized Poisson stream of tiny modal impacts
 * (inharmonic metal/glass partials, a soft tick, an occasional dull knock), each with its own
 * pitch, decay and pan. Bursts only fire on a hard launch (acceleration estimate above a high
 * threshold, rising edge), get denser with intensity, thin out and fade over ~1-2.5 s, then a
 * randomized cooldown blocks the next one. Nothing plays at rest, so idles are untouched.
 *
 * Tone safety: partials are kept below ~5 kHz, the bus is high-passed (no LF, sits under the
 * thrust bass), gently dipped around 3.5 kHz and low-passed, and every impact decays in tens of
 * milliseconds, so there is never sustained 2-6 kHz energy.
 */
import { clamp } from "@/lib/sound/dsp/math";
import type { LayerHandle } from "@/lib/sound/dsp/layers";
import type { MotionFrame } from "@/lib/sound/realism/types";

export interface DebrisOpts {
  /** Output level (linear). */
  level: number;
  /** Acceleration (m/s^2) that starts a burst; must sit above gentle driving (~2 m/s^2). */
  thresholdMps2?: number;
  /** Acceleration giving full intensity. */
  fullMps2?: number;
  /** Cooldown between bursts in seconds (randomized between min and min*1.6). */
  cooldownS?: number;
  /** 0 = all metal, 1 = all glass. */
  glass?: number;
  /** Pitch multiplier for the impacts (1 = 650-2300 Hz fundamentals). */
  pitch?: number;
}

export interface DebrisBurst {
  /** Feed the current acceleration (m/s^2); returns true when a burst was launched. */
  update(accelMps2: number, speedKmh: number, t: number): boolean;
  /** Launch a burst now (intensity 0..1), ignoring threshold but respecting cooldown. */
  trigger(t: number, intensity: number): boolean;
  readonly bursts: number;
  setMuted(muted: boolean, t: number): void;
  dispose(): void;
}

/** Free-bar / plate (metal) and wine-glass-like (glass) inharmonic partial ratios. */
const METAL = [1, 2.76, 5.4, 8.93];
const PLATE = [1, 1.59, 2.14, 2.65, 3.16];
const GLASS = [1, 2.32, 4.25, 6.63];
const MAX_PARTIAL_HZ = 5000;
const MAX_HITS = 42;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDebrisBurst(ctx: BaseAudioContext, dest: AudioNode, o: DebrisOpts): DebrisBurst {
  const threshold = o.thresholdMps2 ?? 2.8;
  const full = Math.max(threshold + 0.5, o.fullMps2 ?? 4.2);
  const cooldownMin = o.cooldownS ?? 9;
  const glass = clamp(o.glass ?? 0.5);
  const pitch = o.pitch ?? 1;
  const rnd = mulberry32((Math.random() * 4294967296) ^ 0x5eed);

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 320;
  hp.Q.value = 0.6;
  const dip = ctx.createBiquadFilter();
  dip.type = "peaking";
  dip.frequency.value = 3500;
  dip.Q.value = 0.8;
  dip.gain.value = -5;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6500;
  lp.Q.value = 0.5;
  const out = ctx.createGain();
  out.gain.value = o.level;
  const mute = ctx.createGain();
  mute.gain.value = 1;
  hp.connect(dip).connect(lp).connect(out).connect(mute).connect(dest);

  // One short white-noise grain for the contact "tick" (shared buffer, random offsets).
  const tickBuf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.25), ctx.sampleRate);
  const td = tickBuf.getChannelData(0);
  for (let i = 0; i < td.length; i++) td[i] = rnd() * 2 - 1;

  let armed = true;
  let nextAllowed = 0;
  let bursts = 0;
  const live = new Set<AudioScheduledSourceNode>();

  const track = (src: AudioScheduledSourceNode, nodes: AudioNode[]) => {
    live.add(src);
    src.onended = () => {
      live.delete(src);
      for (const n of nodes) n.disconnect();
    };
  };

  const panner = (pan: number): AudioNode => {
    if (typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(hp);
      return p;
    }
    return hp;
  };

  function hit(at: number, amp: number) {
    const pan = (rnd() * 2 - 1) * 0.8;
    const bus = panner(pan);
    const isGlass = rnd() < glass;
    const ratios = isGlass ? GLASS : rnd() < 0.5 ? METAL : PLATE;
    // Small stones: mostly bright pings, sometimes a dull knock on the shell.
    const knock = rnd() < 0.22;
    const f0 = (knock ? 260 + rnd() * 320 : 650 * Math.pow(2300 / 650, rnd())) * pitch;
    const tau0 = knock ? 0.012 + rnd() * 0.018 : (isGlass ? 0.03 : 0.02) + rnd() * 0.06;
    ratios.forEach((r, k) => {
      const f = f0 * r * (1 + (rnd() * 2 - 1) * 0.03);
      if (f > MAX_PARTIAL_HZ) return;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      const a = (amp * (0.35 + 0.65 * rnd())) / Math.pow(k + 1, 1.3);
      const tau = tau0 / Math.pow(k + 1, 0.7);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(a, at + 0.0015);
      g.gain.setTargetAtTime(0, at + 0.0015, tau);
      osc.connect(g).connect(bus);
      osc.start(at);
      osc.stop(at + 0.0015 + tau * 7);
      track(osc, bus === hp ? [osc, g] : [osc, g, bus]);
    });
    // contact tick: 2-4 ms band-limited noise grain
    const src = ctx.createBufferSource();
    src.buffer = tickBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(4200, f0 * (1.2 + rnd()));
    bp.Q.value = 1.2;
    const tg = ctx.createGain();
    const dur = 0.002 + rnd() * 0.002;
    tg.gain.setValueAtTime(amp * 0.5, at);
    tg.gain.setTargetAtTime(0, at, dur / 3);
    src.connect(bp).connect(tg).connect(bus);
    src.start(at, rnd() * 0.2, dur * 3);
    track(src, [src, bp, tg]);
  }

  // Active burst: hits are generated as the burst runs, so density follows the live intensity.
  let burst: { t0: number; until: number; peak: number; cursor: number; hits: number; rateJ: number } | null = null;

  function trigger(t: number, intensity: number): boolean {
    if (t < nextAllowed) return false;
    bursts++;
    nextAllowed = t + cooldownMin * (1 + 0.6 * rnd());
    const t0 = t + 0.02 + rnd() * 0.06;
    burst = { t0, until: t0 + 1.0, peak: clamp(intensity), cursor: t0, hits: 0, rateJ: 0.8 + 0.4 * rnd() };
    extend(clamp(intensity));
    return true;
  }

  function extend(I: number) {
    if (!burst) return;
    burst.peak = Math.max(burst.peak, I);
    // ~1 s for a modest hard launch, up to ~2.5 s for a very hard one.
    burst.until = Math.max(burst.until, burst.t0 + 1.0 + 1.5 * burst.peak);
  }

  /** Generate hits up to `horizon` (Poisson, rate follows intensity and decays over the burst). */
  function pump(now: number, horizon: number, liveI: number) {
    if (!burst) return;
    const b = burst;
    const dur = b.until - b.t0;
    const end = Math.min(horizon, b.until);
    while (b.cursor < end && b.hits < MAX_HITS) {
      const age = b.cursor - b.t0;
      const I = Math.max(liveI, b.peak * 0.6);
      const rate = Math.max(0.5, (4 + 18 * I) * b.rateJ * Math.exp(-age / (dur * 0.42)));
      b.cursor += -Math.log(1 - rnd() * 0.999) / rate;
      if (b.cursor >= b.until) break;
      const tau = b.cursor - b.t0;
      const env = Math.exp(-tau / (dur * 0.45)) * (0.45 + 0.55 * I);
      hit(Math.max(b.cursor, now + 0.005), env * Math.pow(10, (-14 * rnd()) / 20));
      b.hits++;
    }
    if (b.cursor >= b.until || b.hits >= MAX_HITS) burst = null;
  }

  return {
    update(accel, speedKmh, t) {
      const I = clamp((accel - threshold) / (full - threshold));
      let fired = false;
      if (accel < threshold - 0.6) armed = true;
      if (armed && accel >= threshold && speedKmh <= 220) {
        armed = false;
        fired = trigger(t, 0.25 + 0.75 * I);
      } else if (burst) {
        extend(0.25 + 0.75 * I);
      }
      pump(t, t + 0.12, accel >= threshold - 0.3 ? 0.25 + 0.75 * I : 0);
      return fired;
    },
    trigger,
    get bursts() {
      return bursts;
    },
    setMuted(muted, t) {
      mute.gain.setTargetAtTime(muted ? 0 : 1, t, 0.05);
    },
    dispose() {
      for (const s of live) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      live.clear();
      hp.disconnect();
      dip.disconnect();
      lp.disconnect();
      out.disconnect();
      mute.disconnect();
    },
  };
}

/** LayerHandle wrapper for the improved-synth voices (Rocket Car, UFO, Time Machine). */
export function createDebrisLayer(
  ctx: BaseAudioContext,
  o: DebrisOpts & { id: string; destination: AudioNode },
): LayerHandle {
  const input = ctx.createGain();
  const output = ctx.createGain();
  output.connect(o.destination);
  const burst = createDebrisBurst(ctx, output, o);
  let muted = false;
  let soloed: boolean | null = null;
  let identity = 1;
  const applyGate = () => {
    output.gain.value = muted || soloed === false ? 0 : identity;
  };
  return {
    id: o.id,
    input,
    output,
    update(m: MotionFrame, t: number) {
      burst.update(m.accelMps2, m.speedKmh, t);
    },
    dispose() {
      burst.dispose();
      output.disconnect();
    },
    setMuted(v) {
      muted = v;
      applyGate();
    },
    setSoloed(v) {
      soloed = v;
      applyGate();
    },
    setIdentityGain(gain) {
      identity = gain;
      applyGate();
    },
  };
}
