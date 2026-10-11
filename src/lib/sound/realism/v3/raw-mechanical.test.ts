import { describe, expect, it } from "vitest";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";
import { getProfile } from "@/lib/sound/profiles";
import { HybridCombustionSynth } from "@/lib/sound/realism/v2/hybrid-combustion-synth";
import {
  crankHzFromRpm,
  cycleVariation,
  firingHzFourStroke,
  mildSaturationCurve,
  pulseWidthSeconds,
  resolveRawMechanicalQualityTier,
  seededUnit,
  shouldPreferOversampling,
  belowNyquist,
} from "@/lib/sound/realism/v3/pulse-primitives";
import {
  isRawMechanicalPilotId,
  rawMechanicalPresetFor,
  RAW_MECHANICAL_PILOT_IDS,
} from "@/lib/sound/realism/v3/raw-mechanical-presets";
import { isDriveAudioV3Enabled } from "@/lib/sound/realism/v3/flag";

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
    oversample: "none",
  };
  return n;
}

function mockCtx(): BaseAudioContext {
  return {
    sampleRate: 48_000,
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

function buses() {
  const body = mockNode() as unknown as GainNode;
  return {
    body,
    accents: mockNode() as unknown as GainNode,
    beds: mockNode() as unknown as GainNode,
    profile: body,
  };
}

function state(partial: Partial<DriveState>): DriveState {
  return { ...IDLE_STATE, ...partial };
}

describe("raw mechanical primitives", () => {
  it("matches four-stroke firing and crank order relationships", () => {
    expect(firingHzFourStroke(6000, 8)).toBeCloseTo(400, 5);
    expect(crankHzFromRpm(6000)).toBeCloseTo(100, 5);
    expect(firingHzFourStroke(6000, 8)).toBeCloseTo(crankHzFromRpm(6000) * 4, 5);
  });

  it("keeps pulse widths finite and band-limited helpers below Nyquist", () => {
    const w = pulseWidthSeconds({ sharpness: 0.5, load: 0.4, quality: "high" });
    expect(w).toBeGreaterThan(0.002);
    expect(w).toBeLessThan(0.02);
    expect(belowNyquist(30_000, 48_000)).toBeLessThan(24_000);
  });

  it("produces repeatable seeded cycle variation", () => {
    const a = cycleVariation({ seedState: 42, irregularity: 0.4, load: 0.3 });
    const b = cycleVariation({ seedState: 42, irregularity: 0.4, load: 0.3 });
    expect(a.ampScale).toBe(b.ampScale);
    expect(a.intervalScale).toBe(b.intervalScale);
    const c = cycleVariation({ seedState: a.nextSeed, irregularity: 0.4, load: 0.3 });
    expect(c.ampScale).not.toBe(a.ampScale);
    expect(a.ampScale).toBeGreaterThanOrEqual(0.55);
    expect(a.ampScale).toBeLessThanOrEqual(1.45);
  });

  it("builds a mild finite saturation curve", () => {
    const curve = mildSaturationCurve(0.4);
    expect(curve.length).toBe(256);
    expect(curve[128]).toBeCloseTo(0, 2);
    expect(Math.abs(curve[255]!)).toBeLessThanOrEqual(1);
    expect(Number.isFinite(curve[0]!)).toBe(true);
  });

  it("documents oversampling assessment without requiring it on low-cost", () => {
    expect(
      shouldPreferOversampling({ quality: "low-cost", saturationDrive: 0.9, sampleRate: 48_000 })
        .prefer,
    ).toBe(false);
    const high = shouldPreferOversampling({
      quality: "high",
      saturationDrive: 0.5,
      sampleRate: 48_000,
    });
    expect(high.reason.length).toBeGreaterThan(0);
  });

  it("resolves a quality tier without throwing outside the browser", () => {
    expect(["high", "low-cost"]).toContain(resolveRawMechanicalQualityTier(null));
  });
});

describe("raw mechanical presets", () => {
  it("exposes distinct muscle vs flat-six identities (not the same bass boost)", () => {
    expect(RAW_MECHANICAL_PILOT_IDS).toEqual(["american-muscle-v8", "flat-six-sport"]);
    const muscle = rawMechanicalPresetFor("american-muscle-v8")!;
    const flat = rawMechanicalPresetFor("flat-six-sport")!;
    expect(muscle.bodyOrderHz[0]!).toBeLessThan(flat.bodyOrderHz[0]!);
    expect(muscle.combustionGainScale).toBeGreaterThan(flat.combustionGainScale);
    expect(flat.intakeGainScale).toBeGreaterThan(muscle.intakeGainScale);
    expect(flat.mechanicalCenterHz).toBeGreaterThan(muscle.mechanicalCenterHz);
    expect(muscle.loadBalanceBias).toBeGreaterThan(flat.loadBalanceBias);
  });

  it("does not invent non-catalog pilots", () => {
    expect(isRawMechanicalPilotId("gt-v8")).toBe(false);
    expect(rawMechanicalPresetFor("gt-v8")).toBeNull();
    expect(rawMechanicalPresetFor("cyber-pulse")).toBeNull();
  });
});

describe("raw mechanical synth lifecycle", () => {
  it("defaults the V3 flag to off", () => {
    expect(isDriveAudioV3Enabled()).toBe(false);
  });

  it("builds and disposes a V3 overlay graph for both pilots with finite diagnostics", () => {
    for (const id of RAW_MECHANICAL_PILOT_IDS) {
      const ctx = mockCtx();
      const synth = new HybridCombustionSynth();
      const ok = synth.build(ctx, getProfile(id), buses(), {
        rawMechanical: rawMechanicalPresetFor(id),
      });
      expect(ok).toBe(true);
      const diag = synth.getDiagnostics();
      expect(diag.realismEngine).toBe("v3");
      expect(diag.rawMechanicalProfileId).toBe(id);
      expect(diag.rawMechanicalQuality).toBe("high");
      expect(diag.cylinders).toBeGreaterThan(0);
      expect(diag.oversamplingNote).toBeTruthy();
      expect(diag.activeNodeEstimate).toBeGreaterThan(10);

      synth.update(
        state({
          rpm: 2200,
          throttle: 0.4,
          load: 0.45,
          powertrain: {
            ...IDLE_POWERTRAIN,
            rpm: 2200,
            mechanicalRpm: 2200,
            driverDemand: 0.4,
            engineLoad: 0.45,
            gear: 2,
          },
        }),
        0.02,
      );
      const after = synth.getDiagnostics();
      expect(Number.isFinite(after.combustionGain)).toBe(true);
      expect(Number.isFinite(after.intakeGain)).toBe(true);
      expect(after.combustionGain).toBeGreaterThan(0);
      expect(after.firingHz).toBeGreaterThan(0);

      synth.update(
        state({
          rpm: 2200,
          throttle: 0.8,
          load: 0.85,
          powertrain: {
            ...IDLE_POWERTRAIN,
            rpm: 2200,
            mechanicalRpm: 2200,
            driverDemand: 0.8,
            engineLoad: 0.85,
            gear: 2,
          },
        }),
        0.04,
      );
      const loaded = synth.getDiagnostics();
      expect(loaded.load).toBeGreaterThan(after.load);
      expect(loaded.intakeGain).not.toBe(after.intakeGain);

      synth.dispose();
    }
  });

  it("keeps V2 build unchanged when rawMechanical is omitted", () => {
    const ctx = mockCtx();
    const synth = new HybridCombustionSynth();
    expect(synth.build(ctx, getProfile("american-muscle-v8"), buses())).toBe(true);
    expect(synth.getDiagnostics().realismEngine).toBe("v2");
    expect(synth.getDiagnostics().rawMechanicalProfileId).toBeNull();
    synth.dispose();
  });

  it("seeded unit stream is deterministic", () => {
    const a = seededUnit(0x454c4341);
    const b = seededUnit(0x454c4341);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
});

describe("listening status", () => {
  it("records perceived realism as pending (code tests do not prove authenticity)", () => {
    const report = {
      pilots: RAW_MECHANICAL_PILOT_IDS,
      listeningVerdict: "pending" as const,
      note: "Automated tests check finite/stable DSP only — not cabin authenticity.",
    };
    expect(report.listeningVerdict).toBe("pending");
  });
});
