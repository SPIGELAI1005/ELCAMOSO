/**
 * Realism V2.1 unit coverage - firing math, load/shift behaviour, sample helpers.
 */
import { describe, expect, it } from "vitest";
import {
  acousticEngineForProfile,
  firingHzFromRpm,
  isCombustionRealismV2Profile,
} from "@/lib/sound/realism/v2/acoustic-engine";
import {
  loadRegionFromDemand,
  playbackRateForRpm,
  SAMPLE_RATE_MAX,
  SAMPLE_RATE_MIN,
  selectSampleNeighbors,
  type CombustionSampleBank,
} from "@/lib/sound/realism/v2/sample-bank";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { HybridCombustionSynth } from "@/lib/sound/realism/v2/hybrid-combustion-synth";
import { getProfile } from "@/lib/sound/profiles";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";

describe("firingHzFromRpm", () => {
  it("matches four-stroke V8 at 3000 RPM (RPM × cyl / 120)", () => {
    expect(firingHzFromRpm(3000, 8, "four-stroke")).toBeCloseTo(200, 5);
  });

  it("matches flat-six at 6000 RPM", () => {
    expect(firingHzFromRpm(6000, 6, "four-stroke")).toBeCloseTo(300, 5);
  });

  it("matches two-stroke formula", () => {
    expect(firingHzFromRpm(6000, 2, "two-stroke")).toBeCloseTo(200, 5);
  });
});

describe("acoustic eligibility V2.1", () => {
  it("covers priority combustion profiles", () => {
    for (const id of [
      "gt-v8",
      "american-muscle-v8",
      "flat-six-sport",
      "turbo-inline-6",
      "racing-v10",
      "race-car",
      "rally-car",
      "motorcycle-superbike",
      "big-twin",
    ]) {
      expect(isCombustionRealismV2Profile(id)).toBe(true);
      const cfg = acousticEngineForProfile(id)!;
      expect(cfg.cylinders).toBeGreaterThan(0);
      expect(cfg.bodyResonanceHz.length).toBeGreaterThan(0);
      expect(cfg.combustionSharpness).toBeGreaterThan(0);
    }
  });

  it("does not claim electronic profiles", () => {
    expect(isCombustionRealismV2Profile("cyber-pulse")).toBe(false);
    expect(acousticEngineForProfile("cyber-pulse")).toBeNull();
  });

  it("differentiates American vs GT vs Flat-Six vs Turbo", () => {
    const gt = acousticEngineForProfile("gt-v8")!;
    const am = acousticEngineForProfile("american-muscle-v8")!;
    const fs = acousticEngineForProfile("flat-six-sport")!;
    const ti = acousticEngineForProfile("turbo-inline-6")!;
    expect(am.idleIrregularity).toBeGreaterThan(gt.idleIrregularity);
    expect(am.exhaustPulse).toBeGreaterThan(gt.exhaustPulse);
    expect(fs.intakePresence).toBeGreaterThan(gt.intakePresence);
    expect(fs.combustionSharpness).toBeGreaterThan(am.combustionSharpness);
    expect(ti.forcedInduction).toBe(true);
    expect(gt.forcedInduction).toBe(false);
    expect(am.architectureCode).toBe(1);
    expect(fs.architectureCode).toBe(2);
    expect(gt.architectureCode).toBe(3);
  });

  it("gives Racing V10 denser high-RPM character", () => {
    const gt = acousticEngineForProfile("gt-v8")!;
    const v10 = acousticEngineForProfile("racing-v10")!;
    expect(v10.intakePresence).toBeGreaterThan(gt.intakePresence);
    expect(v10.cylinders).toBe(10);
    expect(v10.combustionSharpness).toBeGreaterThan(gt.combustionSharpness);
  });
});

describe("sample bank helpers", () => {
  const bank: CombustionSampleBank = {
    personalityId: "gt-v8",
    entries: [
      { assetId: "a", personalityId: "gt-v8", rpmRef: 900, load: "idle" },
      { assetId: "b", personalityId: "gt-v8", rpmRef: 2500, load: "low" },
      { assetId: "c", personalityId: "gt-v8", rpmRef: 3500, load: "low" },
      { assetId: "d", personalityId: "gt-v8", rpmRef: 4500, load: "high" },
    ],
  };

  it("blends between adjacent RPM refs", () => {
    const { a, b, blend } = selectSampleNeighbors(bank, 3000, "low");
    expect(a?.assetId).toBe("b");
    expect(b?.assetId).toBe("c");
    expect(blend).toBeCloseTo(0.5, 1);
  });

  it("clamps playback rate", () => {
    expect(playbackRateForRpm(900, 2500)).toBe(SAMPLE_RATE_MIN);
    expect(playbackRateForRpm(5000, 2500)).toBe(SAMPLE_RATE_MAX);
    expect(playbackRateForRpm(2500, 2500)).toBeCloseTo(1, 5);
  });

  it("maps demand to load regions", () => {
    expect(loadRegionFromDemand(0.05, false)).toBe("idle");
    expect(loadRegionFromDemand(0.5, false)).toBe("medium");
    expect(loadRegionFromDemand(0.2, true)).toBe("overrun");
  });
});

