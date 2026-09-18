import { describe, expect, it } from "vitest";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import type { DriveTrace } from "@/lib/drive/traces";
import { summarise } from "@/lib/drive/traces";
import type { JourneyTraceV1 } from "@/lib/journey-trace";
import {
  buildJourneySharePayload,
  composeDriveSong,
  computeDriveDna,
  encodeJourneyShare,
  decodeJourneyShare,
  journeyContainsCoordinates,
  summariseJourneyFromTrace,
  summariseJourneyFromJourneyTrace,
} from "@/lib/journey";

function sample(partial: Partial<DriveState>, t: number): DriveState {
  return {
    ...IDLE_STATE,
    timestamp: t,
    ...partial,
  };
}

function makeTrace(durationSec: number, profileId = "gt-v8"): DriveTrace {
  const samples: DriveState[] = [];
  const n = Math.max(20, Math.floor(durationSec * 5));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const speed = u < 0.1 ? u * 40 : u < 0.7 ? 12 + Math.sin(u * 8) * 3 : 12 * (1 - u);
    const throttle = u > 0.15 && u < 0.55 ? 0.55 + Math.sin(u * 20) * 0.2 : 0.15;
    const regen = u > 0.75 ? 0.5 : 0;
    samples.push(
      sample(
        {
          speed,
          throttle,
          regen,
          load: Math.min(1, throttle * 0.7 + speed / 30),
          acceleration: throttle * 2 - regen * 2,
          accelerationNormalized: Math.min(1, Math.abs(throttle * 2 - regen) / 4),
          speedNormalized: Math.min(1, speed / 44),
          gear: u < 0.3 ? 2 : u < 0.6 ? 3 : 4,
        },
        i * 200,
      ),
    );
  }
  const durationMs = durationSec * 1000;
  return {
    id: `trace-test-${durationSec}`,
    startedAt: 1_700_000_000_000,
    durationMs,
    profileId,
    samples,
    aggregates: summarise(samples, durationMs),
  };
}

describe("JourneyComposer privacy", () => {
  it("builds a journey without GPS coordinates", () => {
    const journey = summariseJourneyFromTrace(makeTrace(600));
    expect(journeyContainsCoordinates(journey)).toBe(false);
    expect(journey.energyTimeline.length).toBeGreaterThan(5);
    expect(journey.dna.archetype.length).toBeGreaterThan(0);
  });

  it("works for short 3-minute drives", () => {
    const journey = summariseJourneyFromTrace(makeTrace(180));
    const song = composeDriveSong(journey);
    expect(song.sections.length).toBe(7);
    expect(song.durationSec).toBeGreaterThanOrEqual(90);
    expect(song.durationSec).toBeLessThanOrEqual(180);
  });

  it("creates a composer summary for the same Silent Capture journey", () => {
    const source = makeTrace(180);
    const trace: JourneyTraceV1 = {
      version: 1,
      journeyId: "jt-silent-song",
      startedAt: source.startedAt,
      endedAt: source.startedAt + source.durationMs,
      durationMs: source.durationMs,
      outputMode: "capture",
      captureProfileId: "gt-v8",
      status: "complete",
      samples: source.samples.map((state, index) => ({
        t: index * 200,
        speedKmh: state.speed * 3.6,
        acceleration: state.acceleration,
        longitudinalAccel: state.acceleration,
        jerk: state.jerk,
        driverDemandEstimate: state.throttle,
        regenEstimate: state.regen,
        movementConfidence: 1,
        sourceQuality: 1,
        primarySource: "phone",
      })),
      semanticEvents: [{ t: 1000, type: "movement_start" }],
      gaps: [],
      summary: {
        sampleCount: source.samples.length,
        durationMs: source.durationMs,
        distanceM: 2300,
        meanSpeedKmh: source.aggregates.meanSpeedMps * 3.6,
        maxSpeedKmh: source.aggregates.maxSpeedMps * 3.6,
        movingShare: 0.9,
        gapCount: 0,
        gapMs: 0,
        primarySource: "phone",
        endedUnexpectedly: false,
        browserPaused: false,
      },
    };
    const journey = summariseJourneyFromJourneyTrace(trace);
    expect(journey.id).toBe(trace.journeyId);
    expect(journey.distanceM).toBe(2300);
    expect(journeyContainsCoordinates(journey)).toBe(false);
    expect(composeDriveSong(journey).durationSec).toBeLessThanOrEqual(180);
  });

  it("condenses long drives to ~2–3 minutes", () => {
    const journey = summariseJourneyFromTrace(makeTrace(40 * 60));
    const song = composeDriveSong(journey);
    expect(song.durationSec).toBeLessThanOrEqual(180);
    expect(song.sections.some((s) => s.chapter === "PEAK")).toBe(true);
  });

  it("same seed + journey yields deterministic structure", () => {
    const journey = summariseJourneyFromTrace(makeTrace(900), { seed: 42 });
    const a = composeDriveSong(journey, { seed: 42 });
    const b = composeDriveSong(journey, { seed: 42 });
    expect(a.sections).toEqual(b.sections);
    expect(a.title).toEqual(b.title);
  });

  it("share payload only allows disclosed fields", () => {
    const journey = summariseJourneyFromTrace(makeTrace(400), { seed: 7 });
    journey.song = composeDriveSong(journey);
    const payload = buildJourneySharePayload(journey);
    expect(payload).toBeTruthy();
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/latitude|longitude|gps|polyline/i);
    expect(payload!.dna).toBeTruthy();
    expect(payload!.sections.length).toBeGreaterThan(0);
    const round = decodeJourneyShare(encodeJourneyShare(payload!));
    expect(round?.title).toBe(payload!.title);
  });

  it("rejects untrusted share payloads that smuggle coordinates", () => {
    const smuggled = {
      v: 1 as const,
      kind: "drive-song" as const,
      title: "x",
      experienceName: "Engine",
      experienceKind: "engine" as const,
      dna: {
        energy: 10,
        flow: 10,
        rhythm: 10,
        variation: 10,
        regen: 10,
        archetype: "Steady cruise",
      },
      symphonyPackId: "symphony-cinematic-rock",
      seed: 1,
      sections: [],
      energyTimeline: [],
      latitude: 48.1,
      longitude: 11.5,
    };
    const encoded = encodeJourneyShare(smuggled as never);
    expect(decodeJourneyShare(encoded)).toBeNull();
  });

  it("Drive DNA stays within 0–100 and is non-judgmental", () => {
    const dna = computeDriveDna({
      energyTimeline: [
        { t: 0, energy: 0.1 },
        { t: 10, energy: 0.6 },
        { t: 20, energy: 0.4 },
      ],
      throttleShare: 0.4,
      regenShare: 0.2,
      durationMs: 600000,
      meanSpeedMps: 15,
    });
    for (const k of ["energy", "flow", "rhythm", "variation", "regen"] as const) {
      expect(dna[k]).toBeGreaterThanOrEqual(0);
      expect(dna[k]).toBeLessThanOrEqual(100);
    }
    expect(dna.archetype).not.toMatch(/safe|unsafe|good|bad|aggressive/i);
  });
});
