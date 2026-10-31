/**
 * Genre definitions for adaptive music. Each genre is a small set of pattern functions
 * that read the conductor's musical intent (intensity, mode, variation) per 16th step.
 * Add a genre by adding an entry to GENRES; samples live in sample-bank-data.ts.
 */
import type { MusicAccent, MusicMode } from "./conductor";

export type GenreId = "classic" | "house" | "rock" | "pop" | "metal" | "hiphop" | "country" | "waltz" | "electro" | "anthem" | "darkrave" | "latino" | "gothic";

export interface NoteSpec {
  inst: string;
  midi: number;
  /** 0..1 */
  vel: number;
  /** seconds */
  dur: number;
  /** -1..1 */
  pan?: number;
  /** offset inside the step, in steps (e.g. 0.5 = a 32nd later) */
  offset?: number;
}

export interface StepContext {
  step: number; // 0..stepsPerBar-1 within bar
  bar: number; // absolute bar index
  chord: readonly number[]; // midi chord tones (root first), already transposed
  root: number;
  intensity: number;
  mode: MusicMode;
  variation: number; // rotates every 8 bars while cruising
  stepDur: number;
  barDur: number;
  rand: () => number;
}

export interface AccentKit {
  crash: [string, number];
  /** rising fill for upshift / surge riser */
  fill: [string, number[]];
  /** low accent for downshift */
  low: [string, number[]];
}

export interface GenreDef {
  id: GenreId;
  name: string;
  bpmMin: number;
  bpmMax: number;
  /** chord progression as semitone offsets from key root + intervals */
  key: number;
  progression: readonly { deg: number; tones: readonly number[] }[];
  /** per-instrument mix gain */
  mix: Record<string, number>;
  accents: AccentKit;
  /** 16ths per bar: 16 = 4/4 (default), 12 = 3/4. */
  stepsPerBar?: number;
  /** Fixed tempo: speed/acceleration add layers instead of speeding the song up. */
  fixedBpm?: number;
  /** Extra energy layers stacked on top of the base pattern as intensity rises. */
  layers?(c: StepContext): NoteSpec[];
  /** concert-hall reverb send, 0..1 (default 0.12) */
  reverb?: number;
  pattern(c: StepContext): NoteSpec[];
}

const on = (c: StepContext, ...steps: number[]) => steps.includes(c.step);
const into = (midi: number, lo: number, hi: number) => {
  let m = midi;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
};
const calm = (m: MusicMode) => m === "brake" || m === "stopped";

/** Deterministic little melody per 2-bar phrase so it repeats musically. */
function motif(c: StepContext, lo: number, hi: number, density: number): number | null {
  const phrase = Math.floor(c.bar / 2) % 4;
  let h = (phrase * 2654435761 + c.variation * 40503 + (c.bar % 2) * 977 + c.step * 131) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  const r = ((h >>> 0) % 1000) / 1000;
  if (r > density) return null;
  const tones = [...c.chord, c.chord[0]! + 12, c.chord[1]! + 12];
  const idx = Math.floor(((h >>> 10) % 1000) / 1000 * tones.length);
  return into(tones[idx]!, lo, hi);
}