describe("HybridCombustionSynth phase + load", () => {
  function mockAudioParam() {
    return {
      value: 0,
      setTargetAtTime() {
        return this;
      },
      setValueAtTime() {
        return this;
      },
      cancelScheduledValues() {
        return this;
      },
      linearRampToValueAtTime() {
        return this;
      },
      exponentialRampToValueAtTime() {
        return this;
      },
    };
  }

  function mockNode() {
    const n: Record<string, unknown> = {
      connect() {
        return n;
      },
      disconnect() {},
      start() {},
      stop() {},
      frequency: mockAudioParam(),
      gain: mockAudioParam(),
      Q: mockAudioParam(),
      type: "sine",
      buffer: null,
      loop: false,
      playbackRate: mockAudioParam(),
      curve: null,
    };
    return n;
  }

  function mockCtx(): BaseAudioContext {
    return {
      sampleRate: 44100,
      currentTime: 0,
      state: "running",
      createGain: () => mockNode(),
      createOscillator: () => mockNode(),
      createBiquadFilter: () => mockNode(),
      createBufferSource: () => mockNode(),
      createWaveShaper: () => mockNode(),
      createBuffer: (_ch: number, length: number, rate: number) => ({
        length,
        sampleRate: rate,
        numberOfChannels: 1,
        duration: length / rate,
        getChannelData: () => new Float32Array(length),
      }),
    } as unknown as BaseAudioContext;
  }

  function state(partial: Partial<DriveState>): DriveState {
    return { ...IDLE_STATE, ...partial };
  }

  it("builds for GT V8 and reports fallback excitation under mock ctx", () => {
    const ctx = mockCtx();
    const synth = new HybridCombustionSynth();
    const body = mockNode() as unknown as GainNode;
    const ok = synth.build(ctx, getProfile("gt-v8"), {
      body,
      accents: mockNode() as unknown as GainNode,
      beds: mockNode() as unknown as GainNode,
      profile: body,
    });
    expect(ok).toBe(true);
    const d = synth.getDiagnostics();
    expect(d.cylinders).toBe(8);
    expect(["worklet", "fallback"]).toContain(d.excitationMode);
    expect(d.activeNodeEstimate).toBeGreaterThan(10);
    expect(d.activeNodeEstimate).toBeLessThan(80);
    synth.dispose();
  });

  it("tracks firingHz with RPM and reports shift phase from powertrain", () => {
    const ctx = mockCtx();
    const synth = new HybridCombustionSynth();
    const body = mockNode() as unknown as GainNode;
    synth.build(ctx, getProfile("flat-six-sport"), {
      body,
      accents: mockNode() as unknown as GainNode,
      beds: mockNode() as unknown as GainNode,
      profile: body,
    });

    synth.update(
      state({
        rpm: 3000,
        throttle: 0.5,
        load: 0.5,
        powertrain: {
          ...IDLE_POWERTRAIN,
          rpm: 3000,
          mechanicalRpm: 3000,
          driverDemand: 0.5,
          engineLoad: 0.5,
          gear: 2,
          shifting: true,
          shiftPhase: "torque_cut",
          shiftProgress: 0.15,
          shiftLoadMultiplier: 0.4,
          shiftDirection: "up",
        },
      }),
      0.1,
    );
    const d = synth.getDiagnostics();
    expect(d.firingHz).toBeCloseTo(150, 0);
    expect(d.shiftPhase).toBe("torque_cut");
    expect(d.load).toBeCloseTo(0.5, 1);
    synth.dispose();
  });

  it("keeps node estimate stable across updates (no per-fire nodes)", () => {
    const ctx = mockCtx();
    const synth = new HybridCombustionSynth();
    const body = mockNode() as unknown as GainNode;
    synth.build(ctx, getProfile("turbo-inline-6"), {
      body,
      accents: mockNode() as unknown as GainNode,
      beds: mockNode() as unknown as GainNode,
      profile: body,
    });
    const before = synth.getDiagnostics().activeNodeEstimate;
    for (let i = 0; i < 40; i += 1) {
      synth.update(
        state({
          rpm: 2000 + i * 80,
          throttle: 0.3 + (i % 5) * 0.1,
          load: 0.3 + (i % 5) * 0.1,
          powertrain: {
            ...IDLE_POWERTRAIN,
            rpm: 2000 + i * 80,
            mechanicalRpm: 2000 + i * 80,
            driverDemand: 0.3 + (i % 5) * 0.1,
            engineLoad: 0.3 + (i % 5) * 0.1,
            gear: 3,
          },
        }),
        i * 0.016,
      );
    }
    expect(synth.getDiagnostics().activeNodeEstimate).toBe(before);
    synth.dispose();
  });
});
