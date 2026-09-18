import type { MusicClockConfig } from "./types";
import { samplesPerLoop } from "./music-clock";
import type { SymphonyPackStemDef } from "./types";

/** Generate bar-aligned procedural placeholder loops (not commercial music). */
export function generateProceduralStemBuffer(
  ctx: BaseAudioContext,
  clock: MusicClockConfig,
  stem: SymphonyPackStemDef,
  seed: number,
): AudioBuffer {
  const length = samplesPerLoop(clock, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const beats = clock.beatsPerBar * clock.barsPerLoop;
  const samplesPerBeat = length / beats;

  let s = seed + stem.id.length * 997;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    const beat = Math.floor(i / samplesPerBeat);
    const phase = (i % samplesPerBeat) / samplesPerBeat;
    let sample = 0;

    switch (stem.procedural) {
      case "pad":
      case "warm":
        sample =
          0.12 * Math.sin(2 * Math.PI * 110 * t) +
          0.08 * Math.sin(2 * Math.PI * 164.8 * t + 0.3) +
          0.04 * Math.sin(2 * Math.PI * 220 * t);
        sample *= 0.7 + 0.3 * Math.sin(2 * Math.PI * t * 0.25);
        break;
      case "bass":
        sample = 0.28 * Math.sin(2 * Math.PI * 55 * t);
        if (phase < 0.08) sample *= 1.4;
        break;
      case "pulse": {
        const hit = phase < 0.05 || (beat % 2 === 1 && phase < 0.04);
        sample = hit ? (rnd() * 2 - 1) * 0.35 * (1 - phase * 8) : 0;
        sample += 0.05 * Math.sin(2 * Math.PI * 80 * t);
        break;
      }
      case "noise":
        sample = (rnd() * 2 - 1) * 0.08;
        break;
      case "bright":
        sample =
          0.1 * Math.sin(2 * Math.PI * 440 * t) +
          0.06 * Math.sin(2 * Math.PI * 880 * t) +
          0.04 * Math.sin(2 * Math.PI * 1320 * t);
        if (beat % 4 === 0 && phase < 0.1) sample *= 1.5;
        break;
      case "impact":
        sample = phase < 0.02 && beat % 8 === 7 ? (rnd() * 2 - 1) * 0.5 * (1 - phase * 40) : 0;
        break;
      default:
        sample = 0.1 * Math.sin(2 * Math.PI * 196 * t);
    }

    const pan = stem.procedural === "bright" ? 0.25 : stem.procedural === "warm" ? -0.2 : 0;
    L[i] = sample * (1 - pan) * 0.5;
    R[i] = sample * (1 + pan) * 0.5;
  }

  return buffer;
}
