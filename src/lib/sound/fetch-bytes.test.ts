import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBytesWithRetry } from "./fetch-bytes";

afterEach(() => vi.unstubAllGlobals());

describe("fetchBytesWithRetry", () => {
  it("retries after a network error and then succeeds", async () => {
    const bytes = new ArrayBuffer(4);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => bytes });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchBytesWithRetry("/x.m4a", "test", [1, 1, 1])).resolves.toBe(bytes);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after the last retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchBytesWithRetry("/x.m4a", "test", [1, 1])).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