const classic: GenreDef = {
  id: "classic",
  name: "Cinematic Orchestra",
  bpmMin: 78,
  bpmMax: 132,
  key: 48, // C
  progression: [
    { deg: 0, tones: [0, 4, 7] },
    { deg: 7, tones: [0, 4, 7] },
    { deg: 9, tones: [0, 3, 7] },
    { deg: 5, tones: [0, 4, 7] },
  ],
  mix: {
    strings: 0.5,
    piano: 0.62,
    cello: 0.55,
    violin: 0.42,
    horn: 0.42,
    pizz: 0.4,
    timpani: 0.7,
    drums_orch: 0.55,
  },
  accents: { crash: ["drums_orch", 49], fill: ["drums_orch", [38]], low: ["timpani", [45, 42, 39, 36]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    // strings pad on the bar
    if (c.step === 0) {
      for (const t of c.chord) out.push({ inst: "strings", midi: into(t, 52, 72), vel: 0.35 + 0.35 * I, dur: c.barDur * 1.02, pan: -0.25 });
    }
    // piano: arpeggio, 8ths (quarters when calm), pattern rotates with variation
    const pianoEvery = quiet ? 4 : I > 0.55 ? 1 : 2;
    if (c.step % pianoEvery === 0) {
      const tones = [...c.chord, c.chord[0]! + 12, c.chord[1]! + 12];
      const order = [
        [0, 1, 2, 3, 4, 3, 2, 1],
        [0, 2, 1, 3, 2, 4, 3, 1],
        [0, 2, 4, 2, 3, 1, 2, 4],
      ][c.variation % 3]!;
      const n = order[(c.step / pianoEvery) % order.length]!;
      out.push({ inst: "piano", midi: into(tones[n % tones.length]!, 60, 84), vel: 0.4 + 0.3 * I, dur: c.stepDur * pianoEvery * 1.8, pan: 0.2 });
    }
    // cello: root on 1 and 3
    if (I > 0.18 && on(c, 0, 8)) out.push({ inst: "cello", midi: into(c.root, 36, 50), vel: 0.45 + 0.3 * I, dur: c.barDur / 2, pan: -0.1 });
    // pizzicato offbeats when moving
    if (!quiet && I > 0.35 && c.step % 4 === 2) out.push({ inst: "pizz", midi: into(c.chord[(c.step / 4) % 3 | 0]!, 55, 72), vel: 0.4 + 0.3 * I, dur: 0.4, pan: 0.35 });
    // violin melody
    if (!quiet && I > 0.45 && c.step % 2 === 0) {
      const m = motif(c, 67, 88, 0.35 + 0.4 * I);
      if (m) out.push({ inst: "violin", midi: m, vel: 0.4 + 0.4 * I, dur: c.stepDur * 3, pan: 0.3 });
    }
    // horns on surges / high intensity
    if (!quiet && I > 0.62 && on(c, 0)) {
      for (const t of c.chord) out.push({ inst: "horn", midi: into(t, 53, 70), vel: 0.4 + 0.4 * I, dur: c.barDur * 0.9, pan: 0.1 });
    }
    // percussion
    if (!quiet && I > 0.4 && on(c, 0)) out.push({ inst: "timpani", midi: into(c.root, 36, 48), vel: 0.4 + 0.4 * I, dur: 0.9 });
    if (!quiet && I > 0.32 && on(c, 0, 8)) out.push({ inst: "drums_orch", midi: 36, vel: 0.45 + 0.35 * I, dur: 0.6 });
    if (!quiet && I > 0.55 && on(c, 4, 12)) out.push({ inst: "drums_orch", midi: 38, vel: 0.35 + 0.35 * I, dur: 0.5 });
    if (!quiet && I > 0.72 && c.step % 2 === 0) out.push({ inst: "drums_orch", midi: 42, vel: 0.25 + 0.2 * I, dur: 0.3, pan: 0.3 });
    return out;
  },
};

const house: GenreDef = {
  id: "house",
  name: "House / Techno",
  bpmMin: 108,
  bpmMax: 134,
  key: 45, // A minor
  progression: [
    { deg: 0, tones: [0, 3, 7, 10] },
    { deg: 8, tones: [0, 4, 7, 11] },
    { deg: 3, tones: [0, 4, 7, 11] },
    { deg: 10, tones: [0, 4, 7, 9] },
  ],
  mix: { drums_elec: 0.72, synthbass: 0.5, pad: 0.32, polysynth: 0.36, lead: 0.24 },
  reverb: 0.1,
  accents: { crash: ["drums_elec", 49], fill: ["drums_elec", [39]], low: ["drums_elec", [36, 36]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    if (c.step === 0) for (const t of c.chord) out.push({ inst: "pad", midi: into(t, 57, 76), vel: 0.35 + 0.25 * (1 - I * 0.5), dur: c.barDur * 1.02, pan: (t % 2) * 0.4 - 0.2 });
    if (!quiet && I > 0.18 && c.step % 4 === 0) out.push({ inst: "drums_elec", midi: 36, vel: 0.65 + 0.3 * I, dur: 0.5 });
    if (quiet && on(c, 0)) out.push({ inst: "drums_elec", midi: 36, vel: 0.3, dur: 0.5 });
    if (!quiet && I > 0.34 && on(c, 4, 12)) out.push({ inst: "drums_elec", midi: 39, vel: 0.5 + 0.3 * I, dur: 0.4 });
    if (!quiet && I > 0.28 && c.step % 4 === 2) out.push({ inst: "drums_elec", midi: I > 0.55 ? 46 : 42, vel: 0.35 + 0.3 * I, dur: 0.3, pan: 0.25 });
    if (!quiet && I > 0.68 && c.step % 2 === 1) out.push({ inst: "drums_elec", midi: 42, vel: 0.22 + 0.2 * I, dur: 0.15, pan: -0.2 });
    if (c.mode === "cruise" && c.variation % 2 === 1 && on(c, 14)) out.push({ inst: "drums_elec", midi: 51, vel: 0.4, dur: 0.4, pan: 0.3 });
    // bass: offbeat 8ths, rolling 16ths at high intensity
    const bassHit = I > 0.62 ? c.step % 2 === 1 || c.step % 4 === 2 : c.step % 4 === 2;
    if (!quiet && I > 0.22 && bassHit) out.push({ inst: "synthbass", midi: into(c.root, 33, 45) + (c.step === 14 && c.variation % 2 ? 12 : 0), vel: 0.5 + 0.35 * I, dur: c.stepDur * 1.6 });
    // chord stabs
    const stabSteps = [[3, 6, 10], [2, 7, 11, 14], [0, 3, 10]][c.variation % 3]!;
    if (!quiet && I > 0.42 && stabSteps.includes(c.step)) for (const t of c.chord.slice(0, 3)) out.push({ inst: "polysynth", midi: into(t, 60, 76), vel: 0.4 + 0.3 * I, dur: c.stepDur * 1.5, pan: 0.15 });
    // arp lead
    if (!quiet && I > 0.66) {
      const tones = [...c.chord, c.chord[0]! + 12];
      out.push({ inst: "lead", midi: into(tones[c.step % tones.length]!, 64, 84), vel: 0.3 + 0.35 * I, dur: c.stepDur * 0.9, pan: c.step % 2 ? 0.4 : -0.4 });
    }
    return out;
  },
};

const rock: GenreDef = {
  id: "rock",
  name: "Rock",
  bpmMin: 84,
  bpmMax: 146,
  key: 40, // E
  progression: [
    { deg: 0, tones: [0, 7, 12] },
    { deg: 10, tones: [0, 7, 12] },
    { deg: 5, tones: [0, 7, 12] },
    { deg: 7, tones: [0, 7, 12] },
  ],
  mix: { drums_rock: 0.75, ebass: 0.55, guitar: 0.42, piano: 0.5, lead: 0.22, strings: 0.3 },
  accents: { crash: ["drums_rock", 49], fill: ["drums_rock", [50, 48, 45]], low: ["drums_rock", [45, 45, 36]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    if (quiet || I < 0.38) {
      // verse feel: piano + sustained strings
      if (c.step % 4 === 0) for (const t of [c.root, c.root + 4 - (c.bar % 4 === 0 ? 0 : 1), c.root + 7]) out.push({ inst: "piano", midi: into(t, 52, 72), vel: 0.4 + 0.2 * I, dur: c.stepDur * 4, pan: 0.15 });
      if (c.step === 0) out.push({ inst: "strings", midi: into(c.root, 52, 64), vel: 0.35, dur: c.barDur, pan: -0.2 });
    }
    if (!quiet && I > 0.2) {
      if (on(c, 0, 8) || (I > 0.5 && on(c, 10))) out.push({ inst: "drums_rock", midi: 36, vel: 0.6 + 0.3 * I, dur: 0.5 });
      if (on(c, 4, 12)) out.push({ inst: "drums_rock", midi: 38, vel: 0.55 + 0.35 * I, dur: 0.5 });
      if (c.step % 2 === 0) {
        const ride = c.mode === "cruise" && c.variation % 2 === 1;
        out.push({ inst: "drums_rock", midi: ride ? 51 : I > 0.7 && c.step % 4 === 2 ? 46 : 42, vel: 0.3 + 0.3 * I, dur: 0.3, pan: 0.25 });
      }
      if (c.step % 2 === 0) out.push({ inst: "ebass", midi: into(c.root, 28, 43), vel: 0.5 + 0.3 * I, dur: c.stepDur * 1.8 });
    }
    if (!quiet && I > 0.38) {
      // power chords: chug 8ths when high, ringing on 1 & 3 otherwise
      const chug = I > 0.6;
      if (chug ? c.step % 2 === 0 : on(c, 0, 8)) out.push({ inst: "guitar", midi: into(c.root, 40, 52), vel: 0.5 + 0.35 * I, dur: chug ? c.stepDur * 1.6 : c.barDur / 2, pan: -0.3 });
    }
    if (!quiet && I > 0.68 && c.step % 2 === 0) {
      const m = motif(c, 64, 84, 0.4 + 0.3 * I);
      if (m) out.push({ inst: "lead", midi: m, vel: 0.35 + 0.3 * I, dur: c.stepDur * 2.5, pan: 0.35 });
    }
    return out;
  },
};

const pop: GenreDef = {
  id: "pop",
  name: "Pop",
  bpmMin: 88,
  bpmMax: 128,
  key: 43, // G
  progression: [
    { deg: 0, tones: [0, 4, 7] },
    { deg: 7, tones: [0, 4, 7] },
    { deg: 9, tones: [0, 3, 7] },
    { deg: 5, tones: [0, 4, 7] },
  ],
  mix: { drums_std: 0.8, synthbass: 0.42, piano: 0.55, pad: 0.3, square: 0.2, agtr: 0.4, strings: 0.28 },
  accents: { crash: ["drums_std", 49], fill: ["drums_std", [38, 38, 39]], low: ["drums_std", [36, 36]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    if (c.step === 0) for (const t of c.chord) out.push({ inst: "pad", midi: into(t, 55, 74), vel: 0.3 + 0.2 * I, dur: c.barDur * 1.02, pan: -0.2 });
    // piano: quarter chords, syncopated push when moving
    const pianoSteps = quiet ? [0, 8] : I > 0.5 ? [0, 3, 6, 8, 11, 14] : [0, 4, 8, 12];
    if (pianoSteps.includes(c.step)) for (const t of c.chord) out.push({ inst: "piano", midi: into(t, 55, 74), vel: 0.35 + 0.3 * I, dur: c.stepDur * 3, pan: 0.15 });
    // acoustic strum on 8ths
    if (!quiet && I > 0.3 && c.step % 2 === 0) out.push({ inst: "agtr", midi: into(c.chord[(c.step / 2) % c.chord.length]!, 52, 71), vel: 0.35 + 0.25 * I, dur: c.stepDur * 2, pan: -0.35 });
    if (!quiet && I > 0.2) {
      if (on(c, 0, 8) || (I > 0.55 && on(c, 6))) out.push({ inst: "drums_std", midi: 36, vel: 0.6 + 0.3 * I, dur: 0.5 });
      if (on(c, 4, 12)) out.push({ inst: "drums_std", midi: I > 0.6 ? 38 : 39, vel: 0.5 + 0.35 * I, dur: 0.4 });
      if (c.step % 2 === 0) out.push({ inst: "drums_std", midi: c.mode === "cruise" && c.variation % 2 ? 51 : 42, vel: 0.25 + 0.25 * I, dur: 0.2, pan: 0.25 });
      if (on(c, 0, 6, 8, 14)) out.push({ inst: "synthbass", midi: into(c.root, 31, 45), vel: 0.5 + 0.3 * I, dur: c.stepDur * 2 });
    }
    if (!quiet && I > 0.5 && on(c, 0)) out.push({ inst: "strings", midi: into(c.chord[2]!, 64, 79), vel: 0.35 + 0.3 * I, dur: c.barDur, pan: 0.3 });
    // hook melody
    if (!quiet && I > 0.6 && c.step % 2 === 0) {
      const m = motif(c, 67, 86, 0.45 + 0.3 * I);
      if (m) out.push({ inst: "square", midi: m, vel: 0.3 + 0.3 * I, dur: c.stepDur * 2, pan: 0.3 });
    }
    return out;
  },
};

const metal: GenreDef = {
  id: "metal",
  name: "Metal",
  bpmMin: 92,
  bpmMax: 168,
  key: 38, // D minor (drop-tuned feel)
  progression: [
    { deg: 0, tones: [0, 7, 12] },
    { deg: 8, tones: [0, 7, 12] },
    { deg: 6, tones: [0, 7, 12] },
    { deg: 5, tones: [0, 7, 12] },
  ],
  mix: { drums_rock: 0.8, pbass: 0.5, dguitar: 0.4, choir: 0.28, lead: 0.2, strings: 0.3 },
  accents: { crash: ["drums_rock", 57], fill: ["drums_rock", [50, 48, 45, 38]], low: ["dguitar", [26, 26, 26]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    if (quiet || I < 0.3) {
      // dark intro: sustained low strings + choir, single ringing chord
      if (c.step === 0) out.push({ inst: "strings", midi: into(c.root, 38, 50), vel: 0.4, dur: c.barDur, pan: -0.2 });
      if (c.step === 0 && c.bar % 2 === 0) out.push({ inst: "dguitar", midi: into(c.root, 28, 40), vel: 0.35 + 0.2 * I, dur: c.barDur * 1.6, pan: 0.2 });
      return out;
    }
    const gallop = c.mode === "cruise" && c.variation % 2 === 1;
    const kick = I > 0.7 ? true : gallop ? [0, 3, 4, 7, 8, 11, 12, 15].includes(c.step) : c.step % 2 === 0;
    if (kick) out.push({ inst: "drums_rock", midi: 36, vel: 0.55 + 0.3 * I, dur: 0.3 });
    if (on(c, 4, 12)) out.push({ inst: "drums_rock", midi: 38, vel: 0.6 + 0.35 * I, dur: 0.4 });
    if (c.step % 4 === 0) out.push({ inst: "drums_rock", midi: I > 0.6 ? 49 : 46, vel: 0.25 + 0.25 * I, dur: 0.5, pan: 0.3 });
    // chugs: 16ths at high intensity, 8ths otherwise, palm-muted (short)
    const chug = I > 0.6 ? true : c.step % 2 === 0;
    if (chug) out.push({ inst: "dguitar", midi: into(c.root, 26, 40), vel: 0.5 + 0.35 * I, dur: c.stepDur * 0.8, pan: -0.35 });
    if (chug) out.push({ inst: "dguitar", midi: into(c.root, 26, 40), vel: 0.45 + 0.3 * I, dur: c.stepDur * 0.8, pan: 0.35, offset: 0.05 });
    if (c.step % 2 === 0) out.push({ inst: "pbass", midi: into(c.root, 26, 40), vel: 0.55 + 0.3 * I, dur: c.stepDur * 1.5 });
    if (I > 0.55 && c.step === 0) for (const t of [c.root, c.root + 3, c.root + 7]) out.push({ inst: "choir", midi: into(t, 57, 74), vel: 0.35 + 0.3 * I, dur: c.barDur });
    if (I > 0.72 && c.step % 2 === 0) {
      const m = motif(c, 62, 86, 0.5 + 0.3 * I);
      if (m) out.push({ inst: "lead", midi: m, vel: 0.35 + 0.3 * I, dur: c.stepDur * 2, pan: 0.25 });
    }
    return out;
  },
};

// Original 2-bar piano hook: [step, semitone over chord root, len16]
const HIPHOP_MELODY: readonly (readonly [number, number, number])[][] = [
  [[0, 15, 3], [3, 14, 1], [4, 10, 4], [10, 7, 2], [12, 10, 4]],
  [[0, 12, 3], [3, 10, 1], [4, 7, 3], [8, 3, 2], [11, 5, 1], [12, 7, 4]],
];
const hiphop: GenreDef = {
  id: "hiphop",
  name: "Hip-hop",
  bpmMin: 74,
  bpmMax: 104,
  key: 41, // F minor
  progression: [
    { deg: 0, tones: [0, 3, 7, 10] },
    { deg: 0, tones: [0, 3, 7, 10] },
    { deg: 8, tones: [0, 4, 7, 11] },
    { deg: 7, tones: [0, 3, 7, 10] },
  ],
  mix: { drums_elec: 0.85, synthbass: 0.6, piano: 0.46, scratch: 0.42, stab: 0.38, pad: 0.26, strings: 0.26, square: 0.16 },
  accents: { crash: ["drums_elec", 49], fill: ["scratch", [60, 66]], low: ["synthbass", [29, 29]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    if (c.step === 0) for (const t of c.chord) out.push({ inst: "pad", midi: into(t, 56, 75), vel: 0.3 + 0.15 * I, dur: c.barDur * 1.02, pan: 0.1 });
    // moody jazzy piano: rootless 9th voicings, laid back
    const keySteps = [[0, 7, 10], [0, 3, 10, 14], [2, 7, 12]][c.variation % 3]!;
    const voicing = [c.chord[1]!, c.chord[2]!, c.chord[3] ?? c.chord[0]! + 12, c.chord[0]! + 14];
    if (keySteps.includes(c.step) && (!quiet || c.step === 0)) for (const t of voicing) out.push({ inst: "piano", midi: into(t, 55, 74), vel: 0.32 + 0.22 * I, dur: c.stepDur * 3, pan: -0.15, offset: 0.12 });
    // original piano melody loop (2 bars), right hand
    if (!quiet || I > 0.1) for (const [st, iv, len] of HIPHOP_MELODY[c.bar % 2]!) if (st === c.step) out.push({ inst: "piano", midi: into(c.root + iv, 70, 89), vel: 0.38 + 0.25 * I, dur: c.stepDur * len, pan: 0.2, offset: 0.08 });
    if (quiet) return out;
    if (I > 0.15) {
      const kicks = c.variation % 2 ? [0, 7, 10] : [0, 3, 10];
      if (kicks.includes(c.step)) out.push({ inst: "drums_elec", midi: 36, vel: 0.65 + 0.3 * I, dur: 0.8 });
      if (on(c, 4, 12)) out.push({ inst: "drums_elec", midi: 39, vel: 0.55 + 0.3 * I, dur: 0.4 });
      // hats: 8ths, swung; trap rolls at high intensity
      if (c.step % 2 === 0) out.push({ inst: "drums_elec", midi: 42, vel: 0.3 + 0.2 * I, dur: 0.15, pan: 0.3, offset: c.step % 4 === 2 ? 0.18 : 0 });
      if (I > 0.7 && on(c, 13, 14, 15)) out.push({ inst: "drums_elec", midi: 42, vel: 0.25 + 0.2 * I, dur: 0.1, pan: 0.3, offset: 0.5 });
      // 808-style bass following the kick
      if (kicks.includes(c.step)) out.push({ inst: "synthbass", midi: into(c.root, 29, 41), vel: 0.6 + 0.3 * I, dur: c.stepDur * 3 });
    }
    if (I > 0.5 && c.step === 0) out.push({ inst: "strings", midi: into(c.chord[1]!, 60, 75), vel: 0.3 + 0.3 * I, dur: c.barDur, pan: 0.35 });
    if (I > 0.66 && c.step % 4 === 2) {
      const m = motif(c, 68, 87, 0.5 + 0.3 * I);
      if (m) out.push({ inst: "square", midi: m, vel: 0.3 + 0.25 * I, dur: c.stepDur * 1.5, pan: -0.3 });
    }
    return out;
  },
};

const country: GenreDef = {
  id: "country",
  name: "Country",
  bpmMin: 84,
  bpmMax: 150,
  key: 43, // G
  progression: [
    { deg: 0, tones: [0, 4, 7] },
    { deg: 5, tones: [0, 4, 7] },
    { deg: 0, tones: [0, 4, 7] },
    { deg: 7, tones: [0, 4, 7] },
  ],
  mix: { drums_std: 0.72, ebass: 0.55, agtr: 0.5, banjo: 0.4, violin: 0.36, piano: 0.45 },
  accents: { crash: ["drums_std", 49], fill: ["drums_std", [38, 38, 38, 38]], low: ["ebass", [31, 26, 31]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    // acoustic guitar: boom-chick strum
    if (quiet) {
      if (c.step % 4 === 0) out.push({ inst: "agtr", midi: into(c.chord[(c.step / 4) % 3]!, 52, 71), vel: 0.35, dur: c.stepDur * 4, pan: -0.25 });
    } else if (c.step % 2 === 0) {
      for (const t of c.step % 4 === 0 ? [c.chord[0]!] : c.chord) out.push({ inst: "agtr", midi: into(t, 48, 69), vel: 0.35 + 0.3 * I, dur: c.stepDur * 2, pan: -0.25 });
    }
    if (quiet && c.step === 0) out.push({ inst: "violin", midi: into(c.chord[1]!, 64, 79), vel: 0.3, dur: c.barDur, pan: 0.3 });
    if (quiet) return out;
    // bass: root-fifth on 1 and 3 (train beat)
    if (I > 0.2 && on(c, 0, 8)) out.push({ inst: "ebass", midi: into(c.step === 0 ? c.root : c.root + 7, 31, 45), vel: 0.55 + 0.3 * I, dur: c.stepDur * 3 });
    if (I > 0.25) {
      if (on(c, 0, 8)) out.push({ inst: "drums_std", midi: 36, vel: 0.55 + 0.3 * I, dur: 0.4 });
      if (on(c, 4, 12)) out.push({ inst: "drums_std", midi: I > 0.55 ? 38 : 37, vel: 0.45 + 0.35 * I, dur: 0.3 });
      if (c.step % 2 === 0) out.push({ inst: "drums_std", midi: c.mode === "cruise" && c.variation % 2 ? 54 : 42, vel: 0.22 + 0.25 * I, dur: 0.2, pan: 0.3 });
    }
    // banjo rolls at speed
    if (I > 0.45) {
      const roll = [0, 1, 2, 1, 2, 0, 2, 1];
      out.push({ inst: "banjo", midi: into(c.chord[roll[c.step % 8]!]!, 62, 79) + (c.step % 8 === 4 ? 12 : 0), vel: 0.3 + 0.3 * I, dur: c.stepDur * 1.5, pan: 0.35 });
    }
    if (I > 0.35 && c.mode === "cruise" && c.variation % 2 === 0 && on(c, 0, 8)) for (const t of c.chord) out.push({ inst: "piano", midi: into(t, 60, 76), vel: 0.35 + 0.2 * I, dur: c.stepDur * 4, pan: 0.1 });
    // fiddle melody
    if (I > 0.6 && c.step % 2 === 0) {
      const m = motif(c, 67, 88, 0.45 + 0.3 * I);
      if (m) out.push({ inst: "violin", midi: m, vel: 0.35 + 0.3 * I, dur: c.stepDur * 2.5, pan: 0.3 });
    }
    return out;
  },
};

/**
 * Original waltz theme (16 bars), written for ELCAMOSO. Each bar: [step, semitones above the
 * melody tonic, length in 16ths]. 12 steps per bar (3/4).
 */
const WALTZ_THEME: readonly (readonly [number, number, number])[][] = [
  [[0, 7, 8], [8, 9, 4]],
  [[0, 7, 12]],
  [[0, 5, 4], [4, 7, 4], [8, 11, 4]],
  [[0, 14, 8], [8, 11, 4]],
  [[0, 7, 8], [8, 5, 4]],
  [[0, 4, 4], [4, 5, 4], [8, 7, 4]],
  [[0, 9, 8], [8, 7, 4]],
  [[0, 4, 12]],
  [[0, 2, 4], [4, 4, 4], [8, 7, 4]],
  [[0, 12, 12]],
  [[0, 9, 8], [8, 12, 4]],
  [[0, 9, 4], [4, 7, 4], [8, 5, 4]],
  [[0, 11, 8], [8, 7, 4]],
  [[0, 14, 4], [4, 12, 4], [8, 11, 4]],
  [[0, 12, 12]],
  [[0, 7, 4], [4, 4, 4], [8, 2, 4]],
];
/** woodwind answer phrases for cruise variations (same format, 4 bars, loops) */
const WALTZ_ANSWER: readonly (readonly [number, number, number])[][] = [
  [[4, 12, 2], [6, 11, 2], [8, 9, 4]],
  [[4, 7, 4], [8, 4, 4]],
  [[4, 14, 2], [6, 12, 2], [8, 11, 4]],
  [[4, 9, 4], [8, 7, 4]],
];

const waltz: GenreDef = {
  id: "waltz",
  name: "Vienna Waltz",
  bpmMin: 100,
  bpmMax: 176,
  key: 50, // D major
  stepsPerBar: 12,
  reverb: 0.42,
  progression: [
    { deg: 0, tones: [0, 4, 7] },
    { deg: 0, tones: [0, 4, 7] },
    { deg: 7, tones: [0, 4, 7, 10] },
    { deg: 7, tones: [0, 4, 7, 10] },
    { deg: 7, tones: [0, 4, 7, 10] },
    { deg: 7, tones: [0, 4, 7, 10] },
    { deg: 0, tones: [0, 4, 7] },
    { deg: 0, tones: [0, 4, 7] },
    { deg: 0, tones: [0, 4, 7] },
    { deg: 0, tones: [0, 4, 7] },
    { deg: 5, tones: [0, 4, 7] },
    { deg: 5, tones: [0, 4, 7] },
    { deg: 7, tones: [0, 4, 7, 10] },
    { deg: 7, tones: [0, 4, 7, 10] },
    { deg: 0, tones: [0, 4, 7] },
    { deg: 0, tones: [0, 4, 7] },
  ],
  mix: {
    contrabass: 0.5,
    cello: 0.5,
    viola: 0.36,
    violin: 0.46,
    strings: 0.42,
    flute: 0.34,
    oboe: 0.3,
    clarinet: 0.3,
    horn: 0.36,
    harp: 0.5,
    glock: 0.22,
    timpani: 0.6,
    drums_orch: 0.45,
  },
  accents: {
    crash: ["drums_orch", 49],
    fill: ["timpani", [45, 45, 50, 57]],
    low: ["timpani", [45, 38, 38]],
  },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    // the key root (transposed) = chord root minus progression degree
    const deg = waltz.progression[c.bar % waltz.progression.length]!.deg;
    const keyRoot = c.root - deg;
    const phraseBar = c.bar % 16;
    const melTonic = keyRoot + 24; // D5 region
    // harp: rolled arpeggio up the chord every bar (sparse when calm)
    if (c.step === 0 && (!quiet || c.bar % 2 === 0)) {
      const tones = [...c.chord, c.chord[0]! + 12, c.chord[1]! + 12];
      tones.forEach((t, i) => out.push({ inst: "harp", midi: into(t, 55, 84), vel: 0.35 + 0.25 * (quiet ? 0.3 : I), dur: c.barDur, pan: -0.4 + i * 0.12, offset: i * 0.45 }));
    }
    // sustained strings bed
    if (c.step === 0 && (quiet || I < 0.5)) for (const t of c.chord.slice(0, 3)) out.push({ inst: "strings", midi: into(t, 55, 74), vel: 0.3 + 0.25 * I, dur: c.barDur * 1.02, pan: 0.1 });
    if (quiet) {
      if (c.step === 0) out.push({ inst: "cello", midi: into(c.root, 38, 52), vel: 0.35, dur: c.barDur, pan: -0.2 });
      return out;
    }
    // oom: basses + cellos on 1
    if (c.step === 0) {
      out.push({ inst: "contrabass", midi: into(c.bar % 2 ? c.root + 7 : c.root, 33, 47), vel: 0.5 + 0.3 * I, dur: c.stepDur * 4 });
      out.push({ inst: "cello", midi: into(c.bar % 2 ? c.root + 7 : c.root, 43, 55), vel: 0.45 + 0.3 * I, dur: c.stepDur * 4, pan: -0.25 });
    }
    // pah-pah: violas + 2nd violins on 2 and 3, beat 2 a touch early (Viennese lilt)
    if (I > 0.18 && (c.step === 4 || c.step === 8)) {
      const early = c.step === 4 ? -0.35 : 0;
      for (const t of c.chord.slice(1, 4)) out.push({ inst: "viola", midi: into(t, 57, 72), vel: (c.step === 4 ? 0.4 : 0.34) + 0.25 * I, dur: c.stepDur * 2.2, pan: 0.25, offset: early });
    }
    // theme: first violins, flute doubling the octave as intensity rises
    if (I > 0.32) {
      for (const [st, iv, len] of WALTZ_THEME[phraseBar]!) {
        if (st !== c.step) continue;
        const m = melTonic + iv;
        out.push({ inst: "violin", midi: m, vel: 0.42 + 0.35 * I, dur: c.stepDur * len, pan: -0.35 });
        if (I > 0.58) out.push({ inst: "flute", midi: m + 12 <= 96 ? m + 12 : m, vel: 0.3 + 0.3 * I, dur: c.stepDur * len, pan: 0.2 });
        if (I > 0.74 && len >= 8) out.push({ inst: "glock", midi: into(m + 12, 79, 101), vel: 0.35 + 0.25 * I, dur: 0.8, pan: 0.4 });
      }
    }
    // woodwind answers while cruising (oboe / clarinet alternate per variation)
    if (c.mode === "cruise" && I > 0.3 && phraseBar % 2 === 1) {
      const ans = WALTZ_ANSWER[(Math.floor(phraseBar / 2) + c.variation) % WALTZ_ANSWER.length]!;
      for (const [st, iv, len] of ans) if (st === c.step) out.push({ inst: c.variation % 2 ? "oboe" : "clarinet", midi: keyRoot + 12 + iv, vel: 0.35 + 0.25 * I, dur: c.stepDur * len, pan: 0.35 });
    }
    // horns: warm sustained chord when building / high
    if (I > 0.55 && c.step === 0) for (const t of c.chord.slice(0, 3)) out.push({ inst: "horn", midi: into(t, 53, 69), vel: 0.35 + 0.35 * I, dur: c.barDur * 0.95, pan: 0.05 });
    // full strings swell at high intensity
    if (I > 0.5 && c.step === 0) for (const t of c.chord.slice(0, 3)) out.push({ inst: "strings", midi: into(t, 62, 81), vel: 0.35 + 0.3 * I, dur: c.barDur, pan: -0.1 });
    // timpani on phrase starts and at high intensity on every downbeat
    if (c.step === 0 && (phraseBar % 4 === 0 || I > 0.7)) out.push({ inst: "timpani", midi: into(c.root, 38, 50), vel: 0.4 + 0.4 * I, dur: 0.9 });
    // cymbal at the top of a 16-bar phrase when energetic
    if (c.step === 0 && phraseBar === 0 && I > 0.6) out.push({ inst: "drums_orch", midi: 49, vel: 0.4 + 0.3 * I, dur: 1.5 });
    return out;
  },
};

// ---- energy layers: tempo stays put, speed and acceleration stack genre-specific parts ----
const push = (c: StepContext) => c.mode === "surge" || c.intensity > 0.8;
const LAYERED: Partial<Record<GenreId, { bpm: number; mix: Record<string, number>; layers: (c: StepContext) => NoteSpec[] }>> = {
  rock: {
    bpm: 124,
    mix: { dguitar: 0.34 },
    layers(c) {
      const o: NoteSpec[] = []; const I = c.intensity;
      // doubled power chords (root+5th+8ve), panned wide
      if (I > 0.45 && c.step % 2 === 0) for (const pan of [-0.7, 0.7]) for (const iv of [0, 7, 12]) o.push({ inst: "dguitar", midi: into(c.root, 40, 52) + iv, vel: 0.45 + 0.3 * I, dur: c.stepDur * 1.6, pan });
      if (I > 0.6 && c.step === 0) o.push({ inst: "drums_rock", midi: 49, vel: 0.6 + 0.3 * I, dur: 1.2, pan: -0.3 });
      if (push(c) && c.step >= 12) o.push({ inst: "drums_rock", midi: [50, 48, 45, 45][c.step - 12]!, vel: 0.75, dur: 0.4 });
      if (I > 0.75 && on(c, 2, 10)) o.push({ inst: "drums_rock", midi: 36, vel: 0.7, dur: 0.4 });
      return o;
    },
  },
  pop: {
    bpm: 116,
    mix: { stab: 0.3, polysynth: 0.3, drums_elec: 0.6 },
    layers(c) {
      const o: NoteSpec[] = []; const I = c.intensity;
      if (I > 0.4 && on(c, 4, 12)) o.push({ inst: "drums_elec", midi: 39, vel: 0.5 + 0.3 * I, dur: 0.3 });
      if (I > 0.5 && on(c, 3, 6, 11, 14)) for (const t of c.chord) o.push({ inst: "stab", midi: into(t, 60, 76), vel: 0.4 + 0.3 * I, dur: c.stepDur * 1.2, pan: 0.3 });
      if (I > 0.62 && c.step === 0) for (const t of c.chord) o.push({ inst: "polysynth", midi: into(t, 64, 81), vel: 0.4 + 0.3 * I, dur: c.barDur, pan: -0.3 });
      if (push(c) && c.step >= 8 && c.step % 2 === 0) o.push({ inst: "drums_elec", midi: 39, vel: 0.3 + 0.05 * c.step, dur: 0.2 });
      return o;
    },
  },
  metal: {
    bpm: 132,
    mix: { dguitar: 0.36 },
    layers(c) {
      const o: NoteSpec[] = []; const I = c.intensity;
      // double kick 16ths, then chug layer on low E-ish root
      if (I > 0.55) o.push({ inst: "drums_rock", midi: 36, vel: 0.55 + 0.3 * I, dur: 0.2 });
      if (I > 0.45 && ![3, 7, 11, 15].includes(c.step)) for (const pan of [-0.75, 0.75]) o.push({ inst: "dguitar", midi: into(c.root, 28, 40), vel: 0.5 + 0.35 * I, dur: c.stepDur * 0.6, pan });
      if (I > 0.7 && c.step % 8 === 0) o.push({ inst: "drums_rock", midi: c.step ? 57 : 49, vel: 0.7, dur: 1 });
      if (push(c) && c.step >= 12) o.push({ inst: "drums_rock", midi: [50, 48, 45, 45][c.step - 12]!, vel: 0.8, dur: 0.3 });
      return o;
    },
  },
  hiphop: {
    bpm: 92,
    mix: { synthbass: 0.62 },
    layers(c) {
      const o: NoteSpec[] = []; const I = c.intensity;
      const r = into(c.root, 28, 40);
      // 808-style bass with slides (grace notes gliding into the target)
      if (I > 0.4 && on(c, 0, 7, 10)) o.push({ inst: "synthbass", midi: r, vel: 0.7 + 0.25 * I, dur: c.stepDur * 2.5 });
      if (I > 0.55 && on(c, 13)) for (const [k, d] of [[0, 0], [1, 0.33], [2, 0.66]] as const) o.push({ inst: "synthbass", midi: r + 12 - k * 4, vel: 0.55, dur: c.stepDur * 0.4, offset: d });
      // hat rolls: 32nds / triplets at high energy
      if (I > 0.6 && on(c, 6, 14)) for (const d of [0, 0.33, 0.66]) o.push({ inst: "drums_elec", midi: 42, vel: 0.3 + 0.2 * I, dur: 0.08, offset: d, pan: 0.3 });
      if (push(c) && c.step >= 12) for (const d of [0, 0.5]) o.push({ inst: "drums_elec", midi: 42, vel: 0.35, dur: 0.06, offset: d });
      if (I > 0.7 && on(c, 4, 12)) o.push({ inst: "drums_elec", midi: 39, vel: 0.65, dur: 0.3 });
      // DJ scratches: turntable fills at end of 4-bar phrases, chirps on energy layer, tear on surge
      if (I > 0.45 && c.bar % 4 === 3 && on(c, 12)) o.push({ inst: "scratch", midi: 60, vel: 0.7, dur: c.stepDur * 4, pan: -0.25 });
      if (I > 0.62 && c.bar % 2 === 1 && on(c, 14)) o.push({ inst: "scratch", midi: c.bar % 4 === 1 ? 63 : 66, vel: 0.6, dur: c.stepDur * 2, pan: 0.25 });
      if (push(c) && on(c, 8)) o.push({ inst: "scratch", midi: 69, vel: 0.75, dur: c.stepDur * 6 });
      return o;
    },
  },
  country: {
    bpm: 120,
    mix: { banjo: 0.42, violin: 0.36 },
    layers(c) {
      const o: NoteSpec[] = []; const I = c.intensity;
      // train beat: snare 16ths accenting 2 and 4
      if (I > 0.45) o.push({ inst: "drums_std", midi: 38, vel: (c.step % 8 === 4 ? 0.55 : 0.22) + 0.2 * I, dur: 0.1 });
      // banjo roll over the chord
      if (I > 0.5) { const t = [...c.chord, c.chord[0]! + 12]; o.push({ inst: "banjo", midi: into(t[[0, 2, 3, 1, 2, 3, 0, 2][c.step % 8]!]!, 55, 79), vel: 0.4 + 0.3 * I, dur: c.stepDur * 1.2, pan: 0.4 }); }
      // fiddle double-stops when pushing
      if (I > 0.68 && c.step % 4 === 0) for (const t of c.chord.slice(0, 2)) o.push({ inst: "violin", midi: into(t + 12, 62, 84), vel: 0.4 + 0.3 * I, dur: c.stepDur * 3.5, pan: -0.4 });
      if (push(c) && c.step === 0) o.push({ inst: "drums_std", midi: 49, vel: 0.6, dur: 1 });
      return o;
    },
  },
  house: {
    bpm: 124,
    mix: { piano: 0.45, drums_std: 0.5 },
    layers(c) {
      const o: NoteSpec[] = []; const I = c.intensity;
      // piano chord stabs (offbeat house piano)
      if (I > 0.5 && on(c, 2, 5, 10, 13)) for (const t of c.chord) o.push({ inst: "piano", midi: into(t, 60, 79), vel: 0.45 + 0.3 * I, dur: c.stepDur * 1.4, pan: -0.15 });
      // percussion: shaker 16ths + conga/cowbell-ish
      if (I > 0.4 && c.step % 2 === 1) o.push({ inst: "drums_std", midi: 54, vel: 0.2 + 0.2 * I, dur: 0.1, pan: 0.5 });
      if (I > 0.62 && on(c, 3, 11, 14)) o.push({ inst: "drums_std", midi: 37, vel: 0.4, dur: 0.15, pan: -0.5 });
      if (push(c) && c.step >= 8) o.push({ inst: "drums_elec", midi: 39, vel: 0.25 + 0.05 * c.step, dur: 0.15 });
      return o;
    },
  },
};

const ELECTRO_RIFFS: readonly (readonly [number, number, number])[][] = [
  [[0, 0, 2], [3, 0, 1], [4, 12, 1], [6, 0, 2], [8, 10, 1], [10, 0, 2], [12, 7, 1], [14, 12, 2]],
  [[0, 0, 3], [3, 3, 1], [6, 0, 1], [7, 12, 1], [8, 0, 2], [11, 5, 1], [12, 3, 2], [14, 0, 1], [15, 10, 1]],
  [[0, 0, 1], [2, 0, 1], [3, 12, 1], [6, 0, 2], [8, 7, 2], [10, 10, 1], [11, 0, 1], [13, 12, 1], [14, 0, 2]],
];
const ELECTRO_HOOK: readonly (readonly [number, number])[] = [[0, 12], [3, 10], [6, 7], [10, 12], [12, 15], [14, 12]];

const electro: GenreDef = {
  id: "electro",
  name: "Electro Bass",
  // fixed tempo: speed adds layers, never speeds the groove up
  bpmMin: 126,
  bpmMax: 126,
  fixedBpm: 126,
  key: 41, // F minor
  progression: [
    { deg: 0, tones: [0, 3, 7] },
    { deg: 0, tones: [0, 3, 7] },
    { deg: 8, tones: [0, 4, 7] },
    { deg: 10, tones: [0, 4, 7] },
  ],
  mix: { drums_electro: 0.8, electrobass: 0.62, electrosub: 0.7, electrolead: 0.16, pad: 0.2 },
  reverb: 0.05,
  accents: { crash: ["drums_electro", 49], fill: ["drums_electro", [38]], low: ["drums_electro", [35, 45, 45]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    const bassRoot = into(c.root, 29, 40);
    // breakdown (braking / stopped): pad + long sub swells + a slow distorted heartbeat
    if (quiet) {
      if (c.step === 0) for (const t of c.chord) out.push({ inst: "pad", midi: into(t, 53, 72), vel: 0.4, dur: c.barDur * 1.02, pan: (t % 2) * 0.4 - 0.2 });
      if (on(c, 0, 8)) {
        out.push({ inst: "electrosub", midi: bassRoot - 12 < 24 ? bassRoot : bassRoot - 12, vel: 0.6, dur: c.stepDur * 6 });
        out.push({ inst: "electrobass", midi: bassRoot, vel: 0.42, dur: c.stepDur * 2 });
      }
      if (c.mode === "brake" && on(c, 12)) out.push({ inst: "drums_electro", midi: 39, vel: 0.35, dur: 0.3 });
      return out;
    }
    // layer 1 (always while moving): kick + sub on every offbeat + the main distorted riff
    if (c.step % 4 === 0) out.push({ inst: "drums_electro", midi: 36, vel: 0.9, dur: 0.4 });
    if (c.step % 4 === 2) out.push({ inst: "electrosub", midi: bassRoot, vel: 0.75 + 0.2 * I, dur: c.stepDur * 1.7 });
    const riff = ELECTRO_RIFFS[c.variation % ELECTRO_RIFFS.length]!;
    for (const [st, iv, len] of riff) if (st === c.step) out.push({ inst: "electrobass", midi: bassRoot + iv, vel: 0.7 + 0.25 * I, dur: c.stepDur * len * 0.9 });
    if (c.step % 4 === 2) out.push({ inst: "drums_electro", midi: 46, vel: 0.35 + 0.25 * I, dur: 0.2, pan: 0.2 });
    // layer 2: claps + pumping pad
    if (I > 0.3 && on(c, 4, 12)) out.push({ inst: "drums_electro", midi: 39, vel: 0.6 + 0.3 * I, dur: 0.3 });
    if (I > 0.3 && c.step % 4 === 2) for (const t of c.chord) out.push({ inst: "pad", midi: into(t, 56, 75), vel: 0.28 + 0.2 * I, dur: c.stepDur * 1.8, pan: (t % 2) * 0.5 - 0.25 });
    // layer 3: octave bass answering the riff + 16th hats
    if (I > 0.45) {
      const ans = ELECTRO_RIFFS[(c.variation + 1) % ELECTRO_RIFFS.length]!;
      for (const [st, iv] of ans) if (st === c.step && st % 4 !== 0) out.push({ inst: "electrobass", midi: bassRoot + 12 + iv, vel: 0.45 + 0.3 * I, dur: c.stepDur * 0.8, pan: 0.2 });
      if (c.step % 2 === 1) out.push({ inst: "drums_electro", midi: 42, vel: 0.25 + 0.2 * I, dur: 0.1, pan: -0.25 });
    }
    // layer 4: percussion toms + sub drop at every 4-bar phrase + hook on top
    if (I > 0.6) {
      if (on(c, 7, 15) && c.bar % 2 === 1) out.push({ inst: "drums_electro", midi: 45, vel: 0.5 + 0.3 * I, dur: 0.2, pan: 0.3 });
      if (c.step === 0 && c.bar % 4 === 0) out.push({ inst: "drums_electro", midi: 35, vel: 0.8, dur: 1.2 });
      if (c.bar % 2 === 0) for (const [st, iv] of ELECTRO_HOOK) if (st === c.step) out.push({ inst: "electrolead", midi: into(c.root + iv, 62, 82), vel: 0.4 + 0.3 * I, dur: c.stepDur * 1.6, pan: 0.15 });
    }
    // build-up while accelerating hard: tightening snare roll + riser, then the sub drop lands on the next bar
    if (c.mode === "surge") {
      const every = c.step < 8 ? 2 : 1;
      if (c.step % every === 0) out.push({ inst: "drums_electro", midi: 38, vel: 0.35 + 0.04 * c.step, dur: 0.15 });
      if (c.step === 0) out.push({ inst: "drums_electro", midi: 51, vel: 0.65, dur: c.barDur });
    }
    return out;
  },
};

function progDeg(bar: number) {
  return [0, 7, 9, 5][bar % 4]!;
}

const ANTHEM_THEME: readonly (readonly [number, number, number])[][] = [
  [[0, 7, 6], [6, 9, 2], [8, 11, 4], [12, 12, 4]],
  [[0, 14, 8], [8, 12, 4], [12, 11, 4]],
  [[0, 9, 6], [6, 11, 2], [8, 12, 4], [12, 16, 4]],
  [[0, 14, 12], [12, 12, 4]],
  [[0, 7, 4], [4, 12, 4], [8, 11, 2], [10, 12, 2], [12, 14, 4]],
  [[0, 16, 8], [8, 14, 4], [12, 12, 4]],
  [[0, 11, 4], [4, 12, 4], [8, 14, 4], [12, 19, 4]],
  [[0, 19, 10], [10, 16, 2], [12, 14, 4]],
];

const anthem: GenreDef = {
  id: "anthem",
  name: "Road Anthem",
  bpmMin: 92,
  bpmMax: 128,
  fixedBpm: 110,
  key: 50, // D major
  progression: [
    { deg: 0, tones: [0, 4, 7] },
    { deg: 7, tones: [0, 4, 7] },
    { deg: 9, tones: [0, 3, 7] },
    { deg: 5, tones: [0, 4, 7] },
  ],
  mix: { drums_rock: 0.82, ebass: 0.6, dguitar: 0.38, guitar: 0.4, leadgtr: 0.34, strings: 0.32, choir: 0.3, piano: 0.42, timpani: 0.5 },
  reverb: 0.16,
  accents: { crash: ["drums_rock", 49], fill: ["drums_rock", [50, 48, 45]], low: ["drums_rock", [45, 45, 36]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    const pb = c.bar % 8;
    const keyRoot = 62 + (c.root - progDeg(c.bar) - 50); // D4 + transposition
    const gr = into(c.root, 38, 50);
    // calm / idle: clean guitar arpeggio + piano, the emotional intro
    if (quiet || I < 0.3) {
      if (c.step % 2 === 0) { const t = [...c.chord, c.chord[0]! + 12]; out.push({ inst: "guitar", midi: into(t[(c.step / 2) % 4]!, 52, 71), vel: 0.4, dur: c.stepDur * 3, pan: -0.2 }); }
      if (c.step === 0) for (const t of c.chord) out.push({ inst: "piano", midi: into(t, 55, 72), vel: 0.35, dur: c.barDur });
      if (quiet) return out;
    }
    // layer 1 (moving): rock drums + bass guitar 8ths + palm-muted power chords
    if (on(c, 0, 8) || (I > 0.5 && on(c, 6, 10))) out.push({ inst: "drums_rock", midi: 36, vel: 0.8 + 0.2 * I, dur: 0.5 });
    if (on(c, 4, 12)) out.push({ inst: "drums_rock", midi: 38, vel: 0.7 + 0.3 * I, dur: 0.5 });
    if (c.step % 2 === 0) out.push({ inst: "drums_rock", midi: I > 0.6 ? 46 : 42, vel: 0.3 + 0.25 * I, dur: 0.3, pan: 0.25 });
    if (c.step % 2 === 0) out.push({ inst: "ebass", midi: into(c.root, 33, 45), vel: 0.6 + 0.3 * I, dur: c.stepDur * 1.8 });
    if (I > 0.3 && I <= 0.5 && c.step % 2 === 0) for (const iv of [0, 7]) out.push({ inst: "dguitar", midi: gr + iv, vel: 0.45, dur: c.stepDur * 0.9, pan: -0.5 });
    // layer 2: open power chords doubled left/right + lead guitar melody
    if (I > 0.5 && (c.step === 0 || on(c, 6, 8, 14))) for (const pan of [-0.75, 0.75]) for (const iv of [0, 7, 12]) out.push({ inst: "dguitar", midi: gr + iv, vel: 0.5 + 0.3 * I, dur: c.stepDur * (c.step === 0 ? 5 : 2), pan });
    if (I > 0.38) for (const [st, iv, len] of ANTHEM_THEME[pb]!) if (st === c.step) out.push({ inst: "leadgtr", midi: keyRoot + iv, vel: 0.5 + 0.4 * I, dur: c.stepDur * len, pan: 0.1 });
    // layer 3: crashes, tom fills, timpani
    if (I > 0.62 && c.step === 0 && pb % 2 === 0) out.push({ inst: "drums_rock", midi: 49, vel: 0.6 + 0.3 * I, dur: 1.5, pan: -0.3 });
    if (I > 0.62 && pb % 4 === 3 && c.step >= 12) out.push({ inst: "drums_rock", midi: [50, 48, 45, 45][c.step - 12]!, vel: 0.75, dur: 0.4 });
    if (I > 0.62 && c.step === 0 && pb % 4 === 0) out.push({ inst: "timpani", midi: into(c.root, 38, 50), vel: 0.7, dur: 1 });
    // layer 4 (peak): strings + choir lift, melody doubled an octave up in strings
    if (I > 0.74 && c.step === 0) {
      for (const t of c.chord) out.push({ inst: "strings", midi: into(t, 62, 81), vel: 0.4 + 0.3 * I, dur: c.barDur, pan: 0.3 });
      for (const t of c.chord) out.push({ inst: "choir", midi: into(t, 60, 76), vel: 0.4 + 0.3 * I, dur: c.barDur, pan: -0.3 });
    }
    if (I > 0.74) for (const [st, iv, len] of ANTHEM_THEME[pb]!) if (st === c.step) out.push({ inst: "strings", midi: keyRoot + iv + 12, vel: 0.35 + 0.3 * I, dur: c.stepDur * len, pan: -0.3 });
    // build-up while accelerating hard: tom/snare roll into the next downbeat
    if (c.mode === "surge") {
      if (c.step % 2 === 0) out.push({ inst: "timpani", midi: into(c.root, 38, 50), vel: 0.35 + 0.03 * c.step, dur: 0.3 });
      if (c.step >= 8) out.push({ inst: "drums_rock", midi: 38, vel: 0.35 + 0.04 * c.step, dur: 0.2 });
    }
    return out;
  },
};

// Original dark rock-house motif (D minor, Phrygian b2 colour): [step, semitone from D, len16]
const DARK_MOTIF: readonly (readonly [number, number, number])[][] = [
  [[0, 0, 6], [6, 3, 2], [8, 1, 8]],
  [[0, 0, 4], [4, -2, 4], [8, -5, 8]],
  [[0, 7, 6], [6, 8, 2], [8, 7, 4], [12, 3, 4]],
  [[0, 1, 8], [8, 0, 8]],
];
const darkrave: GenreDef = {
  id: "darkrave",
  name: "Midnight Dark Rave",
  bpmMin: 120,
  bpmMax: 130,
  fixedBpm: 126,
  key: 38, // D minor
  progression: [
    { deg: 0, tones: [0, 3, 7] },
    { deg: 0, tones: [0, 3, 7] },
    { deg: 8, tones: [0, 4, 7] },
    { deg: 1, tones: [0, 4, 7] }, // Phrygian bII - the brooding turn
  ],
  mix: { drums_elec: 0.8, drums_rock: 0.5, synthbass: 0.7, ebass: 0.45, dguitar: 0.34, choir: 0.36, horn: 0.34, pad: 0.3, lead: 0.2, timpani: 0.55, contrabass: 0.4 },
  reverb: 0.2,
  accents: { crash: ["drums_rock", 49], fill: ["drums_rock", [48, 45, 45]], low: ["timpani", [38, 38]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    const pb = c.bar % 4;
    const dRoot = 50; // motif anchored to key D
    // eerie pad + low contrabass drone: always (the mystic bed)
    if (c.step === 0) {
      for (const t of c.chord) out.push({ inst: "pad", midi: into(t, 57, 72), vel: 0.4, dur: c.barDur * 1.02, pan: (t % 2) * 0.6 - 0.3 });
      out.push({ inst: "contrabass", midi: into(c.root, 26, 38), vel: 0.5, dur: c.barDur });
    }
    if (quiet) {
      if (on(c, 0)) out.push({ inst: "drums_elec", midi: 36, vel: 0.35, dur: 0.6 });
      if (on(c, 0) && pb === 0) out.push({ inst: "timpani", midi: into(c.root, 38, 45), vel: 0.4, dur: 1.2 });
      return out;
    }
    // layer 1: four-on-the-floor kick + sub bass offbeats
    if (c.step % 4 === 0) out.push({ inst: "drums_elec", midi: 36, vel: 0.8 + 0.2 * I, dur: 0.5 });
    if (I > 0.2 && c.step % 4 === 2) out.push({ inst: "synthbass", midi: into(c.root, 26, 38), vel: 0.7 + 0.3 * I, dur: c.stepDur * 1.8 });
    if (I > 0.25 && c.step % 4 === 2) out.push({ inst: "drums_elec", midi: I > 0.55 ? 46 : 42, vel: 0.35 + 0.3 * I, dur: 0.3, pan: 0.25 });
    // layer 2: distorted rolling bass 16ths + clap/rock snare + guitar stabs
    if (I > 0.42 && c.step % 4 !== 0) out.push({ inst: "ebass", midi: into(c.root, 33, 45) + (c.step % 4 === 3 ? 12 : 0), vel: 0.5 + 0.3 * I, dur: c.stepDur * 0.9 });
    if (I > 0.38 && on(c, 4, 12)) { out.push({ inst: "drums_elec", midi: 39, vel: 0.6 + 0.3 * I, dur: 0.4 }); out.push({ inst: "drums_rock", midi: 38, vel: 0.5 + 0.3 * I, dur: 0.4 }); }
    const gr = into(c.root, 38, 50);
    if (I > 0.48 && on(c, 0, 3, 6, 10)) for (const pan of [-0.7, 0.7]) for (const iv of [0, 7, 12]) out.push({ inst: "dguitar", midi: gr + iv, vel: 0.55 + 0.3 * I, dur: c.stepDur * 1.2, pan });
    // layer 3: low choir + brass swells and the motif in horns, timpani on the 1
    if (I > 0.6 && c.step === 0) {
      for (const t of c.chord) out.push({ inst: "choir", midi: into(t, 50, 64), vel: 0.45 + 0.3 * I, dur: c.barDur, pan: -0.3 });
      out.push({ inst: "timpani", midi: into(c.root, 38, 45), vel: 0.75, dur: 1.2 });
    }
    if (I > 0.6) for (const [st, iv, len] of DARK_MOTIF[pb]!) if (st === c.step) out.push({ inst: "horn", midi: into(dRoot + iv, 45, 62), vel: 0.5 + 0.4 * I, dur: c.stepDur * len, pan: 0.3 });
    // layer 4 (peak): crash, open hats 16ths, high eerie lead doubling the motif
    if (I > 0.74 && c.step === 0 && pb === 0) out.push({ inst: "drums_rock", midi: 49, vel: 0.7, dur: 1.5, pan: -0.3 });
    if (I > 0.74 && c.step % 2 === 1) out.push({ inst: "drums_elec", midi: 42, vel: 0.25 + 0.2 * I, dur: 0.15, pan: -0.2 });
    if (I > 0.74) for (const [st, iv, len] of DARK_MOTIF[pb]!) if (st === c.step) out.push({ inst: "lead", midi: into(dRoot + iv + 12, 62, 80), vel: 0.3 + 0.3 * I, dur: c.stepDur * len, pan: -0.4 });
    // tension riser while accelerating hard: snare roll building + rising timpani
    if (c.mode === "surge") {
      out.push({ inst: "drums_rock", midi: 38, vel: 0.25 + 0.04 * c.step, dur: 0.15 });
      if (c.step % 4 === 0) out.push({ inst: "timpani", midi: into(c.root, 38, 45) + (c.step >> 2), vel: 0.4 + 0.05 * c.step, dur: 0.4 });
    }
    return out;
  },
};

// ---- Latino Fiesta: fixed 96 bpm reggaeton, speed stacks percussion, guitar, montuno and brass ----
const LATINO_BRASS: readonly (readonly [number, number, number])[][] = [
  [[0, 7, 2], [3, 7, 1], [6, 10, 2], [10, 12, 3]],
  [[0, 12, 2], [4, 10, 1], [6, 7, 2], [12, 3, 3]],
];
/** Piano montuno (2-bar guajeo): [step, chord-tone index, octave up]. */
const LATINO_MONTUNO: readonly (readonly [number, number, number])[][] = [
  [[0, 0, 0], [2, 2, 0], [3, 1, 1], [5, 0, 1], [6, 2, 0], [8, 1, 0], [10, 2, 0], [11, 0, 1], [13, 1, 0], [14, 2, 0]],
  [[0, 2, 0], [1, 0, 1], [3, 1, 0], [4, 2, 0], [6, 0, 1], [8, 2, 0], [9, 1, 1], [11, 2, 0], [12, 0, 1], [14, 1, 0]],
];

const latino: GenreDef = {
  id: "latino",
  name: "Latino Fiesta",
  bpmMin: 96,
  bpmMax: 96,
  fixedBpm: 96,
  key: 45, // A minor: Am - F - C - G
  progression: [
    { deg: 0, tones: [0, 3, 7] },
    { deg: 8, tones: [0, 4, 7] },
    { deg: 3, tones: [0, 4, 7] },
    { deg: 10, tones: [0, 4, 7] },
  ],
  mix: { drums_latin: 0.85, synthbass: 0.55, pad: 0.24, nylon: 0.5, piano: 0.42, brass: 0.36 },
  reverb: 0.1,
  accents: { crash: ["drums_latin", 49], fill: ["drums_latin", [65, 65, 66, 66]], low: ["drums_latin", [64, 64, 36]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    // warm pad from the very start
    if (c.step === 0) for (const t of c.chord) out.push({ inst: "pad", midi: into(t, 57, 76), vel: 0.3 + 0.15 * I, dur: c.barDur * 1.02, pan: (t % 2) * 0.4 - 0.2 });
    if (quiet) {
      // stopped / braking: soft nylon arpeggio on the beats only
      if (c.step % 4 === 0) out.push({ inst: "nylon", midi: into(c.chord[(c.step / 4) % 3]!, 52, 71), vel: 0.35, dur: c.stepDur * 4, pan: 0.25 });
      return out;
    }
    // shaker 16ths
    if (I > 0.1) out.push({ inst: "drums_latin", midi: 70, vel: (c.step % 2 ? 0.18 : 0.28) + 0.15 * I, dur: 0.1, pan: 0.45 });
    // dembow: kick on the beats, snare on 3, 6, 11, 14 + bass with the kick
    if (I > 0.13) {
      if (c.step % 4 === 0) out.push({ inst: "drums_latin", midi: 36, vel: 0.8 + 0.15 * I, dur: 0.4 });
      if (on(c, 3, 6, 11, 14)) out.push({ inst: "drums_latin", midi: 38, vel: 0.5 + 0.3 * I, dur: 0.3, pan: -0.1 });
      if (on(c, 0, 3, 8, 11)) out.push({ inst: "synthbass", midi: into(c.root, 33, 45), vel: 0.6 + 0.3 * I, dur: c.stepDur * (on(c, 0, 8) ? 2.6 : 1.4) });
    }
    // congas (tumbao), guiro, nylon guitar strum
    if (I > 0.32) {
      if (on(c, 6, 14)) out.push({ inst: "drums_latin", midi: 63, vel: 0.45 + 0.3 * I, dur: 0.3, pan: -0.4 });
      if (on(c, 7, 15)) out.push({ inst: "drums_latin", midi: 64, vel: 0.4 + 0.3 * I, dur: 0.3, pan: -0.45 });
      if (on(c, 2, 10)) out.push({ inst: "drums_latin", midi: 62, vel: 0.35 + 0.2 * I, dur: 0.2, pan: -0.35 });
      if (on(c, 0, 8)) out.push({ inst: "drums_latin", midi: 74, vel: 0.3 + 0.2 * I, dur: 0.3, pan: 0.5 });
      if (on(c, 4, 6, 12, 14)) out.push({ inst: "drums_latin", midi: 73, vel: 0.28 + 0.2 * I, dur: 0.15, pan: 0.5 });
      if (on(c, 0, 3, 6, 8, 11, 14)) c.chord.forEach((t, i) => out.push({ inst: "nylon", midi: into(t, 52, 71), vel: 0.35 + 0.25 * I, dur: c.stepDur * 2.5, pan: 0.3, offset: i * 0.06 }));
    }
    // piano montuno + timbales
    if (I > 0.57) {
      for (const [st, ix, up] of LATINO_MONTUNO[c.bar % 2]!) if (st === c.step) out.push({ inst: "piano", midi: into(c.chord[ix]!, 64, 79) + up * 12, vel: 0.35 + 0.25 * I, dur: c.stepDur * 1.6, pan: -0.25 });
      if (on(c, 0, 3, 6, 10, 12)) out.push({ inst: "drums_latin", midi: 75, vel: 0.35 + 0.2 * I, dur: 0.15, pan: 0.35 });
      if (c.bar % 2 === 1 && on(c, 12, 13, 14, 15)) out.push({ inst: "drums_latin", midi: c.step < 14 ? 65 : 66, vel: 0.5 + 0.3 * I, dur: 0.25, pan: 0.2 });
    }
    // brass hits + cowbell at full pace
    if (I > 0.77) {
      if (c.step % 4 === 0) out.push({ inst: "drums_latin", midi: 56, vel: 0.38 + 0.2 * I, dur: 0.2, pan: 0.15 });
      for (const [st, iv, len] of LATINO_BRASS[c.variation % 2]!) if (st === c.step) {
        out.push({ inst: "brass", midi: into(c.root + iv, 60, 76), vel: 0.5 + 0.35 * I, dur: c.stepDur * len, pan: -0.1 });
        out.push({ inst: "brass", midi: into(c.root + iv, 60, 76) - 5, vel: 0.4 + 0.3 * I, dur: c.stepDur * len, pan: 0.1 });
      }
      if (c.step === 0 && c.bar % 4 === 0) out.push({ inst: "drums_latin", midi: 49, vel: 0.55, dur: 1.4, pan: -0.3 });
    }
    return out;
  },
};

/**
 * Gothic Night: original minor-key orchestral piece for the Dracula Carriage
 * (D minor, i - VI - iv - V). Organ and low strings from the start; choir,
 * cello ostinato, timpani and a high string line join as the drive builds.
 */
const gothic: GenreDef = {
  id: "gothic",
  name: "Gothic Night",
  bpmMin: 68,
  bpmMax: 104,
  key: 50, // D minor
  progression: [
    { deg: 0, tones: [0, 3, 7] },
    { deg: 8, tones: [0, 4, 7] },
    { deg: 5, tones: [0, 3, 7] },
    { deg: 7, tones: [0, 4, 7, 10] },
  ],
  mix: { organ: 0.42, strings: 0.45, choir: 0.4, cello: 0.5, contrabass: 0.5, timpani: 0.6, violin: 0.34, drums_orch: 0.45 },
  reverb: 0.3,
  accents: { crash: ["timpani", 38], fill: ["timpani", [45, 45, 38]], low: ["timpani", [38, 36, 33]] },
  pattern(c) {
    const out: NoteSpec[] = [];
    const I = c.intensity;
    const quiet = calm(c.mode);
    // held organ chord on every bar, low and soft
    if (c.step === 0) for (const t of c.chord.slice(0, 3)) out.push({ inst: "organ", midi: into(t, 48, 67), vel: 0.28 + 0.22 * I, dur: c.barDur * 1.02, pan: (t % 2) * 0.3 - 0.15 });
    if (c.step === 0) out.push({ inst: "contrabass", midi: into(c.root, 28, 40), vel: 0.4 + 0.3 * I, dur: c.barDur, pan: -0.1 });
    if (quiet) {
      // stopped / braking: a lonely string note on beat 3
      if (c.step === 8) out.push({ inst: "strings", midi: into(c.chord[2]!, 62, 74), vel: 0.25, dur: c.barDur * 0.6, pan: 0.3 });
      return out;
    }
    // low strings swell
    if (I > 0.15 && c.step === 0) for (const t of c.chord.slice(0, 3)) out.push({ inst: "strings", midi: into(t, 50, 66), vel: 0.3 + 0.3 * I, dur: c.barDur * 1.02, pan: -0.25 });
    // cello ostinato: root-fifth-minor third in 8ths
    if (I > 0.28 && c.step % 2 === 0) {
      const seq = [0, 7, 3, 7, 0, 7, 3, 8];
      out.push({ inst: "cello", midi: into(c.root + seq[(c.step / 2) % 8]!, 38, 57), vel: 0.35 + 0.35 * I, dur: c.stepDur * 1.8, pan: -0.15 });
    }
    // choir "aah" on the bar
    if (I > 0.38 && c.step === 0) for (const t of c.chord.slice(0, 3)) out.push({ inst: "choir", midi: into(t, 57, 74), vel: 0.3 + 0.35 * I, dur: c.barDur * 1.02, pan: 0.2 });
    // timpani heartbeat
    if (I > 0.45 && on(c, 0, 3)) out.push({ inst: "timpani", midi: into(c.root, 36, 48), vel: (c.step === 0 ? 0.55 : 0.35) + 0.3 * I, dur: 0.9 });
    // high string melody
    if (I > 0.58 && c.step % 4 === 0) {
      const m = motif(c, 69, 86, 0.45 + 0.35 * I);
      if (m) out.push({ inst: "violin", midi: m, vel: 0.35 + 0.35 * I, dur: c.stepDur * 4, pan: 0.35 });
    }
    // full pace: bass drum and cymbal swell every 4 bars
    if (I > 0.75 && on(c, 0, 8)) out.push({ inst: "drums_orch", midi: 36, vel: 0.45 + 0.3 * I, dur: 0.6 });
    if (I > 0.75 && c.step === 0 && c.bar % 4 === 0) out.push({ inst: "drums_orch", midi: 49, vel: 0.4, dur: 1.6, pan: -0.3 });
    return out;
  },
};

export const GENRES: Record<GenreId, GenreDef> = { classic, house, rock, pop, metal, hiphop, country, waltz, electro, anthem, darkrave, latino, gothic };
for (const [id, l] of Object.entries(LAYERED)) {
  const g = GENRES[id as GenreId];
  g.fixedBpm = l!.bpm;
  g.layers = l!.layers;
  g.mix = { ...l!.mix, ...g.mix };
}
export const GENRE_IDS = Object.keys(GENRES) as GenreId[];
/** Genres planned next - UI lists them as coming soon. */
export const UPCOMING_GENRES: readonly string[] = [];

export function accentNotes(g: GenreDef, kind: MusicAccent, stepDur: number): NoteSpec[] {
  const out: NoteSpec[] = [];
  if (kind === "upshift" || kind === "surge") {
    const [inst, notes] = g.accents.fill;
    // 16th fill across the beat, rising velocity, then crash on the following downbeat handled by caller
    for (let i = 0; i < 4; i++) out.push({ inst, midi: notes[i % notes.length]!, vel: 0.35 + 0.15 * i, dur: 0.3, offset: i });
  } else if (kind === "downshift") {
    const [inst, notes] = g.accents.low;
    notes.slice(0, 3).forEach((n, i) => out.push({ inst, midi: n, vel: 0.7 - 0.12 * i, dur: 0.8, offset: i * 1.5 }));
  }
  void stepDur;
  return out;
}

export function isGenreId(v: unknown): v is GenreId {
  return typeof v === "string" && v in GENRES;
}
