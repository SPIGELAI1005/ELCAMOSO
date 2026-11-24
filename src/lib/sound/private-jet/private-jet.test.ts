import { describe, expect, it } from "vitest";
import type { DriveState } from "@/lib/drive/model";
import { IDLE_STATE } from "@/lib/drive/model";
import { SOUND_ALIASES } from "@/lib/sound/engine";
import { GE_SQUARED_DRIVETRAIN } from "@/lib/sound/profiles-expansion";
import { PRIVATE_JET_TURBOFAN_PROFILE, getProfile } from "@/lib/sound/profiles";
import { jetEngineGateTarget, turbofanBedState } from "./airfield";
import { TAKEOFF_ARM_KMH, createTakeoffWhistleModel } from "./takeoff-whistle";
import { wingCheckPlan } from "./wing-check";

const frame = (
  kmh: number,
  acc: number,
  throttle: number,
  extra: Partial<DriveState> = {},
): DriveState => ({
  ...IDLE_STATE,
  speed: kmh / 3.6,
  acceleration: acc,
  throttle,
  load: throttle,
  rpm: 700 + kmh * 30,
  gear: kmh > 0 ? 2 : 1,
  ...extra,
});

function run(model: ReturnType<typeof createTakeoffWhistleModel>, f: DriveState, seconds: number) {
  let last = model.step(f, 1 / 60);
  for (let t = 1 / 60; t < seconds; t += 1 / 60) last = model.step(f, 1 / 60);
  return last;
}

describe("Private Jet Oberpfaffenhofen catalog entry", () => {
  it("keeps the private-jet id and gets the new name (single space)", () => {
    const p = getProfile("private-jet");
    expect(p.id).toBe("private-jet");
    expect(p.name).toBe("Private Jet Oberpfaffenhofen");
    expect(p.category).toBe("Aviation");
  });

  it("plays the Ge-Squared sound through the alias and drives with its gears", () => {
    expect(SOUND_ALIASES["private-jet"]).toEqual({ base: "ge-squared", overlay: "jet-airfield" });
    const p = getProfile("private-jet");
    const ge = getProfile("ge-squared");
    expect(p.transmission).toBe(GE_SQUARED_DRIVETRAIN.transmission);
    expect(ge.transmission).toBe(GE_SQUARED_DRIVETRAIN.transmission);
    expect(p.drivetrainMode).toBe("virtual-transmission");
    expect(p.drivetrainPersonalityId).toBe(ge.drivetrainPersonalityId);
  });

  it("leaves Ge-Squared's own definition as it was", () => {
    const ge = getProfile("ge-squared");
    expect(ge.name).toBe("Ge-Squared O)))");
    expect(ge.drivetrainMode).toBe("virtual-transmission");
    expect(ge.motionModel).toBe("virtual-transmission");
    expect(ge.sourceMode).toBe("procedural");
    expect(ge.drivetrainPersonalityId).toBe("v-twin-cruiser");
    expect(ge.transmission).toEqual({
      gearRatios: [13.8, 8.6, 6.2, 4.8, 3.9, 3.3, 2.9],
      idleRpm: 700,
      redlineRpm: 5000,
      shiftSmoothing: 0.18,
    });
  });

  it("keeps the old continuous turbofan profile for the parked wind bed", () => {
    expect(PRIVATE_JET_TURBOFAN_PROFILE.id).toBe("private-jet");
    expect(PRIVATE_JET_TURBOFAN_PROFILE.drivetrainMode).toBe("continuous");
    expect(PRIVATE_JET_TURBOFAN_PROFILE.voice.baseFrequency).toBe(1100);
  });
});

