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
      for (const k of ["cackle", "eerie", "scream", "gust", "howl"]) expect(kinds).toContain(k);
      for (const s of d.signals.filter((x) => ["cackle", "eerie", "scream"].includes(x.kind))) {
        expect(s.everySeconds - s.jitter).toBeGreaterThanOrEqual(15);
        expect(s.everySeconds + s.jitter).toBeLessThanOrEqual(40);
      }
      expect(d.music).toBe(true);
    });
  }
  it("wind stays present at standstill", () => {
    const wind = getProfile("dracula-carriage").voice.textures!.find((t) => t.kind === "wind")!;
    expect(wind.speedScale).toBeLessThanOrEqual(0.3);
  });
});
