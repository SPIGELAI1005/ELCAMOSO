import type { MusicClockConfig } from "../types";
import { samplesPerLoop } from "../music-clock";

export type { MusicClockConfig };

/**
 * Viral Mix custom procedural synthesis.
 * Creates F minor musical content matching the reference's arrangement:
 * - Glassy bell lead with syncopated melodic motif
 * - Ethereal sustained pad chord bed
 * - Warm sub-bass following chord roots
 * - Dry staccato bouncing pluck (enters at higher energy)
 * - Sparse percussion (only at peak energy)
 *
 * Note: This is procedural synthesis - it cannot match the timbre quality
 * of produced audio but aims to capture the ARRANGEMENT and MUSICAL STRUCTURE.
 */

const F_MINOR_SCALE = [174.61, 196.00, 207.65, 233.08, 261.63, 277.18, 311.13, 349.23];
const F_MINOR_CHORD_ROOTS = [174.61, 207.65, 233.08, 261.63];

function adsr(
  t: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  noteLength: number,
): number {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * ((t - attack) / decay);
  if (t < noteLength - release) return sustain;
  if (t < noteLength) return sustain * (1 - (t - (noteLength - release)) / release);
  return 0;
}

function bellTone(t: number, freq: number, modRatio: number, modIndex: number): number {
  const mod = Math.sin(2 * Math.PI * freq * modRatio * t) * modIndex * freq;
  return Math.sin(2 * Math.PI * (freq + mod) * t);
}

