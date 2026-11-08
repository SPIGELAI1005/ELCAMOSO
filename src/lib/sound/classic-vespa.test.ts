import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { computeDriveState, IDLE_STATE } from "@/lib/drive/model";
import { withPersonalityTransmission } from "@/lib/drive/drivetrain-resolve";
import { getDrivetrainPersonality } from "@/lib/drive/drivetrain-personalities";
import { getProfile } from "@/lib/sound/profiles";
import {
  acousticEngineBaseForProfile,
  firingHzFromRpm,
} from "@/lib/sound/realism/v2/acoustic-engine";
import {
  TWO_STROKE_TWIN_TOPOLOGY,
  VESPA_SINGLE_TOPOLOGY,
  combustionTopologyForProfile,
  firesPerCycle,
} from "@/lib/sound/realism/v2/combustion-topology";
import { getAcousticProfileSpec } from "@/lib/sound/profile-specs";
import { profileHeroImageSrc } from "@/lib/sound/profile-hero-image";

function loadProcessor() {
  const sourcePath = resolve(process.cwd(), "public/audio/combustion-processor.js");
  const code = readFileSync(sourcePath, "utf8");
  let Processor: new () => {
    process: (
      inputs: unknown[],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>,
    ) => boolean;
    port: { onmessage: ((e: { data: unknown }) => void) | null };
    fireIndex: number;
  };
  const scope = {
    AudioWorkletProcessor: class {
      port = { onmessage: null as ((e: unknown) => void) | null, postMessage() {} };
    },
    sampleRate: 48000,
    registerProcessor: (_name: string, ctor: typeof Processor) => {
      Processor = ctor;
    },
  };
  vm.runInNewContext(code, scope, { filename: sourcePath });
  return new Processor();
}

function firesAt(rpm: number, seconds: number) {
  const processor = loadProcessor();
  const steady = { ...VESPA_SINGLE_TOPOLOGY, organic: undefined, cycleLope: 0 };
  processor.port.onmessage?.({ data: { type: "topology", topology: steady } });
  const firingHz = rpm / 60;
  const params = {
    firingHz: new Float32Array([firingHz]),
    intensity: new Float32Array([0.4]),
    irregularity: new Float32Array([0]),
    load: new Float32Array([0.2]),
    sharpness: new Float32Array([0.46]),
    architecture: new Float32Array([5]),
  };
  const start = processor.fireIndex;
  const blocks = Math.round((48000 * seconds) / 128);
  for (let b = 0; b < blocks; b += 1) {
    processor.process([], [[new Float32Array(128), new Float32Array(128)]], params);
  }
  return (processor.fireIndex - start + 0x10000) % 0x10000;
}

