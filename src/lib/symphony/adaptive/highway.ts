/**
 * Highway arrangements: above 90 km/h the base arrangement is at full energy and would just
 * loop. Each speed band (90 .. 220 km/h) gets its own arrangement stage, derived from the
 * genre's base pattern: some parts drop out, new lines come in (counter-melodies, arpeggios,
 * octave bass, pedals), drums swap feel (half-time, double-time, ride, sparse). Energy is
 * capped per stage so the volume does not keep climbing.
 *
 * Pure and deterministic. Stage changes are decided only on bar lines, with +/- hysteresis
 * and a minimum hold in bars, so hovering at a threshold never flip-flops.
 */
import type { GenreDef, GenreId, NoteSpec, StepContext } from "./genres";
import { MUSIC_BANK } from "./sample-bank-data";

export const HIGHWAY_THRESHOLDS = [90, 100, 110, 120, 130, 140, 150, 170, 180, 200, 220] as const;
export const HIGHWAY_HYSTERESIS_KMH = 3;
export const HIGHWAY_MIN_HOLD_BARS = 4;
/** While a stage is held, a sub-variation rotates every this many bars. */
export const HIGHWAY_ROTATE_BARS = 16;
export const HIGHWAY_SUBVARIATIONS = 3;

/** Stage for a speed with no history (0 = base arrangement, 1..11 = highway stages). */
export function rawHighwayStage(kmh: number): number {
  let s = 0;
  while (s < HIGHWAY_THRESHOLDS.length && kmh >= HIGHWAY_THRESHOLDS[s]!) s += 1;
  return s;
}

export function createHighwayTracker() {
  let stage = -1; // unknown until the first bar
  let heldBars = 0;
  let barsInStage = 0;
  return {
    /** Call once per bar line with the smoothed speed. Returns the stage for this bar. */
    onBar(kmh: number): number {
      if (stage < 0) {
        stage = rawHighwayStage(kmh);
        heldBars = HIGHWAY_MIN_HOLD_BARS;
        barsInStage = 0;
        return stage;
      }
      heldBars += 1;
      barsInStage += 1;
      if (heldBars < HIGHWAY_MIN_HOLD_BARS) return stage;
      let next = stage;
      // one stage per decision: smooth climbs, no skipping over a band in a single bar
      if (next < HIGHWAY_THRESHOLDS.length && kmh >= HIGHWAY_THRESHOLDS[next]! + HIGHWAY_HYSTERESIS_KMH) next += 1;
      else if (next > 0 && kmh < HIGHWAY_THRESHOLDS[next - 1]! - HIGHWAY_HYSTERESIS_KMH) next -= 1;
      if (next !== stage) {
        stage = next;
        heldBars = 0;
        barsInStage = 0;
      }
      return stage;
    },
    get stage() {
      return Math.max(0, stage);
    },
    /** Rotating sub-variation inside the held stage (long steady cruising). */
    get sub() {
      return Math.floor(barsInStage / HIGHWAY_ROTATE_BARS) % HIGHWAY_SUBVARIATIONS;
    },
    /** Bars since this stage started (0 on the entry bar). */
    get barsInStage() {
      return barsInStage;
    },
  };
}

export type Role = "drums" | "bass" | "pad" | "melody" | "comp";
export type DrumFeel = "normal" | "half" | "double" | "sparse" | "ride" | "four";
export type NewLine = "counter" | "arp" | "octbass" | "pedal" | "answer" | "shaker";

export interface HighwayRecipe {
  name: string;
  drop: readonly Role[];
  /** roles reduced to downbeats only */
  thin: readonly Role[];
  drums: DrumFeel;
  add: readonly NewLine[];
  /** energy cap fed to the genre pattern (keeps level from climbing) */
  energy: number;
  /** brightness offset for the master low-pass (filter moves) */
  bright: number;
  /** velocity trim on the whole stage */
  trim: number;
}

