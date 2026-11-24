import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";

const idle = {
  speed: 0,
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
} as never;

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
  engine.update(idle);
  return engine;
}

describe("Ge-Squared on the Coyote V8 in the real engine", { timeout: 30000 }, () => {
  it("Ge-Squared O))) and '90 build the Coyote with their voicing", async () => {
    expect((await started("ge-squared")).getCoyoteDiagnostics()?.voicing).toBe("ge-squared");
    expect((await started("ge-squared-90")).getCoyoteDiagnostics()?.voicing).toBe("ge-squared-90");
  });

  it("American Muscle V8 and Police Patrol keep the plain Coyote", async () => {
    expect((await started("american-muscle-v8")).getCoyoteDiagnostics()?.voicing).toBe(
      "american-muscle-v8",
    );
    expect((await started("police-patrol")).getCoyoteDiagnostics()?.voicing).toBe(
      "american-muscle-v8",
    );
  });

  it("Private Jet keeps the previous Ge-Squared engine (no Coyote)", async () => {
    const engine = await started("private-jet");
    expect(engine.getCoyoteDiagnostics()).toBeNull();
    expect(engine.jetAirfieldDiagnostics()).not.toBeNull();
  });

  it("picking Ge-Squared after Private Jet switches to Ge-Squared", async () => {
    const engine = await started("private-jet");
    engine.setProfile(getProfile("ge-squared"));
    engine.update(idle);
    expect(engine.jetAirfieldDiagnostics()).toBeNull();
    expect(engine.getCoyoteDiagnostics()?.voicing).toBe("ge-squared");
  });

  it("an internal rebuild passing the base back in keeps Private Jet", async () => {
    const engine = await started("private-jet");
    engine.setProfile(getProfile("ge-squared"), true);
    expect(engine.getCoyoteDiagnostics()).toBeNull();
    expect(engine.jetAirfieldDiagnostics()).not.toBeNull();
  });
});
