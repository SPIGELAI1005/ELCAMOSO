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
  playbackRateWithinCoverage,
  SAMPLE_RATE_MAX,
  SAMPLE_RATE_MIN,
  selectSampleNeighbors,
  selectSampleMix,
  type CombustionSampleBank,
} from "@/lib/sound/realism/v2/sample-bank";
import {
  AMERICAN_V8_PILOT_MANIFEST,
  isPilotEntryApproved,
  missingPilotRecordingRequirements,
} from "@/lib/sound/realism/v2/american-v8-pilot-manifest";
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

  it("does not reuse flat-six or inline-six acoustics for track and rally profiles", () => {
    const flatSix = acousticEngineForProfile("flat-six-sport")!;
    const track = acousticEngineForProfile("race-car")!;
    const turboSix = acousticEngineForProfile("turbo-inline-6")!;
    const rally = acousticEngineForProfile("rally-car")!;

    expect(track.architecture).toBe("flat-plane-v8");
    expect(track.cylinders).toBe(8);
    expect(track.combustionSharpness).toBeGreaterThan(flatSix.combustionSharpness);
    expect(rally.architecture).toBe("inline-3");
    expect(rally.cylinders).toBe(3);
    expect(rally.forcedInduction).toBe(true);
    expect(rally.exhaustPulse).toBeGreaterThan(turboSix.exhaustPulse);
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
    expect(loadRegionFromDemand(0.05, false, 2400)).toBe("off-load");
  });

  it("falls back instead of pitching outside an entry's permitted range", () => {
    const entry = {
      assetId: "limited",
      personalityId: "american-v8",
      rpmRef: 2000,
      load: "high" as const,
      permittedPlaybackRate: { min: 0.9, max: 1.1 },
    };
    expect(playbackRateWithinCoverage(entry, 2600)).toBeNull();
    const selection = selectSampleMix(
      { personalityId: "american-v8", entries: [entry] },
      2600,
      "high",
      0.9,
    );
    expect(selection.targets).toEqual([]);
    expect(selection.fallbackReason).toBe("rate-out-of-range");
  });

  it("interpolates adjacent RPM and load anchors with bounded linear overlap", () => {
    const entries = [
      ["low-2", 2000, 0.35],
      ["low-4", 4000, 0.35],
      ["high-2", 2000, 0.85],
      ["high-4", 4000, 0.85],
    ].map(([assetId, rpmRef, loadAnchor]) => ({
      assetId: String(assetId), personalityId: "american-v8", rpmRef: Number(rpmRef),
      load: "medium" as const, loadAnchor: Number(loadAnchor),
      permittedPlaybackRate: { min: 0.7, max: 1.6 },
    }));
    const selection = selectSampleMix(
      { personalityId: "american-v8", entries },
      3000,
      "medium",
      0.6,
    );
    expect(selection.targets).toHaveLength(4);
    expect(selection.targets.reduce((sum, target) => sum + target.weight, 0)).toBeCloseTo(1, 6);
    expect(selection.targets.every((target) => target.weight >= 0)).toBe(true);
  });
});

describe("American V8 pilot manifest", () => {
  it("keeps absent asset and provenance metadata explicitly unknown", () => {
    expect(AMERICAN_V8_PILOT_MANIFEST.every((entry) => entry.assetPath === null)).toBe(true);
    expect(AMERICAN_V8_PILOT_MANIFEST.every((entry) => entry.rpmAnchor === null)).toBe(true);
    expect(AMERICAN_V8_PILOT_MANIFEST.every((entry) => !isPilotEntryApproved(entry))).toBe(true);
    expect(missingPilotRecordingRequirements()).toHaveLength(9);
  });

  it("reports all nine operating regions uncovered when the pilot bank is empty", async () => {
    const { reportAmericanV8SampleCoverage, buildAmericanV8PilotBank, AMERICAN_V8_REQUIRED_REGIONS } =
      await import("@/lib/sound/realism/v2/sample-bank");
    const coverage = reportAmericanV8SampleCoverage(buildAmericanV8PilotBank());
    expect(coverage.covered).toEqual([]);
    expect(coverage.uncovered).toEqual([...AMERICAN_V8_REQUIRED_REGIONS]);
  });
});

