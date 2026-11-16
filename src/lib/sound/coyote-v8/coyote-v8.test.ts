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
} from "./model";
import { isCoyoteV8ProfileId } from "./coyote-synth";

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
      "upshift1",
      "upshift2",
      "blip1",
      "blip2",
      "pop1",
      "pop2",
      "pop3",
    ]) {
      expect(ids).toContain(id);
    }
    const loudestLoop = Math.max(...bank.loops.map((l) => l.peakDb));
    for (const o of bank.oneshots) expect(o.peakDb).toBeLessThanOrEqual(loudestLoop + 0.01);
  });

  it("crossfades neighbouring RPM loops with equal power", () => {
    for (const rpm of [500, 700, 820, 1500, 3000, 4800, 6600, 7000, 9000]) {
      const w = coyoteRpmWeights(rpm);
      expect(w.length).toBeGreaterThanOrEqual(1);
      expect(w.length).toBeLessThanOrEqual(2);
      const power = w.reduce((s, p) => s + p.weight * p.weight, 0);
      expect(power).toBeCloseTo(1, 6);
      for (const p of w) {
        const rate = coyoteLoopRate(
          Math.min(7000, Math.max(700, rpm)),
          COYOTE_RPM_POINTS[p.index]!,
        );
        expect(rate).toBeGreaterThan(0.72);
        expect(rate).toBeLessThan(1.37);
      }
    }
    expect(coyoteRpmWeights(2150)).toEqual([{ index: 4, weight: 1 }]);
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
    const first = (engine as unknown as { coyote: { startupAllowed: boolean } }).coyote;
    expect(first.startupAllowed).toBe(true);
    engine.setEngineLayersEnabled(false); // forces a rebuild
    const second = (engine as unknown as { coyote: { startupAllowed: boolean } }).coyote;
    expect(second).not.toBe(first);
    expect(second.startupAllowed).toBe(false);
    await engine.stop();
  }, 30_000);
});
