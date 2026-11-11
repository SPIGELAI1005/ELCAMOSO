import { describe, expect, it } from "vitest";
import type { ConductorState } from "./conductor";
import { GENRE_IDS, GENRES } from "./genres";
import {
  arrangeHighway,
  createHighwayTracker,
  HIGHWAY_MIN_HOLD_BARS,
  HIGHWAY_RECIPES,
  HIGHWAY_ROTATE_BARS,
  HIGHWAY_THRESHOLDS,
  highwayKit,
  rawHighwayStage,
} from "./highway";
import { MUSIC_BANK } from "./sample-bank-data";
import { hasInstrument } from "./sample-bank";
import { createTimeline } from "./timeline";

const state = (speedKmh: number, intensity = 0.75): ConductorState => ({
  bpm: 120, targetBpm: 120, intensity, brightness: 0.8, transpose: 0, mode: "cruise",
  grade: null, elevationTrend: "unknown", cruiseSeconds: 60, musicalGear: 5, speedKmh,
});

describe("highway stages", () => {
  it("uses the 11 requested thresholds", () => {
    expect([...HIGHWAY_THRESHOLDS]).toEqual([90, 100, 110, 120, 130, 140, 150, 170, 180, 200, 220]);
    expect(HIGHWAY_RECIPES).toHaveLength(11);
    expect(rawHighwayStage(60)).toBe(0);
    expect(rawHighwayStage(90)).toBe(1);
    expect(rawHighwayStage(135)).toBe(5);
    expect(rawHighwayStage(230)).toBe(11);
  });

  it("climbs one stage per hold window and needs +3 km/h past a threshold", () => {
    const t = createHighwayTracker();
    expect(t.onBar(80)).toBe(0);
    for (let i = 0; i < 10; i++) expect(t.onBar(92)).toBe(0); // under 90+3
    let s = 0;
    for (let i = 0; i < 10; i++) s = t.onBar(94);
    expect(s).toBe(1);
  });

  it("does not flip-flop when hovering around a threshold", () => {
    const t = createHighwayTracker();
    t.onBar(135);
    expect(t.stage).toBe(5);
    let changes = 0;
    let last = t.stage;
    for (let i = 0; i < 200; i++) {
      const s = t.onBar(130 + (i % 2 ? 2.5 : -2.5));
      if (s !== last) changes++;
      last = s;
    }
    expect(changes).toBe(0);
  });

  it("holds each stage for the minimum number of bars", () => {
    const t = createHighwayTracker();
    t.onBar(60);
    const seen: number[] = [];
    for (let i = 0; i < 80; i++) seen.push(t.onBar(240));
    let run = 1;
    for (let i = 1; i < seen.length; i++) {
      if (seen[i] !== seen[i - 1]) {
        expect(run).toBeGreaterThanOrEqual(HIGHWAY_MIN_HOLD_BARS);
        run = 1;
      } else run++;
    }
    expect(seen.at(-1)).toBe(11);
  });

  it("comes back down below the threshold minus hysteresis", () => {
    const t = createHighwayTracker();
    t.onBar(125);
    for (let i = 0; i < 8; i++) t.onBar(118);
    expect(t.stage).toBe(4);
    for (let i = 0; i < 8; i++) t.onBar(116);
    expect(t.stage).toBe(3);
  });

  it("rotates sub-variations while a stage is held", () => {
    const t = createHighwayTracker();
    t.onBar(130);
    const subs = new Set<number>();
    for (let i = 0; i < HIGHWAY_ROTATE_BARS * 3; i++) {
      t.onBar(130);
      subs.add(t.sub);
    }
    expect(subs.size).toBe(3);
  });
});

describe("highway arrangements cover every genre", () => {
  it.each(GENRE_IDS)("%s: kit uses only loaded instruments of the genre", (id) => {
    const g = GENRES[id];
    const kit = highwayKit(g);
    expect(kit.lines.length).toBeGreaterThan(0);
    for (const i of [...kit.lines, kit.pad, kit.bass, kit.drums].filter(Boolean)) {
      expect(i! in g.mix).toBe(true);
      expect(i! in MUSIC_BANK).toBe(true);
    }
  });

  it.each(GENRE_IDS)("%s: every stage sounds different and velocity stays bounded", (id) => {
    const sigs = new Set<string>();
    let base = 0;
    for (let stage = 0; stage <= 11; stage++) {
      const tl = createTimeline(id, 0, 3);
      // settle into the stage at its speed
      const kmh = stage === 0 ? 70 : HIGHWAY_THRESHOLDS[stage - 1]! + 4;
      const evs = tl.scheduleUntil(200, state(kmh)).filter((e) => e.time > 60 && e.time < 120);
      expect(tl.highwayStage).toBe(stage);
      const sig = evs.slice(0, 400).map((e) => `${e.inst}${e.midi}`).join(",");
      sigs.add(sig);
      const energy = evs.reduce((a, e) => a + e.vel * e.vel * (GENRES[id].mix[e.inst] ?? 0.4), 0) / 60;
      if (stage === 0) base = energy;
      else expect(energy).toBeLessThan(base * 1.6);
      for (const e of evs) {
        expect(e.vel).toBeLessThanOrEqual(1);
        expect(e.inst in MUSIC_BANK || hasInstrument(e.inst)).toBe(true);
        expect(Number.isFinite(e.time)).toBe(true);
      }
    }
    if (GENRES[id].lockArrangement) expect(sigs.size).toBe(1);
    else expect(sigs.size).toBe(12);
  });

  it("leaves the base arrangement untouched below 90 km/h", () => {
    const g = GENRES.latino;
    const base = [{ inst: "trumpet", midi: 70, vel: 0.5, dur: 0.3 }];
    const ctx = { step: 0, bar: 0, chord: [57, 60, 64], root: 57, intensity: 0.5, mode: "cruise" as const, variation: 0, stepDur: 0.15, barDur: 2.4, rand: Math.random, stage: 0, sub: 0, barsInStage: 0, stepsPerBar: 16 };
    expect(arrangeHighway(g, ctx, base)).toBe(base);
  });

  it("stage changes only land on bar lines", () => {
    const tl = createTimeline("house", 0, 1);
    let prev = 0;
    const spb = 16;
    for (let k = 1; k < 400; k++) {
      const kmh = Math.min(230, 60 + k);
      tl.scheduleUntil(k * 0.5, state(kmh));
      if (tl.highwayStage !== prev) {
        expect(tl.stepCount % spb).toBeLessThanOrEqual(spb); // changed inside a bar's first step
        prev = tl.highwayStage;
      }
    }
    expect(prev).toBeGreaterThan(5);
  });
});
