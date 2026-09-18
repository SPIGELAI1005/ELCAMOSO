import { afterEach, describe, expect, it } from "vitest";
import {
  __setJourneyRepositoryForTests,
  type JourneyRepository,
  type JourneyTraceV1,
} from "@/lib/journey-trace";
import { importNativeJourneys } from "./native-import";
import type { MotionCaptureProvider } from "./types";

function trace(status: JourneyTraceV1["status"] = "complete"): JourneyTraceV1 {
  return {
    version: 1,
    journeyId: "native-1",
    startedAt: 1_000,
    endedAt: 2_000,
    durationMs: 1_000,
    outputMode: "capture",
    captureProfileId: "gt-v8",
    status,
    samples: [],
    semanticEvents: status === "incomplete" ? [{ t: 900, type: "data_gap" }] : [],
    gaps: status === "incomplete" ? [{ startT: 900, endT: 1_000, reason: "sensor_loss" }] : [],
    summary: {
      sampleCount: 0,
      durationMs: 1_000,
      distanceM: 0,
      meanSpeedKmh: 0,
      maxSpeedKmh: 0,
      movingShare: 0,
      gapCount: status === "incomplete" ? 1 : 0,
      gapMs: status === "incomplete" ? 100 : 0,
      primarySource: "none",
      endedUnexpectedly: status === "incomplete",
      browserPaused: false,
    },
  };
}

function repository() {
  const rows = new Map<string, JourneyTraceV1>();
  const repo: JourneyRepository = {
    createJourney: async (value) => void rows.set(value.journeyId, value),
    appendChunk: async () => undefined,
    finalizeJourney: async (value) => void rows.set(value.journeyId, value),
    loadJourney: async (id) => rows.get(id) ?? null,
    listJourneys: async () => [...rows.values()],
    deleteJourney: async (id) => void rows.delete(id),
    cleanupIncompleteJourney: async (id) => void rows.delete(id),
    getActiveJourneyId: async () => null,
    setActiveJourneyId: async () => undefined,
    saveInterpretation: async () => undefined,
    listInterpretations: async () => [],
  };
  return { repo, rows };
}

function provider(pending: JourneyTraceV1[]) {
  const acknowledged: string[] = [];
  const value: MotionCaptureProvider = {
    platform: "native",
    ownsJourneyPersistence: true,
    start: async () => undefined,
    stop: async () => null,
    getStatus: async () => ({
      active: false,
      backgroundCapable: true,
      startedAt: null,
      durationMs: 0,
      sampleCount: 0,
      distanceM: 0,
      quality: "balanced",
      detail: "reduced",
      permission: "granted",
    }),
    drainCompletedJourneys: async () => pending,
    acknowledgeJourneys: async (ids) => void acknowledged.push(...ids),
    dispose: () => undefined,
  };
  return { value, acknowledged };
}

afterEach(() => __setJourneyRepositoryForTests(null));

describe("native JourneyTrace import", () => {
  it("imports and acknowledges a recovered partial journey", async () => {
    const memory = repository();
    __setJourneyRepositoryForTests(memory.repo);
    const native = provider([trace("incomplete")]);

    const result = await importNativeJourneys(native.value);

    expect(result.importedIds).toEqual(["native-1"]);
    expect(result.recoveredIds).toEqual(["native-1"]);
    expect(memory.rows.get("native-1")?.status).toBe("incomplete");
    expect(native.acknowledged).toEqual(["native-1"]);
  });

  it("deduplicates an already-imported journey and still acknowledges native storage", async () => {
    const memory = repository();
    const existing = trace();
    memory.rows.set(existing.journeyId, existing);
    __setJourneyRepositoryForTests(memory.repo);
    const native = provider([existing]);

    const result = await importNativeJourneys(native.value);

    expect(result.importedIds).toEqual([]);
    expect(memory.rows.size).toBe(1);
    expect(native.acknowledged).toEqual(["native-1"]);
  });

  it("rejects a native payload containing route coordinates", async () => {
    const memory = repository();
    __setJourneyRepositoryForTests(memory.repo);
    const unsafe = { ...trace(), latitude: 52.5 } as JourneyTraceV1;
    const native = provider([unsafe]);

    const result = await importNativeJourneys(native.value);

    expect(result.importedIds).toEqual([]);
    expect(memory.rows.size).toBe(0);
    expect(native.acknowledged).toEqual([]);
  });
});