export function generateViralMixBellBuffer(
  ctx: BaseAudioContext,
  clock: MusicClockConfig,
  seed: number,
): AudioBuffer {
  const length = samplesPerLoop(clock, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const sr = ctx.sampleRate;
  const beatLen = (60 / clock.bpm) * sr;

  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const melody = [
    { beat: 0, note: 5, dur: 0.5 },
    { beat: 0.75, note: 4, dur: 0.25 },
    { beat: 1.25, note: 5, dur: 0.5 },
    { beat: 2, note: 7, dur: 0.75 },
    { beat: 3, note: 5, dur: 0.5 },
    { beat: 3.75, note: 4, dur: 0.25 },
    { beat: 4.5, note: 3, dur: 0.75 },
    { beat: 5.5, note: 5, dur: 0.5 },
    { beat: 6, note: 4, dur: 0.5 },
    { beat: 7, note: 5, dur: 1 },
  ];

  for (let i = 0; i < length; i++) {
    const beatPos = i / beatLen;
    const barBeat = beatPos % (clock.beatsPerBar * clock.barsPerLoop);
    let sample = 0;

    for (const note of melody) {
      const noteStart = note.beat;
      const noteEnd = note.beat + note.dur;
      const relPos = barBeat - noteStart;

      if (relPos >= 0 && relPos < note.dur * 1.5) {
        const freq = F_MINOR_SCALE[note.note % F_MINOR_SCALE.length]! * 2;
        const t = relPos * (60 / clock.bpm);
        const env = adsr(t, 0.005, 0.15, 0.3, 0.2, note.dur * (60 / clock.bpm));
        const bell = bellTone(t, freq, 3.5, 2.5) * 0.6 + bellTone(t, freq, 5.0, 1.2) * 0.3;
        sample += bell * env * 0.12;
      }
    }

    const pan = 0.15 * Math.sin(i / sr * 0.5);
    L[i] = sample * (1 - pan);
    R[i] = sample * (1 + pan);
  }

  return buffer;
}

export function generateViralMixPadBuffer(
  ctx: BaseAudioContext,
  clock: MusicClockConfig,
  seed: number,
): AudioBuffer {
  const length = samplesPerLoop(clock, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const sr = ctx.sampleRate;
  const barLen = (60 / clock.bpm) * clock.beatsPerBar * sr;

  const chordProg = [
    [174.61, 207.65, 261.63],
    [196.00, 233.08, 293.66],
    [207.65, 261.63, 311.13],
    [174.61, 207.65, 261.63],
  ];

  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const bar = Math.floor(i / barLen) % chordProg.length;
    const chord = chordProg[bar]!;
    let sample = 0;

    for (const freq of chord) {
      sample += Math.sin(2 * Math.PI * freq * t) * 0.08;
      sample += Math.sin(2 * Math.PI * freq * 2 * t + 0.3) * 0.04;
      sample += Math.sin(2 * Math.PI * freq * 3 * t + 0.6) * 0.02;
    }

    const breath = 0.85 + 0.15 * Math.sin(2 * Math.PI * t * 0.15);
    sample *= breath;

    const width = 0.4;
    L[i] = sample * (1 - width);
    R[i] = sample * (1 + width);
  }

  return buffer;
}

export function generateViralMixBassBuffer(
  ctx: BaseAudioContext,
  clock: MusicClockConfig,
  seed: number,
): AudioBuffer {
  const length = samplesPerLoop(clock, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const sr = ctx.sampleRate;
  const barLen = (60 / clock.bpm) * clock.beatsPerBar * sr;

  const bassNotes = [43.65, 49.00, 51.91, 43.65];

  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const bar = Math.floor(i / barLen) % bassNotes.length;
    const freq = bassNotes[bar]!;

    let sample =
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.2 +
      Math.sin(2 * Math.PI * freq * 4 * t) * 0.12 +
      Math.sin(2 * Math.PI * freq * 6 * t) * 0.05;

    L[i] = sample;
    R[i] = sample;
  }

  return buffer;
}

export function generateViralMixPluckBuffer(
  ctx: BaseAudioContext,
  clock: MusicClockConfig,
  seed: number,
): AudioBuffer {
  const length = samplesPerLoop(clock, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const sr = ctx.sampleRate;
  const sixteenthLen = (60 / clock.bpm / 4) * sr;

  let s = seed + 777;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const pattern = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0];

  for (let i = 0; i < length; i++) {
    const sixteenth = Math.floor(i / sixteenthLen);
    const patternIdx = sixteenth % pattern.length;
    const posInNote = (i % sixteenthLen) / sixteenthLen;

    let sample = 0;
    if (pattern[patternIdx] && posInNote < 0.3) {
      const noteIdx = (Math.floor(sixteenth / 4) + patternIdx) % F_MINOR_SCALE.length;
      const freq = F_MINOR_SCALE[noteIdx]!;
      const t = posInNote * (60 / clock.bpm / 4);
      const env = Math.exp(-t * 25);
      sample = Math.sin(2 * Math.PI * freq * t) * env * 0.15;
      sample += Math.sin(2 * Math.PI * freq * 2 * t) * env * 0.08;
    }

    const pan = (patternIdx % 2 === 0 ? -0.2 : 0.2);
    L[i] = sample * (1 - pan);
    R[i] = sample * (1 + pan);
  }

  return buffer;
}

export function generateViralMixKickBuffer(
  ctx: BaseAudioContext,
  clock: MusicClockConfig,
  seed: number,
): AudioBuffer {
  const length = samplesPerLoop(clock, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const sr = ctx.sampleRate;
  const beatLen = (60 / clock.bpm) * sr;

  for (let i = 0; i < length; i++) {
    const beat = Math.floor(i / beatLen);
    const posInBeat = (i % beatLen) / beatLen;

    let sample = 0;
    if (beat % 2 === 0 && posInBeat < 0.15) {
      const t = posInBeat * (60 / clock.bpm);
      const pitchEnv = 150 * Math.exp(-t * 40) + 45;
      sample = Math.sin(2 * Math.PI * pitchEnv * t) * Math.exp(-t * 15) * 0.25;
    }

    L[i] = sample;
    R[i] = sample;
  }

  return buffer;
}

export function generateViralMixHihatBuffer(
  ctx: BaseAudioContext,
  clock: MusicClockConfig,
  seed: number,
): AudioBuffer {
  const length = samplesPerLoop(clock, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const sr = ctx.sampleRate;
  const sixteenthLen = (60 / clock.bpm / 4) * sr;

  let s = seed + 999;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let i = 0; i < length; i++) {
    const posInSixteenth = (i % sixteenthLen) / sixteenthLen;

    let sample = 0;
    if (posInSixteenth < 0.08) {
      const t = posInSixteenth * (60 / clock.bpm / 4);
      sample = (rnd() * 2 - 1) * Math.exp(-t * 80) * 0.06;
    }

    L[i] = sample * 0.7;
    R[i] = sample * 1.3;
  }

  return buffer;
}

export function generateViralMixRiserBuffer(
  ctx: BaseAudioContext,
  clock: MusicClockConfig,
  seed: number,
): AudioBuffer {
  const length = samplesPerLoop(clock, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const sr = ctx.sampleRate;
  const loopLen = length / sr;

  let s = seed + 333;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const phase = t / loopLen;

    let sample = 0;
    if (phase > 0.85) {
      const risePhase = (phase - 0.85) / 0.15;
      const freq = 200 + risePhase * 2000;
      sample = (rnd() * 2 - 1) * risePhase * 0.1;
      sample += Math.sin(2 * Math.PI * freq * t) * risePhase * 0.05;
    }

    L[i] = sample;
    R[i] = sample;
  }

  return buffer;
}
