import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { MotionFrame } from "@/lib/sound/realism/types";
import { createHoofLayer, createImpactLayer } from "@/lib/sound/dsp/layers";
import { roomImpulse, SIREN_IR_CHANNELS, SIREN_IR_SECONDS } from "@/lib/sound/dsp/siren-overlay";

function frame(partial: Partial<MotionFrame> = {}): MotionFrame {
  return {
    speedMps: 15, speedKmh: 54, speedSlow: 0.6, speedNorm: 0.5, accelMps2: 0, accelFast: 0.2,
    throttle: 0.4, throttleFast: 0.4, regen: 0, jerk: 0, virtualRpm: 0, rpmNorm: 0,
    gear: 0, gearNorm: 0, isShifting: false, shiftDip: 0, shiftProgress: 0,
    shiftDirection: null, revMatchActive: false, revMatchProgress: 0, overrun: false,
    drivingMode: "cruise", dynamicLayers: null, bodyLevel: 0.08, syntheticLoad: 0,
    engineFundamentalHz: 18, pitchTau: 0.1, stereoWidth: 0.55, dt: 1 / 60,
    raw: {} as MotionFrame["raw"],
    ...partial,
  } as MotionFrame;
}

function countPanners(build: (ctx: BaseAudioContext) => { update(m: MotionFrame, t: number): void }) {
  const ctx = new OfflineAudioContext(2, 48_000, 48_000);
  let panners = 0;
  const orig = ctx.createStereoPanner.bind(ctx);
  (ctx as unknown as { createStereoPanner: () => StereoPannerNode }).createStereoPanner = () => { panners++; return orig(); };
  const layer = build(ctx);
  for (let i = 0; i < 60 * 20; i++) layer.update(frame(), i / 60); // 20 s of strides
  return panners;
}

describe("audio glitch regressions (weak in-car CPUs)", () => {
  it("hoof layer reuses per-limb panners instead of one per strike", () => {
    const n = countPanners((ctx) => createHoofLayer(ctx, { id: "h", destination: ctx.destination, horses: 4, level: 0.3 }));
    expect(n).toBeLessThanOrEqual(1 + 4); // chain panner + 4 limbs, regardless of how many strikes fired
  });
  it("gravel impact layer uses a small shared panner pool", () => {
    const n = countPanners((ctx) => createImpactLayer(ctx, { id: "g", destination: ctx.destination, kind: "gravel", level: 0.18 }));
    expect(n).toBeLessThanOrEqual(1 + 9);
  });
  it("police siren room IR is short and mono", () => {
    expect(SIREN_IR_SECONDS).toBeLessThanOrEqual(0.6);
    expect(SIREN_IR_CHANNELS).toBe(1);
    const ir = roomImpulse(new OfflineAudioContext(2, 48_000, 48_000));
    expect(ir.numberOfChannels).toBe(1);
    expect(ir.duration).toBeLessThanOrEqual(0.6);
  });
  it("dracula haunting events are brought forward but stay below the clip-safe ceiling", () => {
    const src = readFileSync("src/lib/sound/realism/strategies.ts", "utf8");
    const block = src.slice(src.indexOf('id: "dracula-carriage"'), src.indexOf('id: "romanian-85-carriage"'));
    const lvl = (k: string) => Number(new RegExp(`kind: "${k}"[^}]*level: ([0-9.]+)`).exec(block)![1]);
    // Voice jump scares removed (v38); only gust + whip remain here.
    for (const k of ["gust", "whip"]) expect(lvl(k)).toBeGreaterThanOrEqual(0.1);
    for (const k of ["gust", "whip"]) expect(lvl(k)).toBeLessThanOrEqual(0.4);
    for (const k of ["cackle", "howl", "eerie", "scream"]) expect(block).not.toContain(`kind: "${k}"`);
  });
});