describe("HybridCombustionSynth phase + load", () => {
  function mockAudioParam() {
    return {
      value: 0,
      setTargetAtTime(value: number) {
        this.value = value;
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

  it("changes spectral shape and intake/exhaust balance at fixed RPM when load changes", () => {
    const synth = new HybridCombustionSynth();
    const body = mockNode() as unknown as GainNode;
    synth.build(mockCtx(), getProfile("american-muscle-v8"), {
      body,
      accents: mockNode() as unknown as GainNode,
      beds: mockNode() as unknown as GainNode,
      profile: body,
    });
    synth.update(state({ rpm: 2800, throttle: 0.15, load: 0.2 }), 0.1);
    const light = synth.getDiagnostics();
    synth.update(state({ rpm: 2800, throttle: 0.85, load: 0.9 }), 0.2);
    const loaded = synth.getDiagnostics();
    expect(loaded.spectralTiltDb).toBeGreaterThan(light.spectralTiltDb);
    expect(loaded.intakeGain).toBeGreaterThan(light.intakeGain);
    expect(loaded.combustionGain).toBeGreaterThan(light.combustionGain);
    expect(loaded.formantGains).not.toEqual(light.formantGains);
    synth.dispose();
  });

  it("edge-gates held boost-release and shift phases", () => {
    const synth = new HybridCombustionSynth();
    const body = mockNode() as unknown as GainNode;
    synth.build(mockCtx(), getProfile("turbo-inline-6"), {
      body,
      accents: mockNode() as unknown as GainNode,
      beds: mockNode() as unknown as GainNode,
      profile: body,
    });
    for (let i = 0; i < 80; i += 1) {
      synth.update(
        state({
          rpm: 3600,
          throttle: 0.8,
          load: 0.85,
          powertrain: {
            ...IDLE_POWERTRAIN,
            rpm: 3600,
            mechanicalRpm: 3600,
            gear: 3,
            boost: 0.9,
            driverDemand: 0.8,
            engineLoad: 0.85,
          },
        }),
        0.02 + i * 0.02,
      );
    }
    const held = state({
      rpm: 3600,
      throttle: 0.05,
      load: 0.12,
      powertrain: {
        ...IDLE_POWERTRAIN,
        rpm: 3600,
        mechanicalRpm: 3600,
        gear: 3,
        shifting: true,
        shiftPhase: "reengage",
        shiftDirection: "up",
        boost: 0.55,
        boostRelease: true,
      },
    });
    synth.update(held, 1.7);
    synth.update(held, 1.72);
    synth.update(held, 1.74);
    expect(synth.getDiagnostics().eventCounts).toEqual({
      shift: 2,
      overrun: 0,
      boostRelease: 1,
    });
    synth.dispose();
  });

  function buildGt(ctx = mockCtx()) {
    const synth = new HybridCombustionSynth();
    const body = mockNode() as unknown as GainNode;
    synth.build(ctx, getProfile("gt-v8"), {
      body,
      accents: mockNode() as unknown as GainNode,
      beds: mockNode() as unknown as GainNode,
      profile: body,
    });
    return synth;
  }

  function shiftFrames(direction: "up" | "down", fromGear: number) {
    const base = {
      ...IDLE_POWERTRAIN,
      rpm: 3400,
      mechanicalRpm: 3400,
      driverDemand: 0.55,
      engineLoad: 0.6,
      throttle: 0.55,
      load: 0.6,
      normalizedRpm: 0.45,
      gear: fromGear,
      targetGear: direction === "up" ? fromGear + 1 : fromGear - 1,
    };
    return [
      state({ rpm: 3400, throttle: 0.55, load: 0.6, speed: 14, powertrain: { ...base } }),
      state({
        rpm: 3400,
        throttle: 0.55,
        load: 0.6,
        speed: 14,
        powertrain: {
          ...base,
          shifting: true,
          shiftDirection: direction,
          shiftPhase: "torque_cut",
          shiftProgress: 0.05,
          shiftLoadMultiplier: 0.4,
        },
      }),
      state({
        rpm: 2600,
        throttle: 0.55,
        load: 0.6,
        speed: 14,
        powertrain: {
          ...base,
          gear: direction === "up" ? fromGear + 1 : fromGear - 1,
          shifting: true,
          shiftDirection: direction,
          shiftPhase: "reengage",
          shiftProgress: 0.8,
          shiftLoadMultiplier: 0.8,
        },
      }),
      state({ rpm: 2600, throttle: 0.55, load: 0.6, speed: 14, powertrain: { ...base, gear: fromGear + 1 } }),
    ];
  }

  it("always renders a mechanical upshift pulse when the powertrain starts a shift", () => {
    const synth = buildGt();
    shiftFrames("up", 2).forEach((frame, i) => synth.update(frame, 0.1 + i * 0.05));
    const d = synth.getDiagnostics();
    expect((d.transientCounts.upshift ?? 0) + (d.transientCounts.downshift ?? 0)).toBeGreaterThan(0);
    expect(d.eventCounts.shift).toBe(2);
    expect(d.transientTier).toBe("full");
    synth.dispose();
  });

  it("core tier keeps shift mechanics but drops Drive+ extras", () => {
    const synth = buildGt();
    synth.setAdvancedTransientsEnabled(false);
    expect(synth.getDiagnostics().transientTier).toBe("core");
    shiftFrames("up", 2).forEach((frame, i) => synth.update(frame, 0.1 + i * 0.05));
    // Arm + lift for overrun.
    for (let i = 0; i < 30; i += 1) {
      synth.update(
        state({
          rpm: 4200,
          throttle: 0.8,
          load: 0.85,
          speed: 20,
          powertrain: { ...IDLE_POWERTRAIN, rpm: 4200, mechanicalRpm: 4200, gear: 3, throttle: 0.8, load: 0.85, driverDemand: 0.8, engineLoad: 0.85 },
        }),
        1 + i * 0.02,
      );
    }
    synth.update(
      state({
        rpm: 4000,
        throttle: 0.02,
        load: 0.05,
        regen: 0.5,
        speed: 20,
        powertrain: { ...IDLE_POWERTRAIN, rpm: 4000, mechanicalRpm: 4000, gear: 3, throttle: 0.02, load: 0.05, driverDemand: 0.02, engineLoad: 0.05, overrun: true },
      }),
      1.7,
    );
    const d = synth.getDiagnostics();
    expect((d.transientCounts.upshift ?? 0) + (d.transientCounts["drivetrain-thump"] ?? 0)).toBeGreaterThan(0);
    expect(d.transientCounts.overrun ?? 0).toBe(0);
    expect(d.transientCounts["exhaust-pop"] ?? 0).toBe(0);
    expect(d.transientCounts["rev-match"] ?? 0).toBe(0);
    synth.dispose();
  });

  it("choreographs legacy (no powertrain) gear changes as pulse + thump", () => {
    const synth = buildGt();
    synth.update(state({ rpm: 3200, gear: 1, speed: 8, throttle: 0.4, load: 0.4 }), 0.1);
    synth.update(
      state({ rpm: 2200, gear: 2, speed: 8.2, throttle: 0.4, load: 0.3, isShifting: true }),
      0.15,
    );
    synth.update(state({ rpm: 2300, gear: 2, speed: 8.4, throttle: 0.4, load: 0.3 }), 0.2);
    const d = synth.getDiagnostics();
    expect(d.transientCounts.upshift).toBe(1);
    expect(d.transientCounts["drivetrain-thump"]).toBe(1);
    expect(d.eventCounts.shift).toBe(1);
    synth.dispose();
  });

  it("tracks engine orders with RPM and builds the pipe space when a convolver exists", () => {
    const ctx = mockCtx();
    (ctx as unknown as { createConvolver: () => unknown }).createConvolver = () => ({
      ...mockNode(),
      normalize: true,
    });
    const synth = buildGt(ctx);
    expect(synth.getDiagnostics().spaceMode).toBe("pipe-ir");
    synth.update(state({ rpm: 1500, throttle: 0.3, load: 0.3 }), 0.1);
    const low = synth.getDiagnostics().orderHz;
    synth.update(state({ rpm: 4500, throttle: 0.3, load: 0.3 }), 0.2);
    const high = synth.getDiagnostics().orderHz;
    expect(low).toHaveLength(3);
    // V8: half order, firing order (4/rev) and 2× firing order.
    expect(low[1]).toBeCloseTo((1500 / 60) * 4, 1);
    expect(high[1]).toBeCloseTo((4500 / 60) * 4, 1);
    expect(high[0]).toBeLessThan(high[1]!);
    expect(high[2]).toBeGreaterThan(high[1]!);
    synth.dispose();
  });

  it("releases all graph resources and stays inert after dispose", () => {
    const synth = new HybridCombustionSynth();
    const body = mockNode() as unknown as GainNode;
    synth.build(mockCtx(), getProfile("american-muscle-v8"), {
      body,
      accents: mockNode() as unknown as GainNode,
      beds: mockNode() as unknown as GainNode,
      profile: body,
    });
    expect(synth.getDiagnostics().activeNodeEstimate).toBeGreaterThan(0);
    synth.dispose();
    synth.update(state({ rpm: 4000, throttle: 1, load: 1 }), 1);
    expect(synth.getDiagnostics().activeNodeEstimate).toBe(0);
  });
});
