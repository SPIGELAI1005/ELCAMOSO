/**
 * Procedural "Hey" chants and choir vowels for Viral Mix.
 * Buffers are synthesized once in JS (formant band-passes, no reference samples)
 * and then played like ordinary sprites. Cheap on the Tesla path after init.
 */
import type { SampleSprite } from "./sample-bank-data";

export const VoxHey = "vox_hey";
export const VoxChoir = "vox_choir";
export const VoxChoirOoh = "vox_choir_ooh";

/** Sprite metadata so pickSample can pitch-shift around C4. */
export const PROCEDURAL_VOCAL_BANK: Record<string, SampleSprite> = {
  [VoxHey]: {
    notes: [48, 51, 54, 57, 60, 63, 66, 69],
    slot: 0.45,
    lead: 0.01,
    rms: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
  },
  [VoxChoir]: {
    notes: [48, 51, 54, 57, 60, 63, 66, 69, 72],
    slot: 2.4,
    lead: 0.04,
    rms: [0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18],
  },
  [VoxChoirOoh]: {
    notes: [48, 51, 54, 57, 60, 63, 66, 69, 72],
    slot: 2.4,
    lead: 0.04,
    rms: [0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18],
  },
};

export function isProceduralVocal(inst: string): boolean {
  return inst in PROCEDURAL_VOCAL_BANK;
}

interface Bq {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

function bandpass(freq: number, q: number, sr: number): Bq {
  const w = (2 * Math.PI * freq) / sr;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * Math.cos(w)) / a0,
    a2: (1 - alpha) / a0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  };
}

function tick(f: Bq, x: number): number {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1;
  f.x1 = x;
  f.y2 = f.y1;
  f.y1 = y;
  return y;
}

function saw(phase: number): number {
  return 2 * (phase - Math.floor(phase + 0.5));
}

/** "eh" as in Hey: F1 ~530, F2 ~1840. "aah": 800/1200. "ooh": 400/800. */
const FORMANTS = {
  eh: [
    [530, 8],
    [1840, 10],
    [2480, 12],
  ],
  aah: [
    [730, 7],
    [1090, 9],
    [2440, 12],
  ],
  ooh: [
    [400, 8],
    [800, 10],
    [2300, 12],
  ],
} as const;

const buffers = new Map<string, AudioBuffer>();
const REF_MIDI = 60;

function makeHey(sr: number): { L: Float32Array; R: Float32Array } {
  const dur = 0.42;
  const n = Math.ceil(sr * dur);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const f0 = 440 * Math.pow(2, (REF_MIDI - 69) / 12);
  const f1 = bandpass(FORMANTS.eh[0]![0], FORMANTS.eh[0]![1], sr);
  const f2 = bandpass(FORMANTS.eh[1]![0], FORMANTS.eh[1]![1], sr);
  const f3 = bandpass(FORMANTS.eh[2]![0], FORMANTS.eh[2]![1], sr);
  const hp = bandpass(2500, 0.7, sr);
  let phase = 0;
  let seed = 0x48455921;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // "H" noise burst, then voiced "eh"
    const hEnv = Math.exp(-t / 0.018) * (t < 0.05 ? 1 : 0.15);
    const vStart = 0.018;
    let vEnv = 0;
    if (t >= vStart) {
      const u = t - vStart;
      const att = Math.min(1, u / 0.012);
      const dec = Math.exp(-u / 0.16);
      vEnv = att * dec;
    }
    // slight downward scoop, shouted
    const hz = f0 * (1.04 - 0.08 * Math.min(1, t / 0.3));
    phase += hz / sr;
    const glot = saw(phase) * 0.55 + saw(phase * 2) * 0.12;
    const noise = rnd() * 0.7;
    const breath = tick(hp, noise) * hEnv * 0.9;
    const voiced = (tick(f1, glot) + tick(f2, glot) * 0.8 + tick(f3, glot) * 0.35) * vEnv;
    const s = (breath + voiced) * 0.45;
    L[i] = s;
    R[i] = s * 0.96 + breath * 0.05;
  }
  // peak-normalize softly
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
  const g = 0.85 / peak;
  for (let i = 0; i < n; i++) {
    L[i]! *= g;
    R[i]! *= g;
  }
  return toRaw(L, R);
}

function makeChoir(sr: number, vowel: "aah" | "ooh"): { L: Float32Array; R: Float32Array } {
  const dur = 2.4;
  const n = Math.ceil(sr * dur);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const f0 = 440 * Math.pow(2, (REF_MIDI - 69) / 12);
  const form = FORMANTS[vowel];
  const dets = [-14, -7, 0, 8, 15];
  const voices = dets.map((cents, vi) => ({
    phase: vi * 0.17,
    cents,
    f1: bandpass(form[0]![0], form[0]![1], sr),
    f2: bandpass(form[1]![0], form[1]![1], sr),
    f3: bandpass(form[2]![0], form[2]![1], sr),
    pan: (vi / (dets.length - 1)) * 1.2 - 0.6,
  }));
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.08) * Math.min(1, (dur - t) / 0.2);
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.1 * t);
    let l = 0;
    let r = 0;
    for (const v of voices) {
      const hz = f0 * Math.pow(2, v.cents / 1200) * vib;
      v.phase += hz / sr;
      const glot = saw(v.phase) * 0.7 + saw(v.phase * 2.01) * 0.08;
      const s = (tick(v.f1, glot) + tick(v.f2, glot) * 0.7 + tick(v.f3, glot) * 0.25) * env;
      const pl = 0.5 - v.pan * 0.5;
      const pr = 0.5 + v.pan * 0.5;
      l += s * pl;
      r += s * pr;
    }
    L[i] = l * 0.22;
    R[i] = r * 0.22;
  }
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
  const g = 0.7 / peak;
  for (let i = 0; i < n; i++) {
    L[i]! *= g;
    R[i]! *= g;
  }
  return toRaw(L, R);
}

type RawBuf = { L: Float32Array; R: Float32Array };

function toRaw(L: Float32Array, R: Float32Array): RawBuf {
  return { L, R };
}

function wrap(ctx: BaseAudioContext, raw: RawBuf): AudioBuffer {
  const buf = ctx.createBuffer(2, raw.L.length, ctx.sampleRate);
  buf.getChannelData(0).set(raw.L);
  buf.getChannelData(1).set(raw.R);
  return buf;
}

/** Build (once per sample rate) and wrap into the current audio context. */
export function getViralVocalBuffer(ctx: BaseAudioContext, inst: string): AudioBuffer | null {
  if (!isProceduralVocal(inst)) return null;
  const sr = Math.round(ctx.sampleRate);
  const key = `${inst}:${sr}`;
  let buf = buffers.get(key);
  if (!buf) {
    const raw = inst === VoxHey ? makeHey(sr) : makeChoir(sr, inst === VoxChoirOoh ? "ooh" : "aah");
    buf = wrap(ctx, raw);
    buffers.set(key, buf);
  }
  return buf;
}

/** Reference MIDI used when the buffer was rendered (C4). */
export const VIRAL_VOCAL_REF_MIDI = REF_MIDI;

/** Test hook: drop cached buffers. */
export function resetViralVocalBuffers() {
  buffers.clear();
}
