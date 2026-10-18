import { describe, expect, it } from "vitest";
import { getLongNoiseBuffer, getNoiseBuffer } from "./noise";

function fakeCtx(): BaseAudioContext {
  return {
    sampleRate: 48000,
    createBuffer: (ch: number, len: number) => {
      const data = new Float32Array(len);
      return { length: len, numberOfChannels: ch, getChannelData: () => data };
    },
  } as unknown as BaseAudioContext;
}

describe("getLongNoiseBuffer", () => {
  it("builds a dedicated, cached buffer of the requested length", () => {
    const ctx = fakeCtx();
    const long = getLongNoiseBuffer(ctx, "brown", 11);
    expect(long.length).toBe(48000 * 11);
    expect(getLongNoiseBuffer(ctx, "brown", 11)).toBe(long);
    expect(getNoiseBuffer(ctx, "brown")).not.toBe(long);
    expect(getNoiseBuffer(ctx, "brown").length).toBe(48000 * 3);
  });
});
