import { describe, expect, it, beforeEach } from "vitest";
import {
  BoundedDecodedBufferCache,
  applyEqualPowerShape,
  boundedPlaybackRate,
  buildRecordingRequestManifest,
  COMBUSTION_SAMPLE_PROFILE_IDS,
  crossfadeWeights,
  HybridSampleLoader,
  missingRequiredAssetIds,
  resetSharedSampleCacheForTests,
  resetSharedSampleLoaderForTests,
  sampleAssetStatusForProfile,
  validateHybridRecordingEntry,
} from "@/lib/sound/realism/samples";
import type { HybridRecordingManifestEntry } from "@/lib/sound/realism/samples/types";
import { selectSampleMix, type CombustionSampleBank } from "@/lib/sound/realism/v2/sample-bank";

function mockBuffer(seconds = 1, channels = 1, sampleRate = 48_000): AudioBuffer {
  const length = Math.floor(seconds * sampleRate);
  const channelData = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    duration: seconds,
    length,
    numberOfChannels: channels,
    sampleRate,
    getChannelData(ch: number) {
      return channelData[ch] ?? channelData[0]!;
    },
    copyFromChannel() {},
    copyToChannel() {},
  } as unknown as AudioBuffer;
}

function approvedEntry(
  overrides: Partial<HybridRecordingManifestEntry> = {},
): HybridRecordingManifestEntry {
  return {
    assetId: "gt-v8__idle",
    profileId: "gt-v8",
    familyId: "gt-v8",
    regime: "idle",
    sourceRpm: 800,
    loadAnchor: 0.05,
    micPerspective: "exhaust-near",
    loopStartSeconds: 0.2,
    loopEndSeconds: 2.2,
    gainTrimDb: -1.5,
    sampleRateHz: 48_000,
    channelFormat: "mono",
    assetPath: "personalities/gt-v8/idle.wav",
    license: {
      sourceRecord: "commission-session-001",
      licenseRecord: "elcamoso-license-001",
      approval: "approved",
      commercialWebInteractive: true,
      clientExtractableAcknowledged: true,
    },
    checksumSha256: "a".repeat(64),
    permittedPlaybackRate: { min: 0.88, max: 1.14 },
    steadyState: true,
    acquisitionPriority: 2,
    notes: "fixture",
    ...overrides,
  };
}

