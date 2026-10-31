import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import { sirenTargetGain } from "@/lib/sound/dsp/siren-overlay";

const idle = { speed: 0, acceleration: 0, throttle: 0, regen: 0, rpm: 800, gear: 1, load: 0.1, timestamp: 0, jerk: 0, isShifting: false, speedNormalized: 0, accelerationNormalized: 0 } as never;

async function startedEngine() {
  const engine = new SoundEngine();
  const ctx = new OfflineAudioContext(2, 48_000 * 2, 48_000);
  // live order: profile picked before audio starts, then settings re-applied
  engine.setProfile(getProfile("police-patrol"));
  await engine.start(getProfile("police-patrol"), { context: ctx as never, signature: false, seed: 1, environmentId: "open" });
  return engine;
}

describe("police patrol siren in the real engine", { timeout: 30000 }, () => {
  it("siren node is connected with gain > 0 at idle", async () => {
    const engine = await startedEngine();
    engine.update(idle);
    const d = engine.sirenDiagnostics();
    expect(d.active).toBe(true);
    expect(d.connected).toBe(true);
    expect(d.gain).toBeGreaterThan(0);
    expect(d.mode).toBe("wail");
  });

  it("survives internal rebuilds that pass the base V8 back in", async () => {
    const engine = await startedEngine();
    engine.setSynthesisMode("hybrid" as never);
    engine.setSynthesisMode("synth" as never);
    engine.setProfile(getProfile("american-muscle-v8"), true);
    const d = engine.sirenDiagnostics();
    expect(d.active && d.connected && d.gain > 0).toBe(true);
  });

  it("switching to a plain profile removes the siren", async () => {
    const engine = await startedEngine();
    engine.setProfile(getProfile("dracula-carriage"), true);
    expect(engine.sirenDiagnostics().active).toBe(false);
  });

  it("level is never zero and rises gently with speed", () => {
    expect(sirenTargetGain(0)).toBeGreaterThan(0.1);
    expect(sirenTargetGain(130)).toBeGreaterThan(sirenTargetGain(0));
  });
});

describe("police siren sits in the distance", { timeout: 30000 }, () => {
  it("uses a classic wail range, a lowpass and a credited loop", async () => {
    const m = await import("@/lib/sound/dsp/siren-overlay");
    expect(m.SIREN_LOW_HZ).toBeGreaterThanOrEqual(550);
    expect(m.SIREN_HIGH_HZ).toBeLessThanOrEqual(1350);
    expect(m.SIREN_LOWPASS_HZ).toBeGreaterThanOrEqual(2000);
    expect(m.SIREN_LOWPASS_HZ).toBeLessThanOrEqual(3000);
    expect(m.SIREN_CREDIT.licence).not.toMatch(/NC/);
    const { existsSync } = await import("fs");
    expect(existsSync(`public${m.SIREN_URL}`)).toBe(true);
  });
});