/** Stage 1..11 recipes (index 0 = 90 km/h). Energy waves instead of climbing. */
export const HIGHWAY_RECIPES: readonly HighwayRecipe[] = [
  { name: "Lift", drop: ["pad"], thin: [], drums: "normal", add: ["counter"], energy: 0.7, bright: 0.04, trim: 0.96 },
  { name: "Open road", drop: [], thin: ["comp"], drums: "ride", add: ["arp"], energy: 0.66, bright: 0.0, trim: 0.95 },
  { name: "Double time", drop: ["melody"], thin: [], drums: "double", add: ["counter", "octbass"], energy: 0.68, bright: 0.02, trim: 0.92 },
  { name: "Half time", drop: ["comp"], thin: [], drums: "half", add: ["pedal", "counter"], energy: 0.6, bright: -0.06, trim: 0.96 },
  { name: "Cruise groove", drop: ["pad"], thin: ["melody"], drums: "four", add: ["shaker", "arp"], energy: 0.64, bright: 0.0, trim: 0.94 },
  { name: "Night filter", drop: ["melody"], thin: ["comp"], drums: "normal", add: ["octbass", "pedal"], energy: 0.62, bright: -0.12, trim: 0.96 },
  { name: "Call and answer", drop: [], thin: [], drums: "ride", add: ["answer"], energy: 0.68, bright: 0.04, trim: 0.92 },
  { name: "Breakdown", drop: ["bass", "comp"], thin: ["drums"], drums: "sparse", add: ["pedal", "counter"], energy: 0.52, bright: 0.06, trim: 1.0 },
  { name: "Drive", drop: ["pad"], thin: ["comp"], drums: "double", add: ["arp", "octbass"], energy: 0.7, bright: 0.0, trim: 0.9 },
  { name: "Anthem", drop: [], thin: ["comp"], drums: "four", add: ["counter", "shaker"], energy: 0.72, bright: 0.06, trim: 0.9 },
  { name: "Finale", drop: ["melody"], thin: [], drums: "normal", add: ["answer", "arp", "pedal"], energy: 0.7, bright: 0.04, trim: 0.88 },
];

const DRUM = /^drums_/;
const BASS = new Set(["synthbass", "ebass", "pbass", "contrabass", "electrobass", "electrosub", "cello"]);
const PAD = new Set(["pad", "strings", "choir", "organ", "rockorgan", "horn"]);
const MELODY = new Set(["lead", "violin", "square", "electrolead", "trumpet", "sax", "flute", "rocklead", "glock", "leadgtr", "oboe", "clarinet", "brass"]);

export function roleOf(inst: string): Role {
  if (DRUM.test(inst) || inst === "timpani") return "drums";
  if (BASS.has(inst)) return "bass";
  if (PAD.has(inst)) return "pad";
  if (MELODY.has(inst)) return "melody";
  return "comp";
}

/** Per-genre preferred voices for the new lines (all already in the genre's mix). */
const VOICES: Partial<Record<GenreId, { lines: string[]; pad?: string }>> = {
  latino: { lines: ["trumpet", "nylon", "piano"], pad: "pad" },
  anthem: { lines: ["trumpet", "piano", "cleangtr", "rocklead"], pad: "rockorgan" },
  house: { lines: ["polysynth", "lead"], pad: "pad" },
  hiphop: { lines: ["piano", "square", "stab"], pad: "strings" },
  jazz: { lines: ["sax", "epiano", "piano"], pad: "pad" },
  electro: { lines: ["electrolead"], pad: "pad" },
  gothic: { lines: ["violin", "organ"], pad: "choir" },
};

export interface GenreHighwayKit {
  lines: string[];
  pad: string | null;
  bass: string | null;
  drums: string | null;
}

export function highwayKit(g: GenreDef): GenreHighwayKit {
  const insts = Object.keys(g.mix).filter((i) => i in MUSIC_BANK);
  const pick = (r: Role) => insts.filter((i) => roleOf(i) === r && i !== "timpani");
  const v = VOICES[g.id];
  const lines = (v?.lines ?? [...pick("melody"), ...pick("comp").filter((i) => i !== "scratch")]).filter((i) => insts.includes(i));
  return {
    lines: lines.length ? lines : insts.filter((i) => roleOf(i) !== "drums").slice(0, 1),
    pad: v?.pad && insts.includes(v.pad) ? v.pad : pick("pad")[0] ?? null,
    bass: pick("bass").find((b) => b !== "cello") ?? pick("bass")[0] ?? null,
    drums: insts.find((i) => DRUM.test(i)) ?? null,
  };
}

