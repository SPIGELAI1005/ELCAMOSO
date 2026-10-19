/**
 * Debris: small stones / grit hitting the shell on a hard launch.
 *
 * Plays randomized real impact grains (pebbles on metal, small rocks; CC BY 4.0, see
 * debris-grains.ts and /credits): random grain, pitch (+-5 semitones), gain and pan. Grains are
 * dry (<=70 ms, no ringing tails). Until the grain pack is decoded (or if it fails to load) each
 * hit is a dry, band-limited noise click instead: no resonant partials.
 *
 * Bursts only fire on a hard launch (acceleration estimate above a high threshold, rising edge);
 * density follows the live acceleration intensity, then thins and fades over ~1-2.5 s, and a
 * randomized cooldown blocks the next one. Nothing plays at rest, so idles are untouched. The bus
 * is high-passed (sits under the thrust bass), dipped around 3.5 kHz and low-passed; every hit is
 * tens of milliseconds, so there is never sustained 2-6 kHz energy.
 */
import { clamp } from "@/lib/sound/dsp/math";
import {
  DEBRIS_GRAINS,
  getDebrisGrainBuffer,
  loadDebrisGrains,
} from "@/lib/sound/dsp/debris-grains";
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
  /** Share of pebble-on-metal grains (rest: stone/rock grains), 0..1. */
  metal?: number;
  /** Playback-rate multiplier for the grains (1 = as recorded). */
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

const MAX_HITS = 42;
const METAL_IDX = DEBRIS_GRAINS.flatMap((g, i) => (g[2] === "m" ? [i] : []));
const STONE_IDX = DEBRIS_GRAINS.flatMap((g, i) => (g[2] === "s" ? [i] : []));

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

export function createDebrisBurst(
  ctx: BaseAudioContext,
  dest: AudioNode,
  o: DebrisOpts,
): DebrisBurst {
  const threshold = o.thresholdMps2 ?? 2.8;
  const full = Math.max(threshold + 0.5, o.fullMps2 ?? 4.2);
  const cooldownMin = o.cooldownS ?? 9;
  const metal = clamp(o.metal ?? 0.5);
  const pitch = o.pitch ?? 1;
  const rnd = mulberry32((Math.random() * 4294967296) ^ 0x5eed);
  void loadDebrisGrains(ctx);

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

  // Short white-noise buffer for the dry fallback clicks (random offsets).
  const clickBuf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.25), ctx.sampleRate);
  const cd = clickBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = rnd() * 2 - 1;

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
    const bus = panner((rnd() * 2 - 1) * 0.8);
    const extra = bus === hp ? [] : [bus];
    const buf = getDebrisGrainBuffer();
    if (buf && DEBRIS_GRAINS.length > 0) {
      const pool =
        (rnd() < metal && METAL_IDX.length > 0) || STONE_IDX.length === 0 ? METAL_IDX : STONE_IDX;
      const grain = DEBRIS_GRAINS[pool[Math.floor(rnd() * pool.length)] ?? 0];
      const start = grain?.[0] ?? 0;
      const dur = grain?.[1] ?? 0.05;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = pitch * Math.pow(2, ((rnd() * 2 - 1) * 5) / 12);
      const g = ctx.createGain();
      g.gain.value = amp;
      src.connect(g).connect(bus);
      src.start(at, start, dur);
      track(src, [src, g, ...extra]);
      return;
    }
    // Dry fallback click: 3-10 ms of low-Q band-limited noise, fast exponential decay.
    const src = ctx.createBufferSource();
    src.buffer = clickBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = (900 + rnd() * 2600) * pitch;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    const len = 0.003 + rnd() * 0.007;
    g.gain.setValueAtTime(amp, at);
    g.gain.setTargetAtTime(0, at, len / 3);
    src.connect(bp).connect(g).connect(bus);
    src.start(at, rnd() * 0.2, len * 1.5);
    track(src, [src, bp, g, ...extra]);
  }

  // Active burst: hits are generated as the burst runs, so density follows the live intensity.
  let burst: {
    t0: number;
    until: number;
    peak: number;
    cursor: number;
    hits: number;
    rateJ: number;
  } | null = null;

  function trigger(t: number, intensity: number): boolean {
    if (t < nextAllowed) return false;
    bursts++;
    nextAllowed = t + cooldownMin * (1 + 0.6 * rnd());
    const t0 = t + 0.02 + rnd() * 0.06;
    burst = {
      t0,
      until: t0 + 1.0,
      peak: clamp(intensity),
      cursor: t0,
      hits: 0,
      rateJ: 0.8 + 0.4 * rnd(),
    };
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
