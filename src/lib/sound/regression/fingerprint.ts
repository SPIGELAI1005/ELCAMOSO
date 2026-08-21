import type { DriveState } from "@/lib/drive/model";
import type { SoundProfile } from "@/lib/sound/profiles";
import { audioRandom, seedAudioRandom } from "@/lib/sound/rng";

export interface AudioFingerprint {
  rms: number;
  peak: number;
  dc: number;
  bands: [number, number, number, number];
  frames: number[];
}

export function roundFingerprint(value: AudioFingerprint): AudioFingerprint {
  const q = (n: number, d = 6) => Number(n.toFixed(d));
  return {
    rms: q(value.rms),
    peak: q(value.peak),
    dc: q(value.dc, 7),
    bands: value.bands.map((n) => q(n, 6)) as [number, number, number, number],
    frames: value.frames.map((n) => q(n, 5)),
  };
}

export function fingerprintPcm(samples: Float32Array, sampleRate: number): AudioFingerprint {
  let sum = 0;
  let sq = 0;
  let peak = 0;
  let low = 0;
  let mid = 0;
  let high = 0;
  let air = 0;
  const n = samples.length;
  const frameCount = 32;
  const frameSize = Math.max(1, Math.floor(n / frameCount));
  const frames: number[] = [];

  for (let f = 0; f < frameCount; f += 1) {
    let fsq = 0;
    const start = f * frameSize;
    const end = Math.min(n, start + frameSize);
    for (let i = start; i < end; i += 1) {
      const v = samples[i] ?? 0;
      sum += v;
      sq += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      fsq += v * v;
    }
    frames.push(Math.sqrt(fsq / Math.max(1, end - start)));
  }

  // One-pole energy split as a cheap spectral stand-in (no FFT required).
  let lp = 0;
  let bp = 0;
  const dt = 1 / sampleRate;
  for (let i = 0; i < n; i += 1) {
    const v = samples[i] ?? 0;
    lp += (v - lp) * Math.min(1, 400 * 2 * Math.PI * dt);
    const midish = v - lp;
    bp += (midish - bp) * Math.min(1, 1800 * 2 * Math.PI * dt);
    const rest = midish - bp;
    low += lp * lp;
    mid += bp * bp;
    high += rest * rest;
    air += i % 2 === 0 ? rest * rest : 0;
  }
  const norm = 1 / Math.max(1, n);
  return roundFingerprint({
    rms: Math.sqrt(sq * norm),
    peak,
    dc: sum * norm,
    bands: [low * norm, mid * norm, high * norm, air * norm],
    frames,
  });
}

export interface FingerprintDiff {
  ok: boolean;
  reasons: string[];
}

export function compareFingerprints(
  actual: AudioFingerprint,
  expected: AudioFingerprint,
  tolerance = 0.08,
): FingerprintDiff {
  const reasons: string[] = [];
  const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-6, Math.abs(b), Math.abs(a));
  if (rel(actual.rms, expected.rms) > tolerance) {
    reasons.push(`rms ${actual.rms} vs ${expected.rms}`);
  }
  if (rel(actual.peak, expected.peak) > tolerance) {
    reasons.push(`peak ${actual.peak} vs ${expected.peak}`);
  }
  actual.bands.forEach((band, i) => {
    const other = expected.bands[i] ?? 0;
    if (rel(band, other) > tolerance * 1.4) reasons.push(`band${i} ${band} vs ${other}`);
  });
  if (actual.frames.length !== expected.frames.length) {
    reasons.push("frame count");
  } else {
    let drift = 0;
    actual.frames.forEach((frame, i) => {
      drift += rel(frame, expected.frames[i] ?? 0);
    });
    if (drift / actual.frames.length > tolerance) reasons.push("frame envelope");
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Deterministic core-voice render used by the regression harness. Mirrors the
 * engine's fundamental + harmonic + noise mapping without Web Audio, so CI can
 * compare PCM fingerprints on Node.
 */
export function renderCorePcm(
  profile: SoundProfile,
  state: DriveState,
  opts?: { sampleRate?: number; duration?: number; seed?: number },
): Float32Array {
  const sampleRate = opts?.sampleRate ?? 22050;
  const duration = opts?.duration ?? 0.45;
  seedAudioRandom(opts?.seed ?? 1);
  const length = Math.floor(sampleRate * duration);
  const out = new Float32Array(length);
  const v = profile.voice;
  let fundamental: number;
  if (profile.drivetrainMode === "virtual-transmission") {
    fundamental = (state.rpm / 60) * (v.baseFrequency / 26);
  } else {
    fundamental = v.baseFrequency * (1 + state.load * 2.6 + state.throttle * 0.5);
  }
  fundamental = Math.max(18, Math.min(1600, fundamental));
  const cutoff = v.filterBase + v.filterRange * Math.pow(state.load, 0.8);
  const alpha = Math.min(1, (2 * Math.PI * cutoff) / sampleRate);
  let lp = 0;
  const duck = 1 - state.regen * 0.35;
  const amp = (0.55 + state.load * 0.45) * duck;

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    let sample = 0;
    v.harmonics.forEach((ratio, h) => {
      const gain = (0.3 / (h + 1.4)) * (h === 0 ? 1 : 0.2 + state.load * 0.8);
      const phase = 2 * Math.PI * fundamental * ratio * t;
      const wave =
        v.wave === "sine"
          ? Math.sin(phase)
          : v.wave === "square"
            ? Math.sign(Math.sin(phase) || 1)
            : 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5));
      sample += wave * gain;
    });
    sample += (audioRandom() * 2 - 1) * v.noise * (0.25 + state.load * 0.9) * 0.35;
    lp += (sample - lp) * alpha;
    out[i] = lp * amp * 0.45;
  }
  return out;
}