function hash(...n: number[]) {
  let h = 2166136261;
  for (const x of n) h = Math.imul(h ^ (x | 0), 16777619) >>> 0;
  h ^= h >>> 13;
  return (Math.imul(h, 1274126177) >>> 0) / 4294967296;
}

function fit(midi: number, inst: string, lo?: number, hi?: number) {
  const notes = MUSIC_BANK[inst]?.notes ?? [48, 84];
  const a = Math.max(lo ?? -Infinity, notes[0]! + 3);
  const b = Math.min(hi ?? Infinity, notes[notes.length - 1]! - 3);
  let m = midi;
  while (m < a) m += 12;
  while (m > b && m - 12 >= a) m -= 12;
  return m;
}

function kitHas(drums: string, n: number) {
  return MUSIC_BANK[drums]?.notes.includes(n) ?? false;
}
const isKick = (m: number) => m === 35 || m === 36;
const isSnare = (m: number) => m === 37 || m === 38 || m === 39 || m === 40;
const isHat = (m: number) => m === 42 || m === 44 || m === 46 || m === 51;

export interface HighwayContext extends StepContext {
  stage: number;
  sub: number;
  barsInStage: number;
  stepsPerBar: number;
}

/** The energy the genre pattern sees at this stage (never above the stage cap). */
export function highwayEnergy(stage: number, intensity: number, surging: boolean): number {
  if (stage <= 0) return intensity;
  const cap = HIGHWAY_RECIPES[stage - 1]!.energy + (surging ? 0.12 : 0);
  return Math.min(intensity, cap);
}

export function highwayBrightness(stage: number): number {
  return stage <= 0 ? 0 : HIGHWAY_RECIPES[stage - 1]!.bright;
}

