import { describe, expect, it, beforeEach } from "vitest";
import {
  AdaptiveTraceSampler,
  assertTracePrivacy,
  estimateTraceBytes,
  JourneyTraceReplaySource,
  energySamplesFromJourneyTrace,
  journeyReplaySeed,
  shouldCaptureTrace,
  shouldPlayLiveAudio,
  __setJourneyRepositoryForTests,
  type JourneyRepository,
  type JourneyTraceV1,
} from "@/lib/journey-trace";
import { IDLE_VEHICLE_MOTION, type VehicleMotionState } from "@/lib/motion/types";

function motion(partial: Partial<VehicleMotionState>): VehicleMotionState {
  return { ...IDLE_VEHICLE_MOTION, timestamp: Date.now(), ...partial };
}

function memoryRepo(): JourneyRepository & { store: Map<string, JourneyTraceV1> } {
  const store = new Map<string, JourneyTraceV1>();
  let active: string | null = null;
  return {
    store,
    async createJourney(trace) {
      store.set(trace.journeyId, trace);
      active = trace.journeyId;
    },
    async appendChunk(chunk) {
      const t = store.get(chunk.journeyId);
      if (!t) return;
      store.set(chunk.journeyId, {
        ...t,
        samples: t.samples.concat(chunk.samples),
      });
    },
    async finalizeJourney(trace) {
      store.set(trace.journeyId, trace);
      active = null;
    },
    async loadJourney(id) {
      return store.get(id) ?? null;
    },
    async listJourneys() {
      return [...store.values()];
    },
    async deleteJourney(id) {
      store.delete(id);
    },
    async cleanupIncompleteJourney(id) {
      store.delete(id);
    },
    async getActiveJourneyId() {
      return active;
    },
    async setActiveJourneyId(id) {
      active = id;
    },
    async saveInterpretation() {},
    async listInterpretations() {
      return [];
    },
  };
}

function makeReplayTrace(): JourneyTraceV1 {
  const s = new AdaptiveTraceSampler({
    journeyId: "jt-replay",
    startedAt: Date.now() - 4000,
    outputMode: "capture",
    captureProfileId: null,
  });
  for (let i = 0; i < 40; i++) {
    s.pushMotion(
      motion({
        speedKmh: 15 + i * 2.2,
        accelerationMs2: i < 24 ? 1.8 : -0.35,
        accelerationFiltered: i < 24 ? 1.8 : -0.35,
        inferredThrottle: i < 24 ? 0.78 : 0.12,
        primarySource: "phone",
        motionConfidence: 1,
      }),
      0.08,
      i * 90,
    );
  }
  return s.finalize();
}

