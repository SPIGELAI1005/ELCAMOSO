/**
 * Santa V8 Sleigh: Christmas bells now and then on top of the (unchanged) American Muscle V8.
 *
 * Two kinds of bell event, both synthesised here (no recordings, no melodies):
 * - a sleigh-bell shake: a short burst of small jingles in a loose shake rhythm;
 * - a warm hand-bell chime: two or three single notes picked at random from a pentatonic set,
 *   with a soft "hum" partial and slow-beating detuned pairs, never a tune.
 * Everything is rendered once into short mono buffers and filtered dark (no glassy ring).
 * Events come at random every ~15-40 s (a bit more often and livelier with speed, never closer
 * than BELLS_MIN_GAP_S). The bells use their own seeded random stream, so the engine's
 * audioRandom draws (pops, crackle) are exactly those of the V8 on its own.
 */
import type { DriveState } from "@/lib/drive/model";

export const BELLS_FIRST_DELAY_S: readonly [number, number] = [4, 8];
export const BELLS_INTERVAL_S: readonly [number, number] = [15, 40];
/** Hard cap: never two bell events closer than this. */
export const BELLS_MIN_GAP_S = 12;
/** Interval multiplier at/above BELLS_FAST_KMH (shorter gaps when moving fast). */
export const BELLS_FAST_INTERVAL_SCALE = 0.65;
export const BELLS_FAST_KMH = 120;
export const BELLS_LEVEL = 0.5 / 0.6;
export const BELLS_LOWPASS_HZ = 5200;
export const BELLS_CHIME_PROBABILITY = 0.3;
/** Pentatonic note pool (Hz, C major pentatonic A4-E6), sampled at random: no melody. */
export const CHIME_NOTES_HZ = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

export type BellEventKind = "jingle-soft" | "jingle" | "jingle-lively" | "chime";

export interface SleighBellsOverlay {
  update(state: DriveState, t: number): void;
  dispose(): void;
  diagnostics(): { connected: boolean; events: number; nextAt: number; log: string[] };
}

/** Small deterministic PRNG (mulberry32). */
export function bellRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seconds until the next event for the current speed (before the min-gap cap). */
export function bellIntervalFor(kmh: number, u: number): number {
  const [lo, hi] = BELLS_INTERVAL_S;
  const k = Math.min(1, Math.max(0, kmh / BELLS_FAST_KMH));
  const scale = 1 - (1 - BELLS_FAST_INTERVAL_SCALE) * k;
  return Math.max(BELLS_MIN_GAP_S, (lo + (hi - lo) * u) * scale);
}

export function bellKindFor(kmh: number, uKind: number): BellEventKind {
  if (uKind < BELLS_CHIME_PROBABILITY) return "chime";
  if (kmh < 30) return "jingle-soft";
  if (kmh < 80) return "jingle";
  return "jingle-lively";
}

/** Level multiplier: +2 dB by BELLS_FAST_KMH. */
export function bellLevelFor(kmh: number): number {
  const k = Math.min(1, Math.max(0, kmh / BELLS_FAST_KMH));
  return 10 ** ((2 * k) / 20);
}

/** Add one small jingle (inharmonic partials, fast decay, soft click) at sample `at`. */
function addJingle(
  d: Float32Array,
  sr: number,
  at: number,
  f0: number,
  amp: number,
  rnd: () => number,
) {
  const ratios = [1, 1.47, 2.09, 2.56];
  const levels = [1, 0.55, 0.3, 0.16];
  const len = Math.min(d.length - at, Math.floor(sr * 0.22));
  if (len <= 0) return;
  for (let p = 0; p < ratios.length; p++) {
    const f = f0 * ratios[p]! * (1 + (rnd() - 0.5) * 0.01);
    const w = (2 * Math.PI * f) / sr;
    const tau = (0.07 - p * 0.012) * sr;
    const ph = rnd() * 2 * Math.PI;
    const a = amp * levels[p]!;
    for (let i = 0; i < len; i++) {
      const att = i < 48 ? i / 48 : 1;
      d[at + i]! += a * att * Math.exp(-i / tau) * Math.sin(ph + w * i);
    }
  }
  // the little metal pellet: a few ms of soft noise
  const clickLen = Math.min(len, Math.floor(sr * 0.006));
  let lp = 0;
  for (let i = 0; i < clickLen; i++) {
    lp += 0.25 * (rnd() * 2 - 1 - lp);
    d[at + i]! += amp * 0.25 * lp * (1 - i / clickLen);
  }
}

/** One sleigh-bell shake: `pulses` shakes at ~`rate` Hz, each a cluster of jingles. */
export function renderJingle(
  sr: number,
  rnd: () => number,
  opts: { pulses: number; rate: number; perPulse: number; amp: number },
): Float32Array {
  const dur = opts.pulses / opts.rate + 0.35;
  const d = new Float32Array(Math.ceil(sr * dur));
  const pool = [1480, 1660, 1870, 2090, 2350];
  for (let k = 0; k < opts.pulses; k++) {
    const pulseT = k / opts.rate + (rnd() - 0.5) * 0.012;
    // a shake swells and fades
    const env = Math.sin((Math.PI * (k + 0.5)) / opts.pulses) ** 0.7;
    const n = opts.perPulse + (rnd() < 0.5 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const at = Math.max(0, Math.floor(sr * (pulseT + rnd() * 0.018)));
      const f0 = pool[Math.floor(rnd() * pool.length)]! * (1 + (rnd() - 0.5) * 0.04);
      addJingle(d, sr, at, f0, opts.amp * env * (0.6 + 0.4 * rnd()), rnd);
    }
  }
  return d;
}

