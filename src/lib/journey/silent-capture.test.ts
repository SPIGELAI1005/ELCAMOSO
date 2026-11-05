import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const order: string[] = [];
let peakValue = 0.4;

vi.mock("@/lib/symphony/adaptive", () => ({
  preloadMusicBank: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 5));
    order.push("bank-loaded");
  }),
}));

vi.mock("@/lib/sound/engine", () => ({
  SoundEngine: class {
    setRenderTime() {}
    async start() {
      order.push("engine-start");
    }
    setCabinEq() {}
    setVolume() {}
    async whenSamplesReady() {
      order.push("samples-ready");
    }
    update() {
      if (!order.includes("first-update")) order.push("first-update");
    }
    async stop() {}
  },
}));

import { AdaptiveTraceSampler } from "@/lib/journey-trace/sampler";
import { mergeChunksIntoTrace } from "@/lib/journey-trace/repository";
import type {
  JourneyTraceChunkV1,
  JourneyTraceSampleV1,
  JourneyTraceV1,
} from "@/lib/journey-trace/types";
import { IDLE_VEHICLE_MOTION, type VehicleMotionState } from "@/lib/motion/types";
import {
  buildDriveChart,
  buildSongDriveStatesFromTrace,
  renderDriveSong,
  SilentRenderError,
  songToSourceSec,
  sourceToSongSec,
} from "@/lib/journey";
import type { DriveSongMeta, JourneySummary } from "@/lib/journey";

function motion(partial: Partial<VehicleMotionState>): VehicleMotionState {
  return { ...IDLE_VEHICLE_MOTION, timestamp: Date.now(), ...partial };
}

function sample(t: number, speedKmh: number, acceleration: number): JourneyTraceSampleV1 {
  return {
    t,
    speedKmh,
    acceleration,
    longitudinalAccel: acceleration,
    jerk: 0,
    driverDemandEstimate: Math.max(0, acceleration / 3),
    regenEstimate: Math.max(0, -acceleration / 3.5),
    movementConfidence: 1,
    sourceQuality: 1,
    primarySource: "simulator",
  };
}

/** 6 min simulated drive: launch, cruise, hard brake, stop, launch again. */
function simulatedTrace(): JourneyTraceV1 {
  const samples: JourneyTraceSampleV1[] = [];
  let v = 0;
  for (let t = 0; t <= 360_000; t += 200) {
    const s = t / 1000;
    let a = 0;
    if (s < 15) a = 2.6;
    else if (s < 120) a = s < 30 ? 0.3 : 0;
    else if (s < 135) a = -3.2;
    else if (s < 150) a = v > 0 ? -1 : 0;
    else if (s < 170) a = 2.2;
    v = Math.max(0, v + a * 0.2);
    samples.push(sample(t, Math.round(v * 3.6 * 10) / 10, v <= 0 && a < 0 ? 0 : a));
  }
  return {
    version: 1,
    journeyId: "sim-1",
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_360_000,
    durationMs: 360_000,
    outputMode: "capture",
    captureProfileId: null,
    status: "complete",
    samples,
    semanticEvents: [],
    gaps: [{ startT: 200_000, endT: 230_000, reason: "browser_suspend" }],
    summary: {
      sampleCount: samples.length,
      durationMs: 360_000,
      distanceM: 3000,
      meanSpeedKmh: 40,
      maxSpeedKmh: 120,
      movingShare: 0.9,
      gapCount: 1,
      gapMs: 30_000,
      primarySource: "simulator",
      endedUnexpectedly: false,
      browserPaused: true,
    },
  };
}

const song: DriveSongMeta = {
  title: "Test",
  symphonyPackId: "symphony-cinematic-rock",
  seed: 1,
  durationSec: 60,
  sections: [
    { chapter: "INTRO", sourceStartSec: 0, sourceEndSec: 20, songStartSec: 0, songEndSec: 20, intensity: 0.5 },
    { chapter: "PEAK", sourceStartSec: 100, sourceEndSec: 140, songStartSec: 20, songEndSec: 60, intensity: 1 },
  ],
} as unknown as DriveSongMeta;

