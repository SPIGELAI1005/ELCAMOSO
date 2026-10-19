import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import { createDebrisBurst } from "@/lib/sound/dsp/debris-layer";
import { getWorldPack } from "@/lib/worlds/experience-pack";

const SR = 48000;

async function render(trace: (t: number) => number, seconds: number) {
  const ctx = new OfflineAudioContext(2, SR * seconds, SR);
  const burst = createDebrisBurst(ctx, ctx.destination, { level: 0.25 });
  for (let t = 0; t < seconds - 0.05; t += 1 / 60) burst.update(trace(t), 40, t);
  const buf = await ctx.startRendering();
  const x = buf.getChannelData(0);
  const rms = (a: number, b: number) => {
    let s = 0;
    for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i] * x[i];
    return Math.sqrt(s / Math.max(1, (b - a) * SR));
  };
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  return { bursts: burst.bursts, rms, peak };
}

describe("debris layer", () => {
  it("stays silent at rest and on gentle acceleration", async () => {
    const r = await render((t) => (t > 1 ? 2.0 : 0), 4);
    expect(r.bursts).toBe(0);
    expect(r.peak).toBe(0);
  });

  it("fires one 3-5 s burst that thins out on a short hard launch, with cooldown", async () => {
    // hard launch 0.5-2 s, released, re-hit at 4.5 s (inside the >=5 s cooldown)
    const r = await render((t) => (t > 0.5 && t < 2 ? 4.2 : t > 4.5 && t < 5 ? 4.2 : 0), 8);
    expect(r.bursts).toBe(1);
    expect(r.rms(0.6, 1.6)).toBeGreaterThan(1e-4);
    // still present (thinning) after 3 s, gone ~5.6 s after onset at the latest
    expect(r.rms(3, 4)).toBeGreaterThan(1e-6);
    expect(r.rms(3, 4)).toBeLessThan(r.rms(0.6, 1.6));
    expect(r.rms(6.3, 8)).toBeLessThan(1e-6);
    expect(r.peak).toBeLessThan(0.7);
  });

  it("keeps a sparse trickle while hard acceleration persists (max 12 s), then re-arms after cooldown", async () => {
    const r = await render((t) => (t > 0.5 && t < 9 ? 3.6 : t > 17 && t < 18 ? 4.2 : 0), 20);
    expect(r.rms(7, 8.5)).toBeGreaterThan(1e-6);
    // fades about 1 s after the push ends
    expect(r.rms(10.6, 16.5)).toBeLessThan(1e-6);
    // a new hard launch after the cooldown fires again
    expect(r.bursts).toBe(2);
    expect(r.rms(17.2, 18.5)).toBeGreaterThan(1e-5);
  });

  it("is configured for the space / sci-fi worlds with a hard-launch-only threshold", () => {
    for (const id of ["world-space-drive", "space-ship", "world-cyber-city", "world-storm-run"]) {
      const d = getWorldPack(id)?.debris;
      expect(d?.level ?? 0).toBeGreaterThan(0);
      expect(d?.thresholdMps2 ?? 2.8).toBeGreaterThan(2.2);
    }
  });
});

describe("debris grains (real recordings)", () => {
  it("ships a versioned, credited grain pack whose offsets fit the file", async () => {
    const { readFileSync } = await import("node:fs");
    const { DEBRIS_GRAINS, DEBRIS_GRAINS_URL, DEBRIS_GRAIN_CREDITS } =
      await import("@/lib/sound/dsp/debris-grains");
    expect(DEBRIS_GRAINS_URL).toMatch(/\/debris-v\d+\//);
    const wav = readFileSync(`public${DEBRIS_GRAINS_URL}`);
    const ctx = new OfflineAudioContext(1, SR, SR);
    const buf = await ctx.decodeAudioData(
      wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
    );
    expect(DEBRIS_GRAINS.length).toBeGreaterThanOrEqual(24);
    for (const [start, dur] of DEBRIS_GRAINS) {
      expect(dur).toBeLessThanOrEqual(0.071);
      expect(start + dur).toBeLessThanOrEqual(buf.duration + 1e-3);
    }
    expect(DEBRIS_GRAINS.some((g) => g[2] === "m")).toBe(true);
    expect(
      DEBRIS_GRAIN_CREDITS.every(
        (c) => c.licence === "CC BY 4.0" && c.attribution.includes("Gravity Sound"),
      ),
    ).toBe(true);
  });

  it("plays the decoded grains when available (3-5 s, thinning burst)", async () => {
    const { readFileSync } = await import("node:fs");
    const { DEBRIS_GRAINS_URL, setDebrisGrainBufferForTest } =
      await import("@/lib/sound/dsp/debris-grains");
    const wav = readFileSync(`public${DEBRIS_GRAINS_URL}`);
    const dec = new OfflineAudioContext(1, SR, SR);
    setDebrisGrainBufferForTest(
      await dec.decodeAudioData(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength)),
    );
    try {
      const r = await render((t) => (t > 0.5 && t < 2 ? 4.2 : 0), 8);
      expect(r.bursts).toBe(1);
      expect(r.rms(0.6, 1.6)).toBeGreaterThan(1e-4);
      expect(r.rms(6.3, 8)).toBeLessThan(1e-6);
      expect(r.peak).toBeLessThan(0.7);
    } finally {
      setDebrisGrainBufferForTest(null);
    }
  });
});