/** A warm hand-bell note: hum (f/2), fundamental, soft octave and twelfth, detuned pairs. */
function addChimeNote(
  d: Float32Array,
  sr: number,
  at: number,
  f: number,
  amp: number,
  rnd: () => number,
) {
  const parts: Array<[number, number, number]> = [
    // [ratio, level, decay s]
    [0.5, 0.32, 2.2],
    [1, 1, 1.5],
    [2, 0.22, 0.7],
    [3, 0.09, 0.35],
  ];
  const len = Math.min(d.length - at, Math.floor(sr * 2.6));
  for (const [r, lv, dec] of parts) {
    for (const det of [-0.6, 0.6]) {
      const w = (2 * Math.PI * (f * r + det)) / sr;
      const ph = rnd() * 2 * Math.PI;
      const tau = dec * sr;
      const a = amp * lv * 0.5;
      for (let i = 0; i < len; i++) {
        const att = i < 120 ? i / 120 : 1;
        d[at + i]! += a * att * Math.exp(-i / tau) * Math.sin(ph + w * i);
      }
    }
  }
}

export function renderChime(sr: number, rnd: () => number, amp = 0.15): Float32Array {
  const notes = 2 + (rnd() < 0.5 ? 1 : 0);
  const d = new Float32Array(Math.ceil(sr * (notes * 0.6 + 2.6)));
  let t = 0;
  let last = -1;
  for (let k = 0; k < notes; k++) {
    let idx = Math.floor(rnd() * CHIME_NOTES_HZ.length);
    if (idx === last) idx = (idx + 2) % CHIME_NOTES_HZ.length;
    last = idx;
    addChimeNote(d, sr, Math.floor(t * sr), CHIME_NOTES_HZ[idx]!, amp * (k === 0 ? 1 : 0.8), rnd);
    t += 0.38 + rnd() * 0.22;
  }
  return d;
}

function toBuffer(ctx: BaseAudioContext, d: Float32Array): AudioBuffer {
  const b = ctx.createBuffer(1, d.length, ctx.sampleRate);
  b.getChannelData(0).set(d);
  return b;
}

/** Variant buffers per event kind, rendered once per context sample rate. */
const bankCache = new Map<number, Record<BellEventKind, Float32Array[]>>();
function bellBank(sr: number): Record<BellEventKind, Float32Array[]> {
  const hit = bankCache.get(sr);
  if (hit) return hit;
  const rnd = bellRandom(0x5a17a);
  const bank: Record<BellEventKind, Float32Array[]> = {
    "jingle-soft": [0, 1].map(() =>
      renderJingle(sr, rnd, { pulses: 5, rate: 6, perPulse: 2, amp: 0.17 }),
    ),
    jingle: [0, 1].map(() =>
      renderJingle(sr, rnd, { pulses: 7, rate: 7, perPulse: 3, amp: 0.228 }),
    ),
    "jingle-lively": [0, 1].map(() =>
      renderJingle(sr, rnd, { pulses: 10, rate: 8, perPulse: 3, amp: 0.252 }),
    ),
    chime: [0, 1, 2].map(() => renderChime(sr, rnd)),
  };
  bankCache.set(sr, bank);
  return bank;
}

export function createSleighBellsOverlay(
  ctx: BaseAudioContext,
  destination: AudioNode,
  options: { level?: number; seed?: number } = {},
): SleighBellsOverlay {
  const level = options.level ?? BELLS_LEVEL;
  const rnd = bellRandom(options.seed ?? 20261224);
  const bank = bellBank(ctx.sampleRate);
  const buffers = Object.fromEntries(
    Object.entries(bank).map(([k, list]) => [k, list.map((d) => toBuffer(ctx, d))]),
  ) as Record<BellEventKind, AudioBuffer[]>;

  // warm, dark chain: gentle highpass (no rumble build-up), lowpass, slight presence dip
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 220;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = BELLS_LOWPASS_HZ;
  lp.Q.value = 0.5;
  const out = ctx.createGain();
  out.gain.value = level;
  hp.connect(lp);
  lp.connect(out);
  out.connect(destination);

  let disposed = false;
  let connected = true;
  let events = 0;
  const log: string[] = [];
  let nextAt = -1;
  const live = new Set<AudioBufferSourceNode>();

  const play = (kind: BellEventKind, kmh: number, t: number) => {
    const list = buffers[kind];
    const buf = list[Math.floor(rnd() * list.length)]!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (rnd() - 0.5) * 0.04;
    const g = ctx.createGain();
    g.gain.value = bellLevelFor(kmh);
    src.connect(g);
    g.connect(hp);
    src.onended = () => {
      live.delete(src);
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* */
      }
    };
    live.add(src);
    src.start(t);
    events += 1;
    if (log.length < 64) log.push(`${kind}@${t.toFixed(2)}`);
  };

  return {
    update(state, t) {
      if (disposed) return;
      const kmh = Math.max(0, state.speed || 0) * 3.6;
      if (nextAt < 0) {
        const [a, b] = BELLS_FIRST_DELAY_S;
        nextAt = t + a + (b - a) * rnd();
        return;
      }
      if (t < nextAt) return;
      play(bellKindFor(kmh, rnd()), kmh, Math.max(t, ctx.currentTime));
      nextAt = t + bellIntervalFor(kmh, rnd());
    },
    diagnostics: () => ({ connected: connected && !disposed, events, nextAt, log: [...log] }),
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.05);
        for (const s of live) s.stop(t + 0.3);
      } catch {
        /* closed context */
      }
      setTimeout(() => {
        out.disconnect();
        connected = false;
      }, 400);
    },
  };
}
