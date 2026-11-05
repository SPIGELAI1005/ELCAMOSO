import { describe, expect, it, vi } from "vitest";
import { bankFullyDucksSynth } from "./hybrid-combustion-synth";
import { RECORDED_LOOP_BANKS, RECORDED_LOOP_BANKS_BY_PROFILE } from "./recorded-loops";
import { loadRecordedLoopBuffers } from "./recorded-loops-loader";

vi.mock("@/lib/sound/fetch-bytes", () => ({
  fetchBytesWithRetry: vi.fn(async () => new ArrayBuffer(8)),
}));

describe("recorded loop cost on car browsers", () => {
  it("decodes a shared file once for all sources that cut regions from it", async () => {
    const bank = RECORDED_LOOP_BANKS_BY_PROFILE["ge-squared"]!;
    const decodeAudioData = vi.fn(async () => ({ length: 1 }) as unknown as AudioBuffer);
    const out = await loadRecordedLoopBuffers(
      { decodeAudioData } as unknown as BaseAudioContext,
      bank,
    );
    const urls = new Set([...bank.sources.map((s) => s.url), bank.backfire!.url]);
    expect(decodeAudioData).toHaveBeenCalledTimes(urls.size);
    expect(out.size).toBe(bank.sources.length + 1);
    const first = out.get(bank.sources[0]!.id);
    for (const s of bank.sources) expect(out.get(s.id)).toBe(first);
  });

  it("parks the silent synth only for banks that duck it fully", () => {
    expect(bankFullyDucksSynth(RECORDED_LOOP_BANKS_BY_PROFILE["ge-squared"])).toBe(true);
    expect(bankFullyDucksSynth(RECORDED_LOOP_BANKS_BY_PROFILE["ge-squared-90"])).toBe(true);
    expect(bankFullyDucksSynth(RECORDED_LOOP_BANKS_BY_PROFILE["traby"])).toBe(false);
    for (const id of ["american-v8", "gt-v8", "f1-v10"]) {
      expect(bankFullyDucksSynth(RECORDED_LOOP_BANKS[id])).toBe(false);
    }
  });
});