describe("airfield crossfade (no Ge-Squared idle while parked)", () => {
  it("is fully on the jet wind bed while parked", () => {
    expect(jetEngineGateTarget(frame(0, 0, 0))).toBe(0);
    // Parked GPS jitter: no Ge-Squared bleed.
    expect(jetEngineGateTarget(frame(1.5, 0.6, 0.05))).toBe(0);
  });
  it("hands over to Ge-Squared with movement or a launch", () => {
    expect(jetEngineGateTarget(frame(12, 0, 0.2))).toBe(1);
    expect(jetEngineGateTarget(frame(80, 0, 0.3))).toBe(1);
    expect(jetEngineGateTarget(frame(3, 1.5, 0.2))).toBe(1);
    // Hold-to-rev while parked.
    expect(jetEngineGateTarget(frame(0, 0, 0.9))).toBe(1);
  });
  it("feeds the turbofan bed a gearless frame", () => {
    const s = turbofanBedState(frame(30, 1, 0.5));
    expect(s.rpm).toBe(0);
    expect(s.gear).toBe(0);
    expect(s.powertrain).toBeUndefined();
  });
});

describe("take-off turbo whistle", () => {
  it("is silent at idle", () => {
    const m = createTakeoffWhistleModel();
    const f = run(m, frame(0, 0, 0), 5);
    expect(f.active).toBe(false);
    expect(f.gain).toBe(0);
  });

  it("plays on a strong launch, rising with speed, and fades in cruise", () => {
    const m = createTakeoffWhistleModel();
    run(m, frame(0, 0, 0), 1);
    const early = run(m, frame(10, 2.5, 0.9, { rpm: 2500 }), 1.5);
    expect(early.active).toBe(true);
    const later = run(m, frame(70, 2, 0.9, { rpm: 4200 }), 2);
    expect(later.gain).toBeGreaterThan(early.gain);
    expect(later.hz).toBeGreaterThan(early.hz);
    const cruise = run(m, frame(120, 0, 0.3, { rpm: 2600 }), 4);
    expect(cruise.active).toBe(false);
    expect(cruise.gain).toBeLessThan(0.001);
    expect(m.takeoffs).toBe(1);
  });

  it("fades on lift-off", () => {
    const m = createTakeoffWhistleModel();
    run(m, frame(0, 0, 0), 1);
    run(m, frame(20, 2.5, 0.9, { rpm: 3500 }), 2);
    const lift = run(m, frame(40, -1, 0, { rpm: 2000 }), 3);
    expect(lift.active).toBe(false);
    expect(lift.gain).toBeLessThan(0.001);
  });

  it("does not whistle on a gentle pull-away", () => {
    const m = createTakeoffWhistleModel();
    run(m, frame(0, 0, 0), 1);
    const f = run(m, frame(15, 0.6, 0.3, { rpm: 1500 }), 4);
    expect(f.active).toBe(false);
    expect(m.takeoffs).toBe(0);
  });

  it("re-arms only after slowing down again", () => {
    const m = createTakeoffWhistleModel();
    run(m, frame(0, 0, 0), 1);
    run(m, frame(20, 2.5, 0.9), 2);
    run(m, frame(100, 0, 0.3), 3);
    // Strong overtaking pull at speed is not a take-off.
    expect(run(m, frame(100, 2.5, 0.9), 2).active).toBe(false);
    run(m, frame(TAKEOFF_ARM_KMH - 10, -1, 0), 2);
    expect(run(m, frame(TAKEOFF_ARM_KMH - 5, 2.5, 0.9), 1).active).toBe(true);
    expect(m.takeoffs).toBe(2);
  });
});

describe("wing check plan", () => {
  it("flaps run out and back with an end stop each way", () => {
    const plan = wingCheckPlan("flaps", () => 0.5);
    expect(plan).toHaveLength(2);
    expect(plan[1]!.at).toBeGreaterThan(plan[0]!.dur);
    expect(plan.every((s) => s.clunk > 0)).toBe(true);
  });
  it("ailerons twitch four short strokes", () => {
    const plan = wingCheckPlan("ailerons", () => 0.5);
    expect(plan).toHaveLength(4);
    expect(plan.every((s) => s.dur < 0.5)).toBe(true);
  });
});
