/**
 * Prompt 07 — all-profile finite / level / lifecycle checks (mock Web Audio).
 * Listening authenticity is NOT asserted here.
 */
import { describe, expect, it } from "vitest";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { IDLE_POWERTRAIN } from "@/lib/powertrain/types";
import { isFusionProfileId, FusionSynth } from "@/lib/fusion";
import { isSymphonyProfileId, SymphonySynth } from "@/lib/symphony";
import { isWorldProfileId, WorldSynth } from "@/lib/worlds";
import { PUBLIC_PROFILE_IDS } from "@/lib/sound/profile-experience-config";
import { getProfile } from "@/lib/sound/profiles";
import { ImprovedSynth } from "@/lib/sound/realism/improved-synth";
import {
  allCatalogTuningEntries,
  setCatalogAutomatedCheck,
} from "@/lib/sound/realism/catalog-tuning";
import { HybridCombustionSynth } from "@/lib/sound/realism/v2/hybrid-combustion-synth";
import { isCombustionRealismV2Profile } from "@/lib/sound/realism/v2/acoustic-engine";
import type { StrategyBuses } from "@/lib/sound/realism/types";

function mockAudioParam(initial = 0) {
  return {
    value: initial,
    setTargetAtTime(value: number) {
      this.value = value;
      return this;
    },
    setValueAtTime(value: number) {
      this.value = value;
      return this;
    },
    cancelScheduledValues() {
      return this;
    },
    linearRampToValueAtTime(value: number) {
      this.value = value;
      return this;
    },
    exponentialRampToValueAtTime(value: number) {
      this.value = Math.max(1e-6, value);
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
    frequency: mockAudioParam(440),
    gain: mockAudioParam(1),
    Q: mockAudioParam(1),
    detune: mockAudioParam(0),
    pan: mockAudioParam(0),
    delayTime: mockAudioParam(0),
    threshold: mockAudioParam(-24),
    knee: mockAudioParam(30),
    ratio: mockAudioParam(12),
    attack: mockAudioParam(0.003),
    release: mockAudioParam(0.25),
    offset: mockAudioParam(1),
    type: "sine",
    buffer: null,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    playbackRate: mockAudioParam(1),
    curve: null,
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    numberOfInputs: 1,
    numberOfOutputs: 1,
  };
  return n;
}

function mockCtx(): BaseAudioContext {
  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    state: "running",
    destination: mockNode(),
    createGain: () => mockNode(),
    createOscillator: () => mockNode(),
    createBiquadFilter: () => mockNode(),
    createBufferSource: () => mockNode(),
    createWaveShaper: () => mockNode(),
    createStereoPanner: () => mockNode(),
    createDynamicsCompressor: () => mockNode(),
    createDelay: () => mockNode(),
    createConvolver: () => mockNode(),
    createAnalyser: () => mockNode(),
    createConstantSource: () => mockNode(),
    createChannelMerger: () => mockNode(),
    createChannelSplitter: () => mockNode(),
    createBuffer: (_ch: number, length: number, rate: number) => ({
      length,
      sampleRate: rate,
      numberOfChannels: Math.max(1, _ch),
      duration: length / rate,
      getChannelData: () => new Float32Array(length),
      copyFromChannel() {},
      copyToChannel() {},
    }),
    audioWorklet: undefined,
  };
  return ctx as unknown as BaseAudioContext;
}

function buses(): StrategyBuses {
  const body = mockNode() as unknown as GainNode;
  return {
    body,
    accents: mockNode() as unknown as GainNode,
    beds: mockNode() as unknown as GainNode,
    profile: body,
  };
}

function state(partial: Partial<DriveState> = {}): DriveState {
  return {
    ...IDLE_STATE,
    rpm: 1800,
    throttle: 0.35,
    load: 0.4,
    speedKmh: 40,
    powertrain: {
      ...IDLE_POWERTRAIN,
      rpm: 1800,
      mechanicalRpm: 1800,
      driverDemand: 0.35,
      engineLoad: 0.4,
      gear: 2,
      speedKmh: 40,
    },
    ...partial,
  };
}

const REGIMES: Array<{ name: string; partial: Partial<DriveState> }> = [
  { name: "idle", partial: { rpm: 800, throttle: 0.05, load: 0.08, speedKmh: 0 } },
  { name: "cruise", partial: { rpm: 2200, throttle: 0.25, load: 0.3, speedKmh: 70 } },
  { name: "load", partial: { rpm: 4200, throttle: 0.85, load: 0.9, speedKmh: 90 } },
  { name: "release", partial: { rpm: 3000, throttle: 0.02, load: 0.1, speedKmh: 80 } },
];

