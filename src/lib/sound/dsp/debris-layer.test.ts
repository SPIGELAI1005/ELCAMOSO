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

  it("fires one short, decaying burst on a hard launch, with cooldown", async () => {
    // hard launch at 0.5 s, held for 3 s, released, and re-hit at 4.5 s (inside cooldown)
    const r = await render((t) => (t > 0.5 && t < 3.5 ? 4.2 : t > 4.5 && t < 5 ? 4.2 : 0), 7);
    expect(r.bursts).toBe(1);
    expect(r.rms(0.5, 1.5)).toBeGreaterThan(1e-4);
    // gone within ~2.5 s of the onset (plus short ring tails), no sustained energy
    expect(r.rms(3.7, 7)).toBeLessThan(1e-5);
    expect(r.peak).toBeLessThan(0.5);
  });

  it("is configured for the space / sci-fi worlds with a hard-launch-only threshold", () => {
    for (const id of ["world-space-drive", "space-ship", "world-cyber-city", "world-storm-run"]) {
      const d = getWorldPack(id)?.debris;
      expect(d?.level ?? 0).toBeGreaterThan(0);
      expect(d?.thresholdMps2 ?? 2.8).toBeGreaterThan(2.2);
    }
  });
});
