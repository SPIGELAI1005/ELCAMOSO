import { describe, expect, it } from "vitest";
import {
  cockpitFavouriteSlots,
  cockpitSecondaryView,
  cockpitSpeedAvailability,
  formatCockpitSpeed,
  stepMasterVolume,
  volumePercentLabel,
} from "@/lib/drive/cockpit-model";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { getProfile } from "@/lib/sound/profiles";

describe("cockpitSpeedAvailability", () => {
  it("treats demo/simulation as live", () => {
    expect(
      cockpitSpeedAvailability({ productStatus: "simulation", sessionKind: "demo" }),
    ).toBe("live");
  });

  it("marks weak-signal and hold freshness as stale", () => {
    expect(cockpitSpeedAvailability({ productStatus: "weak-signal" })).toBe("stale");
    expect(
      cockpitSpeedAvailability({
        productStatus: "sound-active",
        speedFreshness: "hold",
      }),
    ).toBe("stale");
  });

  it("marks GPS-only as estimate", () => {
    expect(cockpitSpeedAvailability({ productStatus: "gps-only" })).toBe("estimate");
  });
});

describe("formatCockpitSpeed", () => {
  it("does not show a misleading zero when stale or unavailable", () => {
    const stale = formatCockpitSpeed(0, "stale", "km/h", 0);
    expect(stale.value).toBe("—");
    expect(stale.showUnit).toBe(false);
    expect(stale.caption.toLowerCase()).toMatch(/waiting|motion/);

    const unavailable = formatCockpitSpeed(0, "unavailable", "km/h", 0);
    expect(unavailable.value).toBe("—");
    expect(unavailable.caption.toLowerCase()).toMatch(/unavailable/);
  });

  it("shows numeric speed when live or estimate", () => {
    const live = formatCockpitSpeed(20, "live", "km/h", 72);
    expect(live.value).toBe("72");
    expect(live.showUnit).toBe(true);

    const estimate = formatCockpitSpeed(10, "estimate", "km/h", 36);
    expect(estimate.value).toBe("36");
    expect(estimate.caption.toLowerCase()).toMatch(/gps/);
  });
});

describe("cockpitSecondaryView", () => {
  it("shows gear + RPM for virtual-transmission combustion", () => {
    const state: DriveState = {
      ...IDLE_STATE,
      rpm: 3200,
      gear: 3,
      speed: 20,
    };
    const profile = getProfile("gt-v8");
    expect(profile.drivetrainMode).toBe("virtual-transmission");
    const view = cockpitSecondaryView(profile, state);
    expect(view.kind).toBe("gear");
    expect(view.value).toBe("3");
    expect(view.showRpm).toBe(true);
    expect(view.simulatedCaption.toLowerCase()).toMatch(/simulated/);
  });

  it("shows regime instead of fictitious gears for continuous profiles", () => {
    const profile = getProfile("cyber-pulse");
    const state: DriveState = {
      ...IDLE_STATE,
      speed: 15,
      throttle: 0.5,
      load: 0.5,
      gear: 0,
      rpm: 0,
    };
    const view = cockpitSecondaryView(profile, {
      ...state,
      regen: 0,
    });
    expect(view.kind).toBe("regime");
    expect(view.value).not.toMatch(/^[1-6]$/);
    expect(view.showRpm).toBe(false);
  });
});

describe("cockpitFavouriteSlots", () => {
  it("keeps first three catalog ids and drops unknowns", () => {
    const slots = cockpitFavouriteSlots(
      ["gt-v8", "missing-id", "racing-v10", "cyber-pulse", "flat-six-sport"],
      new Set(["gt-v8", "racing-v10", "cyber-pulse", "flat-six-sport"]),
      3,
    );
    expect(slots).toEqual(["gt-v8", "racing-v10", "cyber-pulse"]);
  });
});

describe("volume helpers", () => {
  it("steps volume in 5% increments", () => {
    expect(stepMasterVolume(0.35, 1)).toBe(0.4);
    expect(stepMasterVolume(0.02, -1)).toBe(0);
  });

  it("labels mute clearly", () => {
    expect(volumePercentLabel(0, true)).toBe("Muted");
    expect(volumePercentLabel(0.35, false)).toBe("35%");
  });
});