/** Reshape one step of the base arrangement for the stage, and add the stage's new lines. */
export function arrangeHighway(g: GenreDef, c: HighwayContext, base: NoteSpec[], kit = highwayKit(g)): NoteSpec[] {
  if (c.stage <= 0) return base;
  const r = HIGHWAY_RECIPES[c.stage - 1]!;
  const spb = c.stepsPerBar;
  const beat = spb === 12 ? 4 : 4;
  const half = spb / 2;
  // sub-variations: 1 also brings the dropped pad back, 2 thins the comp
  const drop = new Set<Role>(r.drop);
  const thin = new Set<Role>(r.thin);
  if (c.sub === 1) drop.delete("pad");
  if (c.sub === 2 && !drop.has("comp")) thin.add("comp");
  // entry bar fades new material in
  const entry = c.barsInStage === 0 ? 0.75 : 1;
  const out: NoteSpec[] = [];
  for (const n of base) {
    const role = roleOf(n.inst);
    if (drop.has(role)) continue;
    if (thin.has(role) && role !== "drums" && c.step % (spb === 12 ? 4 : 8) !== 0) continue;
    if (role === "drums" && DRUM.test(n.inst)) {
      const m = n.midi;
      if (r.drums === "half" && isSnare(m) && c.step !== half) continue;
      if (r.drums === "half" && isKick(m) && c.step !== 0 && c.step !== half + 2) continue;
      if (r.drums === "sparse" && !(isKick(m) && c.step === 0) && !(isHat(m) && c.step % beat === 0)) continue;
      if (r.drums === "ride" && isHat(m)) {
        if (c.step % 2 === 1) continue;
        out.push({ ...n, midi: kitHas(n.inst, 51) ? 51 : m, vel: n.vel * 0.9 * r.trim });
        continue;
      }
      if (thin.has("drums") && isSnare(m)) continue;
    }
    out.push({ ...n, vel: n.vel * r.trim });
  }
  const I = Math.min(c.intensity, r.energy);
  const vBase = (0.34 + 0.3 * I) * entry;
  // drum feel additions
  if (kit.drums) {
    const d = kit.drums;
    if (r.drums === "double" && c.step % 2 === 1 && kitHas(d, 42)) out.push({ inst: d, midi: 42, vel: 0.22 + 0.12 * I, dur: 0.12, pan: -0.25 });
    if (r.drums === "four" && c.step % beat === 0 && c.step !== 0 && kitHas(d, 36)) out.push({ inst: d, midi: 36, vel: 0.5 + 0.2 * I, dur: 0.4 });
    if (r.drums === "half" && c.step === half && kitHas(d, 38)) out.push({ inst: d, midi: 38, vel: 0.55 + 0.2 * I, dur: 0.5 });
  }
  if (r.add.includes("shaker") && kit.drums) {
    const shk = kitHas(kit.drums, 70) ? 70 : kitHas(kit.drums, 44) ? 44 : 42;
    if (c.step % 2 === 1) out.push({ inst: kit.drums, midi: shk, vel: (0.16 + 0.1 * (c.step % 4 === 3 ? 1 : 0)) * entry, dur: 0.1, pan: 0.45 });
  }
  const line = (k: number) => kit.lines[(c.stage + c.sub + k) % kit.lines.length]!;
  const tones = [...c.chord, c.chord[0]! + 12];
  // counter-melody: syncopated 8ths, new contour per stage/sub, repeats per 2-bar phrase
  if (r.add.includes("counter") && kit.lines.length) {
    const inst = line(0);
    const ph = c.bar % 2;
    const rhythm = hash(c.stage, c.sub, ph, c.step, g.key);
    if (c.step % 2 === 0 && rhythm < 0.42) {
      const idx = Math.floor(hash(c.stage, c.sub, ph, c.step, 7) * tones.length);
      out.push({ inst, midi: fit(tones[idx]! + 12, inst, 62, 86), vel: vBase * 0.95, dur: c.stepDur * 3, pan: 0.35 });
    }
  }
  // answer: phrase on odd bars only, replying to the main melody
  if (r.add.includes("answer") && kit.lines.length && c.bar % 2 === 1 && c.step >= half) {
    const inst = line(1);
    if (c.step % 2 === 0 && hash(c.stage, c.sub, c.step, 3) < 0.7) {
      const idx = Math.floor(hash(c.stage, c.sub, c.step, 11) * tones.length);
      out.push({ inst, midi: fit(tones[idx]! + 12, inst, 64, 86), vel: vBase, dur: c.stepDur * 2.2, pan: -0.35 });
    }
  }
  // arpeggio: chord tones in 16ths (8ths on sub 1), up or down by sub
  if (r.add.includes("arp") && kit.lines.length) {
    const inst = line(2);
    const every = c.sub === 1 ? 2 : 1;
    if (c.step % every === 0) {
      const seq = c.sub === 2 ? [3, 2, 1, 0, 2, 1] : [0, 1, 2, 3, 2, 1];
      const t = tones[seq[(c.step / every) % seq.length]! % tones.length]!;
      out.push({ inst, midi: fit(t + 12, inst, 60, 84), vel: vBase * 0.72, dur: c.stepDur * every * 1.1, pan: c.step % 4 < 2 ? -0.3 : 0.3 });
    }
  }
  // octave bass pulse on the offbeat 8ths
  if (r.add.includes("octbass") && kit.bass && !drop.has("bass") && c.step % 4 === 2) {
    out.push({ inst: kit.bass, midi: fit(c.root + 12, kit.bass, 33, 55), vel: vBase * 0.85, dur: c.stepDur * 1.4 });
  }
  // pedal: sustained root + fifth for 2 bars, new floor under the stage
  if (r.add.includes("pedal") && kit.pad && c.step === 0 && c.bar % 2 === 0) {
    for (const iv of [0, 7]) out.push({ inst: kit.pad, midi: fit(c.root + iv, kit.pad, 48, 67), vel: vBase * 0.8, dur: c.barDur * 2.02, pan: iv ? 0.3 : -0.3 });
  }
  return out;
}
