import "@/test-utils/install-web-audio";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SoundEngine } from "@/lib/sound/engine";
import { engineLayerStackFor } from "@/lib/sound/engine-layers";
import { getProfile } from "@/lib/sound/profiles";
import bank from "./coyote-v2-bank.json";
import {
  blendCoyoteLoopSeams,
  COYOTE_BANK_URL,
  COYOTE_LOOPS,
  COYOTE_ONESHOTS,
  COYOTE_RPM_POINTS,
  coyoteLoadTargets,
  coyoteLoopFor,
  coyoteLoopRate,
  coyotePopCount,
  coyoteRpmWeights,
  COYOTE_ALIGNED_FROM_RPM,
  coyoteAlignedOffset,
  coyoteHeelToeEnvelope,
  coyotePointAligned,
  coyoteGapCorrelation,
} from "./model";
import { CoyoteCrankClock, isCoyoteV8ProfileId } from "./coyote-synth";

const ROOT = process.cwd();

describe("Coyote V8 loop bank (American Muscle V8 v2)", () => {
  it("ships one compact m4a bank that the service worker precaches", () => {
    const file = join(ROOT, "public", COYOTE_BANK_URL);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(800 * 1024);
    const sw = readFileSync(join(ROOT, "public/sw.js"), "utf8");
    expect(sw).toContain(COYOTE_BANK_URL);
  });

  it("stores every loop as a whole number of 4-stroke cycles at its RPM", () => {
    expect(COYOTE_LOOPS.length).toBe(32);
    expect(bank.loops.length).toBe(32);
    for (const loop of bank.loops) {
      const seconds = loop.frames / bank.sampleRate;
      const cycleS = 120 / loop.rpm;
      expect(loop.cycles).toBeGreaterThanOrEqual(1);
      expect(Math.abs(seconds - loop.cycles * cycleS)).toBeLessThan(1 / bank.sampleRate + 1e-6);
      expect(loop.end - loop.start).toBeCloseTo(seconds, 6);
      expect(loop.start).toBeGreaterThanOrEqual(0.09); // margin holds the tail copy
      // peakDb is pre file gain; the stored file is normalised below -1 dBFS
      expect(loop.peakDb + bank.fileGainDb).toBeLessThan(-1);
    }
  });

  it("covers idle to 7k with small pitch-correction steps and all three load sets", () => {
    expect(COYOTE_RPM_POINTS[0]).toBe(700);
    expect(COYOTE_RPM_POINTS[COYOTE_RPM_POINTS.length - 1]).toBe(7000);
    for (let i = 1; i < COYOTE_RPM_POINTS.length; i += 1) {
      expect(COYOTE_RPM_POINTS[i]! / COYOTE_RPM_POINTS[i - 1]!).toBeLessThanOrEqual(1.36);
      for (const load of ["light", "on", "over"] as const) {
        expect(coyoteLoopFor(i, load)?.load).toBe(load);
      }
    }
    // no overrun loop at idle: falls back to light
    expect(coyoteLoopFor(0, "over")?.load).toBe("light");
  });

  it("has the one-shots the spec needs, none hotter than the loops", () => {
    const ids = COYOTE_ONESHOTS.map((o) => o.id);
    for (const id of [
      "startup",
      "bark",
      "blip1",
      "blip2",
      "pop1",
      "pop2",
      "pop3",
      "crackle1",
      "crackle2",
      "crackle3",
    ]) {
      expect(ids).toContain(id);
    }
    // v2.4: the struck-metal gearbox shots and the engine-render upshifts are gone (the
    // shift is the Racing V10's runtime choreography now)
    for (const id of ["gear_out", "gear_in1", "gear_in2", "upshift1", "upshift2"]) {
      expect(ids).not.toContain(id);
    }
    const loudestLoop = Math.max(...bank.loops.map((l) => l.peakDb));
    for (const o of bank.oneshots) expect(o.peakDb).toBeLessThanOrEqual(loudestLoop + 0.01);
  });

  it("crossfades idle points with equal power and aligned points coherently (sum 1)", () => {
    for (const rpm of [500, 700, 820, 1100, 1500, 3000, 3800, 4800, 6600, 7000, 9000]) {
      const w = coyoteRpmWeights(rpm);
      expect(w.length).toBeGreaterThanOrEqual(1);
      expect(w.length).toBeLessThanOrEqual(2);
      const coherent = w.length === 2 && w.every((p) => coyotePointAligned(p.index));
      const rho = coherent ? coyoteGapCorrelation(w[0]!.index) : 0;
      const total =
        w.reduce((s, p) => s + p.weight * p.weight, 0) +
        (coherent ? 2 * rho * w[0]!.weight * w[1]!.weight : 0);
      expect(total).toBeCloseTo(1, 6);
      if (coherent) expect(rho).toBeGreaterThan(0.3);
      for (const p of w) {
        const rate = coyoteLoopRate(
          Math.min(7000, Math.max(700, rpm)),
          COYOTE_RPM_POINTS[p.index]!,
        );
        expect(rate).toBeGreaterThan(0.72);
        expect(rate).toBeLessThan(1.37);
      }
    }
    // aligned crossfade has no corner at a grid point: tiny step away -> tiny weight change
    const near = coyoteRpmWeights(3450 * 1.01);
    expect(near.find((p) => COYOTE_RPM_POINTS[p.index] === 3450)!.weight).toBeGreaterThan(0.99);
    expect(coyoteRpmWeights(2150)).toEqual([{ index: 4, weight: 1 }]);
  });

  it("keeps idle points unaligned and makes every point from 1250 rpm crank-alignable", () => {
    expect(COYOTE_ALIGNED_FROM_RPM).toBe(1250);
    expect(coyotePointAligned(0)).toBe(false);
    expect(coyotePointAligned(1)).toBe(false);
    for (let i = 2; i < COYOTE_RPM_POINTS.length; i += 1) expect(coyotePointAligned(i)).toBe(true);
    for (const loop of bank.loops) {
      if (loop.rpmNominal < 1250) continue;
      // one shared 16-cycle variation sequence: every aligned loop holds whole repeats of it
      expect(loop.cycles % bank.varPeriod).toBe(0);
    }
    // the loads of one point are the same length (phase-aligned morph)
    for (const rpm of COYOTE_RPM_POINTS) {
      const frames = new Set(bank.loops.filter((l) => l.rpmNominal === rpm).map((l) => l.frames));
      expect(frames.size).toBe(1);
    }
    const loop = coyoteLoopFor(6, "light")!;
    const len = loop.end - loop.start;
    expect(coyoteAlignedOffset(loop, 0)).toBe(0);
    expect(coyoteAlignedOffset(loop, loop.cycles + 0.5)).toBeCloseTo((0.5 / loop.cycles) * len, 9);
    expect(coyoteAlignedOffset(loop, -0.25)).toBeCloseTo(
      ((loop.cycles - 0.25) / loop.cycles) * len,
      9,
    );
  });

  it("crank clock sums the same k-rate staircase the browser plays (aligned starts)", () => {
    const sr = 48000;
    const q = 128 / sr;
    const clock = new CoyoteCrankClock(800, 0, sr);
    const tau = 0.025;
    // glides requested mid-quantum are snapped to the next quantum boundary
    expect(clock.snap(0.1)).toBeCloseTo(Math.ceil(0.1 / q) * q, 12);
    clock.glide(0.1, 3000, tau);
    clock.glide(0.13, 4200, tau);
    // reference: per-quantum k-rate playback (value held for each 128-frame quantum)
    let v = 800;
    let target = 800;
    let cycles = 0;
    const e1 = Math.ceil(0.1 / q - 1e-6);
    const e2 = Math.ceil(0.13 / q - 1e-6);
    const end = Math.ceil(0.5 / q - 1e-6);
    for (let k = 0; k < end; k += 1) {
      // advance the running curve to quantum k, then a glide may start from that value
      if (k > 0) v = target + (v - target) * Math.exp(-q / tau);
      if (k === e1) target = 3000;
      if (k === e2) target = 4200;
      cycles += (v / 120) * q;
    }
    expect(clock.cycles(0.5)).toBeCloseTo(cycles, 6);
    expect(clock.value(0.5)).toBeCloseTo(4200, 1);
  });

  it("heel-and-toe blip envelope: quick rise, smooth fall, gone after a second", () => {
    expect(coyoteHeelToeEnvelope(0)).toBe(0);
    expect(coyoteHeelToeEnvelope(0.05)).toBeCloseTo(1, 6);
    expect(coyoteHeelToeEnvelope(0.025)).toBeGreaterThan(0.3);
    expect(coyoteHeelToeEnvelope(0.2)).toBeLessThan(0.45);
    expect(coyoteHeelToeEnvelope(1.3)).toBe(0);
  });

  it("splits load into light / on-load / overrun that always sum to 1", () => {
    const idle = coyoteLoadTargets({ rpm: 700, throttle: 0.03, load: 0.05, speedMs: 0, regen: 0 });
    expect(idle.light).toBeCloseTo(1, 3);
    const pull = coyoteLoadTargets({ rpm: 4000, throttle: 0.95, load: 0.9, speedMs: 20, regen: 0 });
    expect(pull.on).toBeGreaterThan(0.99);
    const cruise = coyoteLoadTargets({
      rpm: 1800,
      throttle: 0.22,
      load: 0.2,
      speedMs: 25,
      regen: 0,
    });
    expect(cruise.light).toBeGreaterThan(0.95);
    const overrun = coyoteLoadTargets({ rpm: 3000, throttle: 0, load: 0, speedMs: 25, regen: 0 });
    expect(overrun.over).toBeGreaterThan(0.99);
    const parkedRev = coyoteLoadTargets({ rpm: 3000, throttle: 0, load: 0, speedMs: 0, regen: 0 });
    expect(parkedRev.over).toBe(0);
    for (const w of [idle, pull, cruise, overrun, parkedRev]) {
      expect(w.light + w.on + w.over).toBeCloseTo(1, 6);
    }
  });

  it("keeps lift-off pops sparse (0-3)", () => {
    const counts = Array.from({ length: 100 }, (_, i) => coyotePopCount(i / 100));
    expect(Math.min(...counts)).toBe(0);
    expect(Math.max(...counts)).toBe(3);
    expect(counts.filter((c) => c === 0).length).toBeGreaterThan(25);
  });

  it("makes decoded loop seams continuous", () => {
    const sr = 48000;
    const loop = { ...COYOTE_LOOPS[0]!, start: 0.1, end: 0.3 };
    const data = new Float32Array(Math.round(0.4 * sr));
    for (let i = 0; i < data.length; i += 1) data[i] = Math.sin(i * 0.37) * 0.5 + (i % 7) * 0.01;
    blendCoyoteLoopSeams(data, sr, [loop]);
    const s = Math.round(loop.start * sr);
    const e = Math.round(loop.end * sr);
    // the last sample before loopEnd now equals the sample before loopStart
    expect(data[e - 1]).toBeCloseTo(data[s - 1]!, 6);
  });

  it("drives American Muscle V8 and Police Patrol without the Big Twin layer", async () => {
    expect(engineLayerStackFor("american-muscle-v8")).toBeNull();
    expect(isCoyoteV8ProfileId("american-muscle-v8")).toBe(true);
    expect(isCoyoteV8ProfileId("gt-v8")).toBe(false);
    const Offline = globalThis.OfflineAudioContext;
    if (!Offline) return;
    for (const id of ["american-muscle-v8", "police-patrol"]) {
      const engine = new SoundEngine();
      await engine.start(getProfile(id), {
        context: new Offline(2, 48000, 48000),
        signature: false,
        seed: 11,
      });
      expect(engine.getActiveBackend(), id).toBe("coyote-loop-bank");
      expect(engine.getResourceDiagnostics().engineLayerCount, id).toBe(0);
      expect(engine.getCoyoteDiagnostics(), id).not.toBeNull();
      await engine.stop();
    }
    const gt = new SoundEngine();
    await gt.start(getProfile("gt-v8"), {
      context: new Offline(2, 48000, 48000),
      signature: false,
      seed: 11,
    });
    expect(gt.getActiveBackend()).not.toBe("coyote-loop-bank");
    await gt.stop();
  }, 30_000);
});