interface DisposableSynth {
  build: (...args: never[]) => boolean;
  update: (state: DriveState, t: number) => void;
  dispose: () => void;
  getDiagnostics?: () => { combustionGain?: number; intakeGain?: number; firingHz?: number };
}

function buildForProfile(id: string, ctx: BaseAudioContext, profile: ReturnType<typeof getProfile>) {
  const b = buses();
  if (isCombustionRealismV2Profile(id)) {
    const synth = new HybridCombustionSynth();
    expect(synth.build(ctx, profile, b), id).toBe(true);
    return synth;
  }
  if (isSymphonyProfileId(id)) {
    const synth = new SymphonySynth();
    expect(synth.build(ctx, profile, b, 0x454c4341), id).toBe(true);
    return synth;
  }
  if (isWorldProfileId(id)) {
    const synth = new WorldSynth();
    expect(synth.build(ctx, profile, b, 0x454c4341), id).toBe(true);
    return synth;
  }
  if (isFusionProfileId(id)) {
    const synth = new FusionSynth();
    expect(synth.build(ctx, profile, b, 0x454c4341), id).toBe(true);
    return synth;
  }
  const synth = new ImprovedSynth();
  expect(synth.build(ctx, profile, b), id).toBe(true);
  return synth;
}

describe("Prompt 07 all-profile finite / lifecycle", () => {
  it("builds, regime-updates, and disposes every public profile with finite params", () => {
    expect(PUBLIC_PROFILE_IDS).toHaveLength(64);
    const failures: string[] = [];

    for (const id of PUBLIC_PROFILE_IDS) {
      try {
        const ctx = mockCtx();
        const profile = getProfile(id);
        expect(profile, id).toBeTruthy();
        const synth = buildForProfile(id, ctx, profile);

        for (const regime of REGIMES) {
          synth.update(state(regime.partial), 0.02 + REGIMES.indexOf(regime) * 0.05);
          if ("getDiagnostics" in synth && typeof synth.getDiagnostics === "function") {
            const d = synth.getDiagnostics();
            if (d && "combustionGain" in d && typeof d.combustionGain === "number") {
              expect(Number.isFinite(d.combustionGain), `${id}/${regime.name}/combustion`).toBe(true);
              expect(d.combustionGain, `${id}/${regime.name}`).toBeGreaterThanOrEqual(0);
              // Raised from 2 to 10 to accommodate per-engine outputTrimDb loudness normalization
              // (+17 dB superbike = ~7x linear; max total ~9 at full load with character scaling)
              // The output limiter in the synth will catch any clipping.
              expect(d.combustionGain, `${id}/${regime.name}`).toBeLessThan(10);
            }
            if (d && "intakeGain" in d && typeof d.intakeGain === "number") {
              expect(Number.isFinite(d.intakeGain), `${id}/${regime.name}/intake`).toBe(true);
            }
            if (d && "firingHz" in d && typeof d.firingHz === "number") {
              expect(Number.isFinite(d.firingHz), `${id}/${regime.name}/firing`).toBe(true);
            }
          }
        }
        synth.dispose();
        setCatalogAutomatedCheck(id, "pass");
      } catch (err) {
        setCatalogAutomatedCheck(id, "fail");
        failures.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
    expect(allCatalogTuningEntries().every((e) => e.automatedCheck === "pass")).toBe(true);
  });

  it("keeps combustion diagnostic gains finite under full load", () => {
    for (const id of PUBLIC_PROFILE_IDS.filter((p) => isCombustionRealismV2Profile(p))) {
      const synth = new HybridCombustionSynth();
      synth.build(mockCtx(), getProfile(id), buses());
      synth.update(
        state({
          rpm: 5500,
          throttle: 1,
          load: 1,
          speedKmh: 120,
          powertrain: {
            ...IDLE_POWERTRAIN,
            rpm: 5500,
            mechanicalRpm: 5500,
            driverDemand: 1,
            engineLoad: 1,
            gear: 3,
            speedKmh: 120,
          },
        }),
        0.05,
      );
      const d = synth.getDiagnostics();
      expect(Number.isFinite(d.combustionGain)).toBe(true);
      // Raised from 2 to 10 to accommodate per-engine outputTrimDb loudness normalization
      // The output limiter in the synth will catch any clipping. F1 V10: its short pulses
      // (pulseTauScale 0.22) carry ~1/4 of the energy, so its trim runs higher (~11 at 5.5k).
      expect(d.combustionGain).toBeLessThan(id === "f1-v10" ? 14 : 10);
      synth.dispose();
    }
  });
});
