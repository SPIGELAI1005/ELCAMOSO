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
