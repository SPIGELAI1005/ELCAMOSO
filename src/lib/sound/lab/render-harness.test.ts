import { describe, expect, it } from "vitest";
import { assertLabCaptureMetadata } from "@/lib/sound/lab/capture-metadata";
import { renderLabOffline } from "@/lib/sound/lab/render-harness";

const OfflineCtx =
  globalThis.OfflineAudioContext ??
  (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
    .webkitOfflineAudioContext;

describe("audio lab render harness", () => {
  it.skipIf(!OfflineCtx)(
    "renders a short production-engine offline capture with metadata",
    async () => {
      const result = await renderLabOffline({
        profileId: "gt-v8",
        fixtureId: "idle",
        includeSpectrum: false,
      });
      assertLabCaptureMetadata(result.metadata);
      expect(result.metadata.profileId).toBe("gt-v8");
      expect(result.metadata.fixtureId).toBe("idle");
      expect(result.metadata.rendererFamily).toBe("production-SoundEngine");
      expect(result.wavBase64.length).toBeGreaterThan(100);
      expect(result.metrics.nanCount).toBe(0);
      expect(result.metrics.infinityCount).toBe(0);
      expect(Number.isFinite(result.metrics.spectralCentroidHz)).toBe(true);
    },
    60_000,
  );
});
