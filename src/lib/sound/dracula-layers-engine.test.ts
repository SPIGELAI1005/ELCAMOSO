import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";

const idle = { speed: 0, acceleration: 0, throttle: 0, regen: 0, rpm: 800, gear: 1, load: 0.1, timestamp: 0, jerk: 0, isShifting: false, speedNormalized: 0, accelerationNormalized: 0 } as never;

async function engineFor(mode: "improved" | "original") {
  const engine = new SoundEngine();
  const ctx = new OfflineAudioContext(2, 48_000 * 2, 48_000);
  engine.setSynthesisMode(mode as never);
  engine.setProfile(getProfile("dracula-carriage"));
  await engine.start(getProfile("dracula-carriage"), { context: ctx as never, signature: false, seed: 1, environmentId: "open" });
  engine.update(idle);
  return engine;
}

describe("Dracula Carriage layers in the live engine graph", { timeout: 30000 }, () => {
  for (const mode of ["improved", "original"] as const) {
    it(`${mode}: wind bed, voice events and orchestra are all wired`, async () => {
      const d = (await engineFor(mode)).atmosphereDiagnostics();
      const wind = d.textures.find((x) => x.kind === "wind");
      expect(wind).toBeTruthy();
      expect(wind!.gain).toBeGreaterThan(0);
      const kinds = d.signals.map((s) => s.kind);
      expect(kinds).toContain("gust");
      expect(d.music).toBe(true);
    });
  }
  it("improved (live default): jump scares are wired, warm their buffers and fire", async () => {
    const engine = await engineFor("improved");
    const ctx = engine as unknown as { now(): number };
    let t = 0;
    const realNow = ctx.now.bind(engine);
    ctx.now = () => t;
    for (let i = 0; i < 300; i += 1) { t = i * 0.1; engine.update(idle); }
    ctx.now = realNow;
    const sc = engine.scareDiagnostics()!;
    expect(sc).toBeTruthy();
    expect(sc.ready).toBeGreaterThanOrEqual(6);
    expect(sc.fired).toBeGreaterThan(0);
  });
  it("wind stays present at standstill", () => {
    const wind = getProfile("dracula-carriage").voice.textures!.find((t) => t.kind === "wind")!;
    expect(wind.speedScale).toBeLessThanOrEqual(0.3);
  });
});