describe("Classic Vespa", () => {
  it("fires once per crank revolution", () => {
    expect(firingHzFromRpm(1900, 1, "two-stroke")).toBeCloseTo(1900 / 60, 5);
    expect(firingHzFromRpm(5600, 1, "two-stroke")).toBeCloseTo(5600 / 60, 5);
    const topology = combustionTopologyForProfile("classic-vespa");
    expect(topology?.stroke).toBe("two-stroke");
    expect(topology?.cycleDegrees).toBe(360);
    expect(firesPerCycle(topology!)).toBe(1);
    expect(firesAt(1900, 1)).toBeGreaterThanOrEqual(30);
    expect(firesAt(1900, 1)).toBeLessThanOrEqual(33);
    expect(firesAt(5600, 0.5)).toBeGreaterThanOrEqual(45);
    expect(firesAt(5600, 0.5)).toBeLessThanOrEqual(48);
  });

  it("stays a separate single from the two-stroke twin", () => {
    const spec = getAcousticProfileSpec("classic-vespa");
    expect(spec.recipe.cycle.cylinders).toBe(1);
    expect(spec.recipe.cycle.stroke).toBe("two-stroke");
    expect(spec.recipe.cycle.idleRpm).toBe(1900);
    expect(spec.recipe.cycle.maxRpm).toBeGreaterThan(5600);
    expect(VESPA_SINGLE_TOPOLOGY).not.toBe(TWO_STROKE_TWIN_TOPOLOGY);
    expect(acousticEngineBaseForProfile("classic-vespa")).not.toBe(
      acousticEngineBaseForProfile("traby"),
    );
    expect(acousticEngineBaseForProfile("traby")?.cylinders).toBe(2);
    expect(acousticEngineBaseForProfile("classic-vespa")?.liftPops).toBeUndefined();
    expect(getProfile("classic-vespa").drivetrainPersonalityId).toBe("classic-vespa");
    expect(getProfile("traby").drivetrainPersonalityId).not.toBe("classic-vespa");
  });

  it("uses four approximate gears with dwell and a ceiling above the power peak", () => {
    const personality = getDrivetrainPersonality("classic-vespa");
    expect(personality.transmission.gearRatios).toHaveLength(4);
    expect(personality.engine.idleRpm).toBe(1900);
    expect(personality.engine.redlineRpm).toBeGreaterThan(5600);
    expect(personality.transmission.shift.minGearHoldMs).toBeGreaterThanOrEqual(1000);
    expect(personality.transmission.upshiftHysteresisRpm).toBeGreaterThan(200);
    expect(personality.transmission.finalDrive).toBeCloseTo(3.045, 3);
    expect(profileHeroImageSrc("classic-vespa")).toBe("/hero/sound-profiles/classic-vespa.png");
    expect(existsSync("public/hero/sound-profiles/classic-vespa.png")).toBe(true);
  });

  it("holds one gear when speed wanders near a cruise", () => {
    const profile = withPersonalityTransmission(getProfile("classic-vespa"));
    let state = { ...IDLE_STATE, gear: 3, rpm: 4200 };
    const base = 52 / 3.6;
    for (let i = 0; i < 80; i += 1) {
      const wobble = Math.sin(i / 5) * 0.6;
      state = computeDriveState({
        speed: base + wobble / 3.6,
        acceleration: 0,
        previous: state,
        profile,
        dt: 0.05,
      });
    }
    const gear = state.gear;
    for (let i = 0; i < 40; i += 1) {
      const wobble = Math.sin(i / 3) * 0.8;
      state = computeDriveState({
        speed: base + wobble / 3.6,
        acceleration: 0,
        previous: state,
        profile,
        dt: 0.05,
      });
      expect(state.gear).toBe(gear);
    }
    expect(gear).toBeGreaterThanOrEqual(1);
    expect(gear).toBeLessThanOrEqual(4);
  });

  it("returns to idle as the scooter stops and drops pitch on an upshift", () => {
    const profile = withPersonalityTransmission(getProfile("classic-vespa"));
    let moving = { ...IDLE_STATE, gear: 1, rpm: 5000, speed: 18 / 3.6, acceleration: 1.2 };
    for (let i = 0; i < 30; i += 1) {
      moving = computeDriveState({
        speed: (18 + i * 0.8) / 3.6,
        acceleration: 1.4,
        previous: moving,
        profile,
        dt: 0.05,
      });
    }
    const before = moving.rpm;
    const beforeGear = moving.gear;
    let shifted = moving;
    for (let i = 0; i < 20 && shifted.gear === beforeGear; i += 1) {
      shifted = computeDriveState({
        speed: shifted.speed + 0.9,
        acceleration: 1.6,
        previous: shifted,
        profile,
        dt: 0.05,
      });
    }
    if (shifted.gear > beforeGear) expect(shifted.rpm).toBeLessThan(before);

    let stopping = shifted;
    for (let i = 0; i < 40; i += 1) {
      const speed = Math.max(0, stopping.speed - 0.8);
      stopping = computeDriveState({
        speed,
        acceleration: speed === 0 ? 0 : -2,
        previous: stopping,
        profile,
        dt: 0.05,
      });
    }
    expect(stopping.speed).toBe(0);
    expect(stopping.rpm).toBeLessThanOrEqual(profile.transmission!.idleRpm + 50);
  });
});
