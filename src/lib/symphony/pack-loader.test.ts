import { describe, expect, it } from "vitest";
import {
  SYMPHONY_LOAD_FAILURE_COPY,
  clearSymphonyBufferCache,
  loadSymphonyPackBuffers,
} from "./pack-loader";

const OfflineCtor =
  globalThis.OfflineAudioContext ??
  (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
    .webkitOfflineAudioContext;

describe("symphony pack loader", () => {
  it("exposes user-facing failure copy", () => {
    expect(SYMPHONY_LOAD_FAILURE_COPY).toBe("Music couldn't load.");
  });

  it("fails closed for unknown pack ids without needing real audio", async () => {
    const stub = { sampleRate: 48000 } as unknown as BaseAudioContext;
    clearSymphonyBufferCache();
    const result = await loadSymphonyPackBuffers(stub, "symphony-does-not-exist");
    expect(result.buffers.size).toBe(0);
    expect(result.errors).toContain("unknown-pack");
    expect(result.degraded).toBe(true);
  });

  it.skipIf(!OfflineCtor)("loads procedural buffers for known packs without WAV", async () => {
    clearSymphonyBufferCache();
    const ctx = new OfflineCtor!(2, 48000, 48000);
    const progress: string[] = [];
    const result = await loadSymphonyPackBuffers(ctx, "symphony-cinematic-rock", {
      onProgress: (p) => progress.push(p.phase),
    });
    expect(result.buffers.size).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);
    expect(progress.at(-1)).toBe("ready");
  });
});
