import "@/test-utils/install-web-audio";
import { afterEach, describe, expect, it } from "vitest";

import { SoundEngine } from "@/lib/sound/engine";
import {
  LOW_POWER_GRAIN_LOOKAHEAD_S,
  PERF_TUNED_ENGINE_PROFILE_IDS,
  hybridPerfOptionsFor,
  isLowPowerFromSignals,
  isTeslaUserAgent,
  resumeWithTimeout,
  withTimeout,
} from "@/lib/sound/engine-perf";
import { getProfile } from "@/lib/sound/profiles";
import { HybridCombustionSynth } from "@/lib/sound/realism/v2";

const TESLA_UA =
  "Mozilla/5.0 (X11; GNU/Linux) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/124.0.6367.207 Chrome/124.0.6367.207 Safari/537.36 Tesla/2024.44.25";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const Offline = globalThis.OfflineAudioContext;

afterEach(() => {
  delete (globalThis as { __ELC_AUDIO_LITE?: boolean }).__ELC_AUDIO_LITE;
});

describe("engine perf tuning scope", () => {
  it("detects the Tesla in-car browser and low-power hardware", () => {
    expect(isTeslaUserAgent(TESLA_UA)).toBe(true);
    expect(isTeslaUserAgent(DESKTOP_UA)).toBe(false);
    expect(isLowPowerFromSignals({ userAgent: TESLA_UA, hardwareConcurrency: 8 })).toBe(true);
    expect(isLowPowerFromSignals({ userAgent: DESKTOP_UA, hardwareConcurrency: 8 })).toBe(false);
    expect(isLowPowerFromSignals({ userAgent: DESKTOP_UA, hardwareConcurrency: 4 })).toBe(true);
    expect(isLowPowerFromSignals({ userAgent: DESKTOP_UA, deviceMemory: 4 })).toBe(true);
  });

  it("tunes only Muscle V8 and the two V10s; other engines stay untouched", () => {
    expect([...PERF_TUNED_ENGINE_PROFILE_IDS].sort()).toEqual(
      ["american-muscle-v8", "f1-v10", "racing-v10"].sort(),
    );
    for (const id of ["gt-v8", "big-twin", "traby", "ge-squared", "rally-car"]) {
      expect(hybridPerfOptionsFor(id, null), id).toBeNull();
    }
    const primary = hybridPerfOptionsFor("american-muscle-v8", null);
    expect(primary?.kRateFilters).toBe(true);
    expect(primary?.layerLite).toBe(false);
    expect(hybridPerfOptionsFor("american-muscle-v8", null, "layer")?.layerLite).toBe(true);
  });

  it("adds the low-power extras only on a low-power device (forced here)", () => {
    (globalThis as { __ELC_AUDIO_LITE?: boolean }).__ELC_AUDIO_LITE = true;
    const lite = hybridPerfOptionsFor("racing-v10", null);
    expect(lite?.lowPower).toBe(true);
    expect(lite?.grainLookaheadS).toBe(LOW_POWER_GRAIN_LOOKAHEAD_S);
    (globalThis as { __ELC_AUDIO_LITE?: boolean }).__ELC_AUDIO_LITE = false;
    const full = hybridPerfOptionsFor("racing-v10", null);
    expect(full?.lowPower).toBe(false);
    expect(full?.grainLookaheadS).toBeUndefined();
  });
});

describe("start-up never hangs on a pending resume()", () => {
  it("withTimeout resolves null when the promise is too slow", async () => {
    await expect(withTimeout(new Promise(() => undefined), 10)).resolves.toBeNull();
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it("resumeWithTimeout returns false instead of waiting forever", async () => {
    const stuck = {
      state: "suspended" as AudioContextState,
      resume: () => new Promise<void>(() => undefined),
    };
    const started = Date.now();
    await expect(resumeWithTimeout(stuck, 20)).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
    const rejecting = {
      state: "suspended" as AudioContextState,
      resume: () => Promise.reject(new Error("no")),
    };
    await expect(resumeWithTimeout(rejecting, 20)).resolves.toBe(false);
    const ok = {
      state: "suspended" as AudioContextState,
      resume() {
        this.state = "running";
        return Promise.resolve();
      },
    };
    await expect(resumeWithTimeout(ok, 20)).resolves.toBe(true);
  });
});

describe.skipIf(!Offline)("tuned engine graphs", () => {
  it("switches every hybrid biquad to k-rate and restores createBiquadFilter", () => {
    const ctx = new Offline(2, 4800, 48000);
    const created: BiquadFilterNode[] = [];
    const original = ctx.createBiquadFilter.bind(ctx);
    const spy = () => {
      const f = original();
      created.push(f);
      return f;
    };
    (ctx as { createBiquadFilter: () => BiquadFilterNode }).createBiquadFilter = spy;
    const gain = () => ctx.createGain();
    const buses = { body: gain(), accents: gain(), beds: gain(), profile: gain() };
    const synth = new HybridCombustionSynth();
    expect(
      synth.build(ctx, getProfile("racing-v10"), buses, {
        perf: hybridPerfOptionsFor("racing-v10", ctx),
      }),
    ).toBe(true);
    expect(created.length).toBeGreaterThan(20);
    if ("automationRate" in created[0]!.frequency) {
      for (const f of created) {
        expect(f.frequency.automationRate).toBe("k-rate");
        expect(f.Q.automationRate).toBe("k-rate");
      }
    }
    expect(ctx.createBiquadFilter).toBe(spy);
    synth.dispose();

    // Untouched profile: filters keep the default a-rate automation.
    created.length = 0;
    const plain = new HybridCombustionSynth();
    plain.build(ctx, getProfile("gt-v8"), buses);
    if (created[0] && "automationRate" in created[0].frequency) {
      expect(created.every((f) => f.frequency.automationRate === "a-rate")).toBe(true);
    }
    plain.dispose();
  });

  it("builds Muscle V8 with a tuned primary and a lite Big Twin layer; GT V8 untouched", async () => {
    const engine = new SoundEngine();
    await engine.start(getProfile("american-muscle-v8"), {
      context: new Offline(2, 48000, 48000),
      signature: false,
      seed: 11,
    });
    const perf = engine.getEnginePerfDiagnostics();
    expect(perf.primary?.kRateFilters).toBe(true);
    expect(perf.primary?.layerLite).toBe(false);
    expect(perf.layers).toHaveLength(1);
    expect(perf.layers[0]?.layerLite).toBe(true);
    await engine.stop();

    const gt = new SoundEngine();
    await gt.start(getProfile("gt-v8"), {
      context: new Offline(2, 48000, 48000),
      signature: false,
      seed: 11,
    });
    expect(gt.getEnginePerfDiagnostics().primary).toBeNull();
    await gt.stop();
  }, 30_000);
});