describe("Coyote V8 startup is once per drive", () => {
  it("does not replay the startup when the graph is rebuilt in the same drive", async () => {
    const Offline = globalThis.OfflineAudioContext;
    if (!Offline) return;
    const engine = new SoundEngine();
    const ctx = new Offline(2, 48000, 48000);
    await engine.start(getProfile("american-muscle-v8"), {
      context: ctx,
      signature: false,
      seed: 1,
    });
    type Peek = { coyote: { startupAllowed: boolean; attachBuffer: (b: AudioBuffer) => void } };
    const peek = () => (engine as unknown as Peek).coyote;
    const first = peek();
    expect(first.startupAllowed).toBe(true);
    // Rebuilt before the bank decoded (drive start builds twice): the flare never played,
    // so the new synth may still play it.
    engine.setEngineLayersEnabled(false); // forces a rebuild
    const second = peek();
    expect(second).not.toBe(first);
    expect(second.startupAllowed).toBe(true);
    // Once the flare has played, later rebuilds in the same drive never replay it.
    second.attachBuffer(ctx.createBuffer(1, 48000 * 61, 48000));
    engine.setEngineLayersEnabled(true);
    const third = peek();
    expect(third).not.toBe(second);
    expect(third.startupAllowed).toBe(false);
    await engine.stop();
  }, 30_000);
});