describe("silent capture: sampler persistence", () => {
  let now = 1_700_000_000_000;
  beforeEach(() => {
    now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

  it("persists every sample across chunks (no 48-sample truncation)", () => {
    const chunks: JourneyTraceSampleV1[][] = [];
    const sampler = new AdaptiveTraceSampler({
      journeyId: "j",
      startedAt: now,
      outputMode: "capture",
      captureProfileId: null,
      onChunk: (_i, samples) => chunks.push(samples),
    });
    let perf = 0;
    for (let i = 0; i < 400; i++) {
      now += 100;
      perf += 100;
      sampler.pushMotion(motion({ speedKmh: 30 + (i % 40), accelerationFiltered: 1.2 }), 0.1, perf);
    }
    const trace = sampler.finalize();
    const persisted = chunks.flat();
    expect(trace.samples.length).toBeGreaterThan(300);
    expect(persisted.length).toBe(trace.samples.length);
    expect(new Set(persisted.map((s) => s.t)).size).toBe(persisted.length);
  });

  it("records a gap when samples stop arriving (hidden page / frozen timers)", () => {
    const gaps: unknown[] = [];
    const sampler = new AdaptiveTraceSampler({
      journeyId: "j",
      startedAt: now,
      outputMode: "capture",
      captureProfileId: null,
      onChunk: (_i, _s, extras) => gaps.push(...extras.gaps),
    });
    let perf = 0;
    const step = (ms: number) => {
      now += ms;
      perf += ms;
      sampler.pushMotion(motion({ speedKmh: 50 }), ms / 1000, perf);
    };
    for (let i = 0; i < 20; i++) step(250);
    step(45_000); // page frozen for 45 s
    for (let i = 0; i < 20; i++) step(250);
    const trace = sampler.finalize();
    expect(trace.gaps).toHaveLength(1);
    expect(trace.gaps[0]!.endT - trace.gaps[0]!.startT).toBe(45_000);
    expect(trace.semanticEvents.some((e) => e.type === "data_gap")).toBe(true);
    expect(gaps).toHaveLength(1);
    // distance does not integrate across the gap (50 km/h * ~10 s ≈ 139 m, not 760 m)
    expect(trace.summary.distanceM).toBeLessThan(200);
  });
});

describe("silent capture: crash recovery merge", () => {
  it("rebuilds a recording trace from its chunks", () => {
    const base = simulatedTrace();
    const recording: JourneyTraceV1 = { ...base, status: "recording", samples: [], gaps: [] };
    const chunks: JourneyTraceChunkV1[] = [
      { journeyId: "sim-1", chunkIndex: 1, samples: base.samples.slice(900), events: [], gaps: base.gaps, writtenAt: 2 },
      { journeyId: "sim-1", chunkIndex: 0, samples: base.samples.slice(0, 900), events: [{ t: 0, type: "movement_start" }], gaps: [], writtenAt: 1 },
    ];
    const merged = mergeChunksIntoTrace(recording, chunks);
    expect(merged.samples).toHaveLength(base.samples.length);
    expect(merged.samples[0]!.t).toBe(0);
    expect(merged.gaps).toHaveLength(1);
    expect(merged.summary.maxSpeedKmh).toBeGreaterThan(100);
    expect(merged.semanticEvents[0]!.type).toBe("movement_start");
  });
});

describe("silent capture: drive chart + song mapping", () => {
  it("marks launch, braking, top speed and maps them into the song", () => {
    const chart = buildDriveChart(simulatedTrace(), song);
    const kinds = chart.moments.map((m) => m.kind);
    expect(kinds).toContain("launch");
    expect(kinds).toContain("braking");
    expect(kinds).toContain("top-speed");
    expect(chart.points.length).toBeLessThanOrEqual(241);
    expect(chart.gaps).toHaveLength(1);
    const braking = chart.moments.find((m) => m.kind === "braking")!;
    expect(braking.t).toBeGreaterThanOrEqual(120);
    expect(braking.songSec).not.toBeNull();
  });

  it("maps song time to drive time and back", () => {
    expect(songToSourceSec(song, 40)).toBeCloseTo(120);
    expect(sourceToSongSec(song.sections, 120)).toBeCloseTo(40);
    expect(sourceToSongSec(song.sections, 60)).toBeNull();
  });

  it("drives the song from the real recorded speed", () => {
    const states = buildSongDriveStatesFromTrace(song, simulatedTrace(), 10);
    expect(states).toHaveLength(600);
    // song 0-20 s = drive 0-20 s (launch), song 20-60 = drive 100-140 (cruise then hard braking)
    expect(states[5]!.acceleration).toBeGreaterThan(2);
    const braking = states.slice(450, 590);
    expect(braking.some((s) => s.regen > 0.5)).toBe(true);
    expect(Math.max(...states.map((s) => s.speed))).toBeGreaterThan(25);
  });
});

describe("silent capture: offline render", () => {
  class FakeOfflineCtx {
    sampleRate: number;
    length: number;
    constructor(_ch: number, length: number, rate: number) {
      this.length = length;
      this.sampleRate = rate;
    }
    async startRendering() {
      order.push("render");
      const data = new Float32Array(this.length);
      data.fill(peakValue, 1000, 1100);
      return {
        numberOfChannels: 2,
        length: this.length,
        sampleRate: this.sampleRate,
        duration: this.length / this.sampleRate,
        getChannelData: () => data,
      };
    }
  }
  beforeEach(() => {
    order.length = 0;
    vi.stubGlobal("OfflineAudioContext", FakeOfflineCtx);
  });
  afterEach(() => vi.unstubAllGlobals());

  const journey = { energyTimeline: [{ t: 0, e: 0.5 }] } as unknown as JourneySummary;

  it("waits for the music samples before rendering (root cause of silent songs)", async () => {
    peakValue = 0.4;
    const blob = await renderDriveSong(journey, { ...song, durationSec: 30 }, { trace: simulatedTrace() });
    expect(blob.size).toBeGreaterThan(44);
    expect(order.indexOf("bank-loaded")).toBeLessThan(order.indexOf("first-update"));
    expect(order.indexOf("samples-ready")).toBeLessThan(order.indexOf("first-update"));
    expect(order.indexOf("first-update")).toBeLessThan(order.indexOf("render"));
  });

  it("refuses to hand back a silent file", async () => {
    peakValue = 0;
    await expect(renderDriveSong(journey, { ...song, durationSec: 30 })).rejects.toBeInstanceOf(
      SilentRenderError,
    );
  });
});
