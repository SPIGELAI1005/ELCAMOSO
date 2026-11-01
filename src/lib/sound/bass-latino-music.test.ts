import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import { createDrumKit, scheduleDrumBeat } from "@/lib/sound/dsp/layers-extra";
import { latinoSolo } from "@/lib/symphony/adaptive/genres";

function hitsPerBar(speed: number) {
  const ctx = new OfflineAudioContext(2, 48_000, 48_000);
  const kit = createDrumKit(ctx, ctx.destination);
  let n = 0;
  for (let b = 0; b < 4; b++) n += scheduleDrumBeat(kit, b * 0.5, 0.5, b * 2, speed, speed, 0.78);
  return n;
}

describe("deep-bass-pulse drums", () => {
  it("drum density follows speed: kick only parked, clap + hats rolling, 16th hats fast", () => {
    expect(hitsPerBar(0)).toBe(2);
    const mid = hitsPerBar(0.4), fast = hitsPerBar(1);
    expect(mid).toBeGreaterThan(2);
    expect(fast).toBeGreaterThan(mid);
    expect(fast).toBeLessThanOrEqual(24); // one buffer source per hit, bounded
  });
});

describe("latino fiesta nylon solo", () => {
  const ctx = (bar: number, step: number, intensity: number) =>
    ({ step, bar, chord: [57, 60, 64], root: 57, intensity, mode: "cruise", variation: 0, stepDur: 0.156, barDur: 2.5, rand: Math.random }) as never;
  const notesOver = (I: number) => { let n = 0; for (let bar = 0; bar < 8; bar++) for (let s = 0; s < 16; s++) n += latinoSolo(ctx(bar, s, I)).length; return n; };
  it("is silent when parked/slow and grows with speed", () => {
    expect(notesOver(0.1)).toBe(0);
    expect(notesOver(0.3)).toBeGreaterThan(0);
    expect(notesOver(0.9)).toBeGreaterThan(notesOver(0.3));
  });
  it("phrases come and go: always rests for part of each 8-bar cycle", () => {
    for (const bar of [0, 1]) for (let s = 0; s < 16; s++) expect(latinoSolo(ctx(bar, s, 1))).toEqual([]);
  });
  it("uses the licence-clean sampled nylon voice", () => {
    for (let s = 0; s < 16; s++) for (const n of latinoSolo(ctx(2, s, 0.8))) expect(n.inst).toBe("nylon");
  });
});

describe("latino fiesta nylon solo v36: melodic and in key", () => {
  const prog = [[45, [57, 60, 64]], [53, [53, 57, 60]], [48, [48, 52, 55]], [55, [55, 59, 62]]] as const;
  const ctx = (bar: number, step: number, I: number, tr = 0) => {
    const [root, chord] = prog[bar % 4]!;
    return { step, bar, chord: chord.map((n) => n + tr), root: root + tr, intensity: I, mode: "cruise", variation: 0, stepDur: 0.156, barDur: 2.5, rand: Math.random } as never;
  };
  const AMIN = new Set([0, 2, 3, 5, 7, 8, 10]); // A natural minor pitch classes from A
  it("stays diatonic, in the E4..G5 nylon range, and lands chord tones on the beats", () => {
    for (let bar = 0; bar < 16; bar++) for (let s = 0; s < 16; s++) for (const n of latinoSolo(ctx(bar, s, 0.6)) as { midi: number }[]) {
      expect(AMIN.has((n.midi - 69 + 120) % 12)).toBe(true);
      expect(n.midi).toBeGreaterThanOrEqual(64);
      expect(n.midi).toBeLessThanOrEqual(79);
      if (s % 4 === 0) expect(prog[bar % 4]![1].map((t) => t % 12)).toContain(n.midi % 12);
    }
  });
  it("follows the conductor's climb transpose", () => {
    const a = latinoSolo(ctx(4, 0, 0.6)) as { midi: number }[], b = latinoSolo(ctx(4, 0, 0.6, 2)) as { midi: number }[];
    expect(b[0]!.midi - a[0]!.midi).toBe(2);
  });
  it("repeats the motif (A and A' share their first two bars)", () => {
    const bars = (b: number) => Array.from({ length: 16 }, (_, s) => (latinoSolo(ctx(b, s, 0.6)) as { midi: number }[]).map((n) => n.midi)).flat();
    expect(bars(4)).toEqual(bars(12));
    expect(bars(6)).not.toEqual(bars(14));
  });
});

import { hiphopLoop } from "@/lib/symphony/adaptive/genres";
describe("hip-hop dark loop", () => {
  const prog = [[41, [41, 44, 48, 51]], [41, [41, 44, 48, 51]], [49, [49, 53, 56, 60]], [48, [48, 51, 55, 58]]] as const;
  const ctx = (bar: number, step: number, I: number) => ({ step, bar, chord: prog[bar % 4]![1], root: prog[bar % 4]![0], intensity: I, mode: "cruise", variation: 0, stepDur: 0.17, barDur: 2.7, rand: Math.random }) as never;
  const FMIN = new Set([0, 2, 3, 5, 7, 8, 10, 11]); // F minor + raised leading tone
  it("is in F minor, in the piano mid range, and grows with speed", () => {
    let slow = 0, fast = 0;
    for (let bar = 0; bar < 4; bar++) for (let s = 0; s < 16; s++) {
      for (const n of hiphopLoop(ctx(bar, s, 0.2)) as { midi: number }[]) { slow++; expect(FMIN.has((n.midi - 65 + 120) % 12)).toBe(true); expect(n.midi).toBeGreaterThanOrEqual(63); expect(n.midi).toBeLessThanOrEqual(77); }
      fast += hiphopLoop(ctx(bar, s, 0.8)).length;
    }
    expect(slow).toBeGreaterThan(12);
    expect(fast).toBeGreaterThan(slow);
  });
});
