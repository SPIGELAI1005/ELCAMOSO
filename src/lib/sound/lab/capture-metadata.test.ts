import { describe, expect, it } from "vitest";
import {
  LAB_HARNESS_REVISION,
  LAB_RENDERER_FAMILY,
  assertLabCaptureMetadata,
  buildLabCaptureMetadata,
} from "@/lib/sound/lab/capture-metadata";
import { analyseLabSignal } from "@/lib/sound/lab/metrics";
import { allPendingBaselineReports, buildPendingBaselineReport } from "@/lib/sound/lab/baseline-report";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import { levelMatchGainDb } from "@/lib/sound/lab/render-harness";

describe("audio lab capture metadata", () => {
  it("builds privacy-safe metadata with harness revision", () => {
    const meta = buildLabCaptureMetadata({
      profileId: "gt-v8",
      fixtureId: "idle",
      fixtureKind: "speed-driven",
      rendererBackend: "realism-v2",
      excitationMode: "worklet",
      capturePath: "offline-audio-context",
      sampleRate: 48_000,
      durationSeconds: 4,
      settings: {
        volume: 0.7,
        measurementGain: 1,
        realismEngine: "v2",
        synthesisMode: "improved",
        experienceTuningEnabled: true,
        seed: 0x454c4341,
      },
    });
    assertLabCaptureMetadata(meta);
    expect(meta.harnessRevision).toBe(LAB_HARNESS_REVISION);
    expect(meta.rendererFamily).toBe(LAB_RENDERER_FAMILY);
    expect(meta.privacy.locationPersisted).toBe(false);
    expect(meta.privacy.emailPersisted).toBe(false);
    expect(meta.limitations.some((line) => line.includes("certified LUFS"))).toBe(true);
  });

  it("rejects metadata that claims location persistence", () => {
    const meta = buildLabCaptureMetadata({
      profileId: "gt-v8",
      fixtureId: "idle",
      fixtureKind: "speed-driven",
      rendererBackend: "x",
      excitationMode: null,
      capturePath: "offline-audio-context",
      sampleRate: 48_000,
      durationSeconds: 1,
      settings: {
        volume: 0.7,
        measurementGain: 1,
        realismEngine: "v2",
        synthesisMode: "improved",
        experienceTuningEnabled: true,
        seed: 1,
      },
    });
    const bad = {
      ...meta,
      privacy: { locationPersisted: true as unknown as false, emailPersisted: false as const },
    };
    expect(() => assertLabCaptureMetadata(bad)).toThrow(/location or email/);
  });

  it("computes finite metrics for a silent buffer", () => {
    const silent = [new Float32Array(2048), new Float32Array(2048)];
    const metrics = analyseLabSignal(silent, 48_000);
    expect(metrics.nanCount).toBe(0);
    expect(metrics.infinityCount).toBe(0);
    expect(metrics.samplePeak).toBe(0);
    expect(metrics.loudnessLabel).toContain("not-certified-lufs");
    expect(metrics.truePeakLabel).toContain("sample-peak-only");
    expect(metrics.bandEnergy.length).toBeGreaterThan(0);
  });

  it("builds a pending baseline report for every real catalog ID", () => {
    const reports = allPendingBaselineReports();
    expect(reports).toHaveLength(SOUND_PROFILES.length);
    expect(reports.every((report) => report.measured.status === "pending")).toBe(true);
    expect(buildPendingBaselineReport("neon-drive").codeEvidence.length).toBeGreaterThan(0);
  });

  it("level-match gain never recommends boosting into clip", () => {
    const gain = levelMatchGainDb(-18, -24, -0.5);
    expect(gain).toBeLessThanOrEqual(-1 - -0.5 + 1e-9);
  });
});