describe("hybrid recording manifest validation", () => {
  it("accepts awaiting-asset slots without inventing paths", () => {
    const manifest = buildRecordingRequestManifest("american-muscle-v8");
    expect(manifest.status).toBe("awaiting-assets");
    expect(manifest.entries.every((e) => e.assetPath === null)).toBe(true);
    for (const entry of manifest.entries) {
      const result = validateHybridRecordingEntry(entry);
      expect(result.ok).toBe(true);
      expect(result.runtimeReady).toBe(false);
    }
  });

  it("requires full provenance before runtime readiness", () => {
    const ready = validateHybridRecordingEntry(approvedEntry());
    expect(ready.runtimeReady).toBe(true);
    const rejected = validateHybridRecordingEntry(
      approvedEntry({
        license: {
          sourceRecord: "x",
          licenseRecord: "y",
          approval: "approved",
          commercialWebInteractive: false,
          clientExtractableAcknowledged: true,
        },
      }),
    );
    expect(rejected.runtimeReady).toBe(false);
    expect(rejected.errors.some((e) => e.includes("commercialWebInteractive"))).toBe(true);
  });

  it("rejects absurd playback-rate windows that imply free-rev stretch", () => {
    const result = validateHybridRecordingEntry(
      approvedEntry({ permittedPlaybackRate: { min: 0.2, max: 4 } }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("bounded stretch", () => {
  it("returns playbackRate = target/source inside the window", () => {
    expect(boundedPlaybackRate(900, 800, { min: 0.88, max: 1.14 })).toBeCloseTo(1.125, 5);
    expect(boundedPlaybackRate(2000, 800, { min: 0.88, max: 1.14 })).toBeNull();
  });
});

describe("blend helpers", () => {
  it("provides equal-power as an option without claiming comb-free mixes", () => {
    const mid = crossfadeWeights(0.5, "equal-power");
    expect(mid.a).toBeCloseTo(Math.SQRT1_2, 5);
    expect(mid.b).toBeCloseTo(Math.SQRT1_2, 5);
    const shaped = applyEqualPowerShape([0.25, 0.75]);
    expect(shaped.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 6);
  });

  it("keeps linear mix as default for sample selection continuity", () => {
    const bank: CombustionSampleBank = {
      personalityId: "gt-v8",
      entries: [
        {
          assetId: "a",
          personalityId: "gt-v8",
          rpmRef: 2000,
          load: "medium",
          loadAnchor: 0.5,
          character: "on-load",
          permittedPlaybackRate: { min: 0.6, max: 1.6 },
        },
        {
          assetId: "b",
          personalityId: "gt-v8",
          rpmRef: 4000,
          load: "medium",
          loadAnchor: 0.5,
          character: "on-load",
          permittedPlaybackRate: { min: 0.6, max: 1.6 },
        },
      ],
    };
    const linear = selectSampleMix(bank, 2500, "medium", 0.5, "linear");
    const eq = selectSampleMix(bank, 2500, "medium", 0.5, "equal-power");
    expect(linear.targets).toHaveLength(2);
    expect(eq.targets).toHaveLength(2);
    expect(linear.targets[0]!.weight).toBeCloseTo(0.75, 5);
    expect(eq.targets[0]!.weight).not.toBeCloseTo(linear.targets[0]!.weight, 5);
  });
});

describe("bounded decoded cache cleanup", () => {
  beforeEach(() => {
    resetSharedSampleCacheForTests();
    resetSharedSampleLoaderForTests();
  });

  it("evicts LRU entries when over budget and retains only active ids", () => {
    const cache = new BoundedDecodedBufferCache(8_000);
    cache.set("a", mockBuffer(0.02));
    cache.set("b", mockBuffer(0.02));
    cache.set("c", mockBuffer(0.02));
    expect(cache.measure().entryCount).toBeLessThanOrEqual(3);
    expect(cache.measure().approxBytes).toBeLessThanOrEqual(8_000);
    const removed = cache.retainOnly(["b"]);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("a")).toBe(false);
    cache.clear();
    expect(cache.measure().entryCount).toBe(0);
  });
});

describe("unavailable assets and source-switch continuity", () => {
  beforeEach(() => {
    resetSharedSampleCacheForTests();
    resetSharedSampleLoaderForTests();
  });

  it("marks every combustion profile awaiting-assets while the catalog is empty", () => {
    for (const id of COMBUSTION_SAMPLE_PROFILE_IDS) {
      const snap = sampleAssetStatusForProfile(id);
      expect(snap.status).toBe("awaiting-assets");
      expect(snap.catalogEmpty).toBe(true);
      expect(snap.runtimeReadyCount).toBe(0);
      expect(missingRequiredAssetIds(buildRecordingRequestManifest(id)).length).toBeGreaterThan(0);
    }
  });

  it("ignores stale loader generations after a rapid selection change", async () => {
    const loader = new HybridSampleLoader();
    const genA = loader.invalidate();
    const genB = loader.invalidate();
    const ctx = {
      decodeAudioData: async () => mockBuffer(),
    } as unknown as BaseAudioContext;
    const result = await loader.loadManifestAssets(
      ctx,
      {
        version: 1,
        generatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        deliveryMode: "procedural_only",
        assets: [],
      },
      { generation: genA },
    );
    expect(result.stale).toBe(true);
    expect(result.generation).toBe(genA);
    expect(genB).toBeGreaterThan(genA);
    expect(result.buffers.size).toBe(0);
  });

  it("returns empty buffers for procedural_only without inventing recordings", async () => {
    const loader = new HybridSampleLoader();
    const generation = loader.invalidate();
    const result = await loader.loadManifestAssets(
      { decodeAudioData: async () => mockBuffer() } as unknown as BaseAudioContext,
      {
        version: 1,
        generatedAt: 0,
        expiresAt: 1,
        deliveryMode: "procedural_only",
        assets: [],
      },
      { generation },
    );
    expect(result.stale).toBe(false);
    expect(result.buffers.size).toBe(0);
    expect(result.failures.some((f) => f.reason === "empty")).toBe(true);
  });
});