describe("Silent Capture / JourneyTraceV1", () => {
  beforeEach(() => {
    __setJourneyRepositoryForTests(null);
  });

  it("mode helpers", () => {
    expect(shouldPlayLiveAudio("live")).toBe(true);
    expect(shouldPlayLiveAudio("capture")).toBe(false);
    expect(shouldCaptureTrace("capture")).toBe(true);
    expect(shouldCaptureTrace("live")).toBe(false);
    expect(shouldCaptureTrace("live-and-capture")).toBe(true);
  });

  it("samples adaptively and never invents lat/lon", () => {
    const s = new AdaptiveTraceSampler({
      journeyId: "jt-1",
      startedAt: Date.now() - 1000,
      outputMode: "capture",
      captureProfileId: null,
    });
    for (let i = 0; i < 40; i++) {
      s.pushMotion(
        motion({
          speedKmh: 40 + Math.sin(i / 3) * 5,
          accelerationMs2: i % 7 === 0 ? 2.2 : 0.1,
          accelerationFiltered: i % 7 === 0 ? 2.2 : 0.1,
          inferredThrottle: 0.4,
          motionConfidence: 0.9,
          primarySource: "phone",
        }),
        0.1,
        i * 90,
      );
    }
    const trace = s.finalize();
    expect(trace.samples.length).toBeGreaterThan(5);
    expect(assertTracePrivacy(trace)).toBe(true);
    expect(JSON.stringify(trace)).not.toMatch(/latitude|longitude/);
  });

  it("records visibility gaps without fabricating motion", () => {
    const s = new AdaptiveTraceSampler({
      journeyId: "jt-gap",
      startedAt: Date.now() - 5000,
      outputMode: "capture",
      captureProfileId: null,
    });
    s.pushMotion(motion({ speedKmh: 50, primarySource: "phone" }), 0.1);
    s.markBrowserPaused("visibility");
    s.markBrowserResumed();
    const trace = s.finalize();
    expect(trace.gaps.length).toBeGreaterThan(0);
    expect(trace.summary.browserPaused).toBe(true);
    expect(trace.semanticEvents.some((e) => e.type === "capture_paused")).toBe(true);
  });

  it("suggests finish only after long stationary", () => {
    const wall = Date.now();
    const s = new AdaptiveTraceSampler({
      journeyId: "jt-idle",
      startedAt: wall - 200_000,
      outputMode: "capture",
      captureProfileId: null,
    });
    s.pushMotion(motion({ speedKmh: 30, primarySource: "phone" }), 0.1, 0);
    s.pushMotion(motion({ speedKmh: 0, primarySource: "phone" }), 0.1, 200);
    expect(s.shouldSuggestFinish(wall + 10_000)).toBe(false);
    expect(s.shouldSuggestFinish(wall + 200_000)).toBe(true);
  });

  it("estimates storage for long drives", () => {
    const perHourAt12Hz = estimateTraceBytes(12 * 3600);
    expect(perHourAt12Hz).toBeGreaterThan(3_000_000);
    expect(perHourAt12Hz).toBeLessThan(8_000_000);
  });

  it("replays same trace with different engines (reinterpretation)", () => {
    const trace = makeReplayTrace();
    const a = new JourneyTraceReplaySource(trace, { profileId: "gt-v8" });
    const b = new JourneyTraceReplaySource(trace, { profileId: "racing-v10" });
    const frames = Array.from({ length: 28 }, () => ({ a: a.next(0.1), b: b.next(0.1) }));
    expect(frames.every((frame) => frame.a && frame.b)).toBe(true);
    expect(frames.every((frame) => frame.a!.speed === frame.b!.speed)).toBe(true);
    expect(
      frames.some(
        (frame) => frame.a!.gear !== frame.b!.gear || Math.abs(frame.a!.rpm - frame.b!.rpm) > 100,
      ),
    ).toBe(true);
  });

  it("seek, peek, and restart leave the replay scheduler deterministic", () => {
    const trace = makeReplayTrace();
    const replay = new JourneyTraceReplaySource(trace, { profileId: "gt-v8" });
    for (let i = 0; i < 12; i++) replay.next(0.1);

    replay.seekTo(900);
    const peekA = replay.peek();
    const peekB = replay.peek();
    expect(peekB).toEqual(peekA);

    const freshAtSeek = new JourneyTraceReplaySource(trace, { profileId: "gt-v8" });
    freshAtSeek.seekTo(900);
    expect(replay.next(0.1)).toEqual(freshAtSeek.next(0.1));

    replay.reset();
    const freshAtStart = new JourneyTraceReplaySource(trace, { profileId: "gt-v8" });
    expect(replay.next(0.1)).toEqual(freshAtStart.next(0.1));
  });

  it("does not invent Engine gears for non-transmission experiences", () => {
    const replay = new JourneyTraceReplaySource(makeReplayTrace(), {
      profileId: "symphony-cinematic-rock",
    });
    const frame = replay.next(0.1);
    expect(frame?.gear).toBe(0);
    expect(frame?.rpm).toBe(0);
  });

  it("derives a stable interpretation seed from the journey", () => {
    expect(journeyReplaySeed("journey-a")).toBe(journeyReplaySeed("journey-a"));
    expect(journeyReplaySeed("journey-a")).not.toBe(journeyReplaySeed("journey-b"));
  });

  it("Motion Signature energy samples from trace", () => {
    const s = new AdaptiveTraceSampler({
      journeyId: "jt-sig",
      startedAt: Date.now() - 2000,
      outputMode: "capture",
      captureProfileId: null,
    });
    for (let i = 0; i < 20; i++) {
      s.pushMotion(
        motion({ speedKmh: i * 3, inferredThrottle: i / 20, primarySource: "phone" }),
        0.1,
        i * 90,
      );
    }
    const trace = s.finalize();
    const energy = energySamplesFromJourneyTrace(trace, 12);
    expect(energy.length).toBeGreaterThan(0);
    expect(Math.max(...energy)).toBeLessThanOrEqual(1);
  });

  it("repository delete removes journey", async () => {
    const repo = memoryRepo();
    __setJourneyRepositoryForTests(repo);
    const s = new AdaptiveTraceSampler({
      journeyId: "jt-del",
      startedAt: Date.now(),
      outputMode: "capture",
      captureProfileId: null,
    });
    s.pushMotion(motion({ speedKmh: 10 }), 0.1);
    const trace = s.finalize();
    await repo.finalizeJourney(trace);
    expect(await repo.loadJourney("jt-del")).not.toBeNull();
    await repo.deleteJourney("jt-del");
    expect(await repo.loadJourney("jt-del")).toBeNull();
  });

  it("simulates 30 min and 2 h sample budgets", () => {
    const run = (minutes: number) => {
      const s = new AdaptiveTraceSampler({
        journeyId: `jt-${minutes}`,
        startedAt: Date.now() - minutes * 60_000,
        outputMode: "capture",
        captureProfileId: null,
      });
      const steps = minutes * 8; // representative density, not wall-clock
      for (let i = 0; i < steps; i++) {
        const cruise = i % 40 > 30;
        s.pushMotion(
          motion({
            speedKmh: cruise ? 0 : 55,
            accelerationMs2: cruise ? 0 : 0.2,
            accelerationFiltered: cruise ? 0 : 0.2,
            primarySource: "phone",
            motionConfidence: 0.95,
          }),
          0.1,
          i * 100,
        );
      }
      return s.finalize();
    };
    const half = run(30);
    const two = run(120);
    expect(half.samples.length).toBeGreaterThan(50);
    expect(two.samples.length).toBeGreaterThan(half.samples.length);
    expect(assertTracePrivacy(half)).toBe(true);
    expect(assertTracePrivacy(two)).toBe(true);
  });
});
