import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import { rocketLoad } from "@/lib/sound/dsp/rocket-layer";
import { getProfile } from "@/lib/sound/profiles";
import { FREE_SOUND_PROFILE_IDS } from "@/lib/sound/profile-access-config";
import { findSoundsFromPrompt } from "@/lib/sound/find-sound";
import { renderLabOffline } from "@/lib/sound/lab/render-harness";

describe("rocket-car profile", () => {
  it("is a free Future profile", () => {
    const p = getProfile("rocket-car");
    expect(p.name).toBe("Rocket Car");
    expect(p.category).toBe("Future");
    expect((FREE_SOUND_PROFILE_IDS as readonly string[]).includes("rocket-car")).toBe(true);
  });

  it("load follows acceleration and intent, bounded 0..1", () => {
    expect(rocketLoad({ accelFast: 0, syntheticLoad: 0, throttle: 0 })).toBe(0);
    expect(rocketLoad({ accelFast: 0.5, syntheticLoad: 0.1, throttle: 0.2 })).toBeCloseTo(0.575);
    expect(rocketLoad({ accelFast: 2, syntheticLoad: 2, throttle: 2 })).toBe(1);
  });

  it("is findable in en/de/ro", () => {
    for (const q of ["rocket", "rakete", "racheta"]) {
      expect(findSoundsFromPrompt(q)[0]?.profileId === "rocket-car").toBe(true);
    }
  });

  it("assertive acceleration is louder than steady cruise and peaks stay safe", async () => {
    const hard = await renderLabOffline({ profileId: "rocket-car", fixtureId: "assertive-accel", includeSpectrum: false, environmentId: "open" });
    const cruise = await renderLabOffline({ profileId: "rocket-car", fixtureId: "steady-80", includeSpectrum: false, environmentId: "open" });
    expect(hard.metrics.nanCount).toBe(0);
    expect(hard.metrics.approximateIntegratedLoudness).toBeGreaterThan(cruise.metrics.approximateIntegratedLoudness);
    expect(hard.metrics.approximateIntegratedLoudness).toBeGreaterThan(-18);
    expect(hard.metrics.approximateIntegratedLoudness).toBeLessThan(-11); // round 4: bass-led rumble adds ~0.5 LU at layer level; full chain unchanged
    expect(hard.metrics.samplePeakDbfs).toBeLessThan(-2.5);
  }, 120_000);
});
