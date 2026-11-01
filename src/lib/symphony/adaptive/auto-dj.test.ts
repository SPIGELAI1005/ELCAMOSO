import { describe, expect, it } from "vitest";
import { autoDjPool, crossfadeBars, equalPowerCurves, genreTempo, nextAutoDjDelay, pickNextGenre } from "./auto-dj";
import { createTimeline } from "./timeline";
import { GENRES, diatonic, latinoSolo, type GenreId } from "./genres";
import { isAutoDj } from "./genre-store";
import type { ConductorState } from "./conductor";

describe("auto dj choice", () => {
  it("picks a near-tempo genre and avoids recent repeats", () => {
    const pool = autoDjPool();
    expect(pool).not.toContain("waltz");
    for (let i = 0; i < 40; i++) {
      const r = i / 40;
      const next = pickNextGenre("house", 124, ["pop", "house"], () => r);
      expect(next).not.toBe("house");
      expect(next).not.toBe("pop");
      const dists = pool.filter((id) => id !== "house" && id !== "pop").map((id) => Math.abs(genreTempo(id, 124) - 124)).sort((a, b) => a - b);
      expect(Math.abs(genreTempo(next, 124) - 124)).toBeLessThanOrEqual(dists[2]!);
    }
  });

  it("switches every 2-3 minutes with a 4-8 s bar-aligned crossfade", () => {
    for (const r of [0, 0.5, 0.999]) {
      const d = nextAutoDjDelay(() => r);
      expect(d).toBeGreaterThanOrEqual(120);
      expect(d).toBeLessThanOrEqual(180);
    }
    for (const bpm of [70, 96, 110, 128, 140]) {
      const barDur = (60 / bpm) * 4;
      const D = crossfadeBars(barDur) * barDur;
      expect(D).toBeGreaterThanOrEqual(3.4);
      expect(D).toBeLessThanOrEqual(8.01);
    }
  });

  it("uses equal-power curves", () => {
    const c = equalPowerCurves(33);
    for (let i = 0; i < 33; i++) expect(c.out[i]! ** 2 + c.in[i]! ** 2).toBeCloseTo(1, 5);
    expect(c.out[0]).toBe(1);
    expect(c.in[32]).toBe(1);
  });

  it("only drives non-signature profiles on the auto choice", () => {
    expect(isAutoDj("symphony-neon-run", "auto")).toBe(true);
    expect(isAutoDj("symphony-neon-run", "house")).toBe(false);
    expect(isAutoDj("symphony-latino-fiesta", "auto")).toBe(false);
  });
});

describe("timeline tempo ride + hand-off", () => {
  const st = (bpm: number): ConductorState => ({ bpm, intensity: 0.6, mode: "cruise", transpose: 0, brightness: 0.5 } as unknown as ConductorState);
  it("glides toward the target tempo and reports the bar line", () => {
    const tl = createTimeline("house" as GenreId, 0, 1);
    tl.scheduleUntil(1, st(124));
    tl.rampTempo(100);
    tl.requestHandoff(2);
    let h = null;
    let prev = tl.bpm;
    for (let t = 1; t < 30 && !h; t += 0.25) {
      tl.scheduleUntil(t, st(124));
      expect(Math.abs(tl.bpm - prev)).toBeLessThanOrEqual(0.4 * 8 + 1e-9);
      prev = tl.bpm;
      h = tl.takeHandoff();
    }
    expect(h).not.toBeNull();
    expect(tl.bar).toBeGreaterThanOrEqual(2);
    expect(h!.bpm).toBeLessThan(124);
  });
});

describe("latino trumpet section", () => {
  it("plays the melody on trumpet with diatonic 3rd/6th harmony, players slightly apart", () => {
    const keyA = 69;
    expect(diatonic(keyA, 76, -2)).toBe(72); // E -> C (3rd below)
    expect(diatonic(keyA, 76, -5)).toBe(67); // E -> G (6th below)
    expect(diatonic(keyA + 2, 78, -2)).toBe(74); // follows the key lift
    const g = GENRES.latino;
    const notes = [];
    for (let step = 0; step < 16; step++)
      notes.push(...latinoSolo({ step, bar: 4, chord: [57, 60, 64], root: 45, intensity: 0.9, mode: "cruise", variation: 0, stepDur: 0.156, barDur: 2.5, rand: Math.random }));
    expect(notes.every((n) => n.inst === "trumpet")).toBe(true);
    expect(notes.some((n) => (n.detune ?? 0) !== 0 && (n.offset ?? 0) > 0)).toBe(true);
    expect(g.mix.trumpet).toBeDefined();
    expect(g.mix.nylon).toBeLessThan(g.mix.trumpet! + 0.01);
  });
});
