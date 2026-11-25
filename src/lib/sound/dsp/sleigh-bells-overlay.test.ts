import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import {
  BELLS_FAST_INTERVAL_SCALE,
  BELLS_INTERVAL_S,
  BELLS_MIN_GAP_S,
  bellIntervalFor,
  bellKindFor,
  bellLevelFor,
  bellRandom,
  renderChime,
  renderJingle,
} from "@/lib/sound/dsp/sleigh-bells-overlay";
import { driveDisplayKind } from "@/lib/drive/drive-display";
import { SOUND_ALIASES, SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import { MUSCLE_BOX } from "@/lib/sound/profiles-expansion";

const at = (kmh: number) =>
  ({
    speed: kmh / 3.6,
    acceleration: 0,
    throttle: 0,
    regen: 0,
    rpm: 800,
    gear: 1,
    load: 0.1,
    timestamp: 0,
    jerk: 0,
    isShifting: false,
    speedNormalized: 0,
    accelerationNormalized: 0,
  }) as never;

/** Share of energy above `hz` (plain DFT over a few 1024-sample frames). */
function highShare(d: Float32Array, sr: number, hz: number): number {
  const n = 1024;
  let total = 0;
  let high = 0;
  for (let start = 0; start + n <= d.length; start += n * 6) {
    for (let k = 1; k < n / 2; k++) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < n; i++) {
        const w = (2 * Math.PI * k * i) / n;
        re += d[start + i]! * Math.cos(w);
        im -= d[start + i]! * Math.sin(w);
      }
      const p = re * re + im * im;
      total += p;
      if ((k * sr) / n > hz) high += p;
    }
  }
  return total > 0 ? high / total : 0;
}

describe("Santa V8 Sleigh profile", () => {
  it("is renamed, keeps its id and drives like the American Muscle V8", () => {
    const p = getProfile("santa-sleigh");
    expect(p.id).toBe("santa-sleigh");
    expect(p.name).toBe("Santa V8 Sleigh");
    expect(p.traits).toContain("V8");
    expect(p.drivetrainMode).toBe("virtual-transmission");
    expect(p.drivetrainPersonalityId).toBe("american-v8");
    expect(p.transmission).toBe(MUSCLE_BOX);
    expect(getProfile("american-muscle-v8").transmission).toBe(MUSCLE_BOX);
    expect(driveDisplayKind(p)).toBe("combustion");
  });

  it("is the V8 sound by alias with bells, at the V8's own level", () => {
    expect(SOUND_ALIASES["santa-sleigh"]).toEqual({
      base: "american-muscle-v8",
      overlay: "sleigh-bells",
    });
  });
});

describe("Christmas bells timing and level", () => {
  it("come every 15-40 s parked, a bit more often with speed, never closer than the cap", () => {
    const [lo, hi] = BELLS_INTERVAL_S;
    expect(bellIntervalFor(0, 0)).toBe(lo);
    expect(bellIntervalFor(0, 1)).toBe(hi);
    expect(bellIntervalFor(200, 1)).toBeCloseTo(hi * BELLS_FAST_INTERVAL_SCALE);
    for (let kmh = 0; kmh <= 250; kmh += 10) {
      for (const u of [0, 0.3, 0.7, 1]) {
        expect(bellIntervalFor(kmh, u)).toBeGreaterThanOrEqual(BELLS_MIN_GAP_S);
      }
    }
  });

  it("are livelier with speed and at most +2 dB louder", () => {
    expect(bellKindFor(0, 0.9)).toBe("jingle-soft");
    expect(bellKindFor(50, 0.9)).toBe("jingle");
    expect(bellKindFor(110, 0.9)).toBe("jingle-lively");
    expect(bellKindFor(110, 0.1)).toBe("chime");
    expect(bellLevelFor(0)).toBe(1);
    expect(bellLevelFor(300)).toBeCloseTo(10 ** (2 / 20));
  });
});

describe("bell synthesis", () => {
  const sr = 48_000;
  it("jingles and chimes are bounded, short and dark (little energy above 6 kHz)", () => {
    const rnd = bellRandom(7);
    const j = renderJingle(sr, rnd, { pulses: 10, rate: 8, perPulse: 3, amp: 0.252 });
    const c = renderChime(sr, rnd);
    for (const d of [j, c]) {
      let peak = 0;
      for (const v of d) peak = Math.max(peak, Math.abs(v));
      expect(Number.isFinite(peak)).toBe(true);
      expect(peak).toBeGreaterThan(0.05);
      expect(peak).toBeLessThan(1);
    }
    expect(j.length / sr).toBeLessThan(2);
    expect(c.length / sr).toBeLessThan(5);
    expect(highShare(j, sr, 6000)).toBeLessThan(0.05);
    expect(highShare(c, sr, 6000)).toBeLessThan(0.01);
  });

  it("is deterministic per seed", () => {
    const a = renderChime(sr, bellRandom(3));
    const b = renderChime(sr, bellRandom(3));
    expect(a).toEqual(b);
  });
});

describe("Santa V8 Sleigh in the real engine", { timeout: 30000 }, () => {
  async function started(id: string) {
    const engine = new SoundEngine();
    const ctx = new OfflineAudioContext(2, 48_000 * 2, 48_000);
    engine.setProfile(getProfile(id));
    await engine.start(getProfile(id), {
      context: ctx as never,
      signature: false,
      seed: 1,
      environmentId: "open",
    });
    engine.update(at(0));
    return engine;
  }

  it("plays the plain Coyote V8 with the bells on top", async () => {
    const engine = await started("santa-sleigh");
    expect(engine.getCoyoteDiagnostics()?.voicing).toBe("american-muscle-v8");
    expect(engine.sleighBellsDiagnostics()?.connected).toBe(true);
    expect(engine.sirenDiagnostics().active).toBe(false);
  });

  it("other V8 profiles get no bells, and switching away removes them", async () => {
    expect((await started("american-muscle-v8")).sleighBellsDiagnostics()).toBeNull();
    expect((await started("police-patrol")).sleighBellsDiagnostics()).toBeNull();
    const engine = await started("santa-sleigh");
    engine.setProfile(getProfile("american-muscle-v8"));
    engine.update(at(0));
    expect(engine.sleighBellsDiagnostics()).toBeNull();
    expect(engine.getCoyoteDiagnostics()?.voicing).toBe("american-muscle-v8");
  });
});
