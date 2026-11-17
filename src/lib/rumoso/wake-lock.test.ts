import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RumosoWakeLockSession,
  SCREEN_LOCK_LIMIT_NOTE,
  WAKE_LOCK_UNSUPPORTED_HINT,
  acquireRumosoWakeLock,
  isScreenWakeLockSupported,
  type WakeLockDocumentLike,
  type WakeLockSentinelLike,
} from "./wake-lock";

class FakeDoc implements WakeLockDocumentLike {
  visibilityState = "visible";
  private listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function fakeSentinel(): WakeLockSentinelLike & { released: boolean; releaseCount: number } {
  const listeners = new Set<() => void>();
  const sentinel: WakeLockSentinelLike & { released: boolean; releaseCount: number } = {
    released: false,
    releaseCount: 0,
    release: async () => {
      sentinel.released = true;
      sentinel.releaseCount += 1;
      for (const listener of [...listeners]) listener();
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
  return sentinel;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isScreenWakeLockSupported", () => {
  it("is true when request is a function", () => {
    expect(isScreenWakeLockSupported({ wakeLock: { request: async () => fakeSentinel() } })).toBe(true);
  });

  it("is false when the API is missing", () => {
    expect(isScreenWakeLockSupported({})).toBe(false);
    expect(isScreenWakeLockSupported(undefined)).toBe(false);
  });
});

describe("acquireRumosoWakeLock", () => {
  it("requests a screen wake lock and reports wakelock mode", async () => {
    const sentinels: ReturnType<typeof fakeSentinel>[] = [];
    const request = vi.fn(async () => {
      const s = fakeSentinel();
      sentinels.push(s);
      return s;
    });
    const doc = new FakeDoc();
    const lock = await acquireRumosoWakeLock({
      nav: { wakeLock: { request } },
      doc,
      tryVideoFallback: () => null,
    });
    expect(lock.mode).toBe("wakelock");
    expect(request).toHaveBeenCalledWith("screen");
    expect(sentinels[0]!.released).toBe(false);

    lock.release();
    expect(sentinels[0]!.released).toBe(true);
    expect(doc.listenerCount("visibilitychange")).toBe(0);
  });

  it("re-acquires when the page becomes visible again", async () => {
    const sentinels: ReturnType<typeof fakeSentinel>[] = [];
    const request = vi.fn(async () => {
      const s = fakeSentinel();
      sentinels.push(s);
      return s;
    });
    const doc = new FakeDoc();
    const lock = await acquireRumosoWakeLock({
      nav: { wakeLock: { request } },
      doc,
      tryVideoFallback: () => null,
    });
    expect(request).toHaveBeenCalledTimes(1);

    doc.visibilityState = "hidden";
    await sentinels[0]!.release();
    doc.dispatch("visibilitychange");
    expect(request).toHaveBeenCalledTimes(1);

    doc.visibilityState = "visible";
    doc.dispatch("visibilitychange");
    await Promise.resolve();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    expect(sentinels).toHaveLength(2);

    lock.release();
    doc.visibilityState = "visible";
    doc.dispatch("visibilitychange");
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("returns none when unsupported and the video fallback is unavailable", async () => {
    const lock = await acquireRumosoWakeLock({
      nav: {},
      doc: new FakeDoc(),
      tryVideoFallback: () => null,
    });
    expect(lock.mode).toBe("none");
    lock.release();
  });

  it("uses the no-audio video fallback only when the API is missing", async () => {
    const stop = vi.fn();
    const lock = await acquireRumosoWakeLock({
      nav: {},
      doc: new FakeDoc(),
      tryVideoFallback: () => stop,
    });
    expect(lock.mode).toBe("video");
    lock.release();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe("RumosoWakeLockSession", () => {
  it("acquires while active and releases on pause or stop", async () => {
    const sentinels: ReturnType<typeof fakeSentinel>[] = [];
    const request = vi.fn(async () => {
      const s = fakeSentinel();
      sentinels.push(s);
      return s;
    });
    const doc = new FakeDoc();
    const acquire = (options?: Parameters<typeof acquireRumosoWakeLock>[0]) =>
      acquireRumosoWakeLock({
        nav: { wakeLock: { request } },
        doc,
        tryVideoFallback: () => null,
        ...options,
      });
    const session = new RumosoWakeLockSession();

    await expect(session.setActive(true, acquire)).resolves.toBe("wakelock");
    expect(sentinels[0]!.released).toBe(false);

    await expect(session.setActive(false, acquire)).resolves.toBe("off");
    expect(sentinels[0]!.released).toBe(true);

    await expect(session.setActive(true, acquire)).resolves.toBe("wakelock");
    expect(sentinels).toHaveLength(2);
    await session.setActive(false, acquire);
  });

  it("drops a lock that arrived after the run was already paused", async () => {
    let resolveRequest: (s: WakeLockSentinelLike) => void = () => {};
    const pending = new Promise<WakeLockSentinelLike>((resolve) => {
      resolveRequest = resolve;
    });
    const acquire = async () => {
      const sentinel = await pending;
      return {
        mode: "wakelock" as const,
        release: () => {
          void sentinel.release();
        },
      };
    };
    const session = new RumosoWakeLockSession();
    const enable = session.setActive(true, acquire);
    await session.setActive(false, acquire);
    const sentinel = fakeSentinel();
    resolveRequest(sentinel);
    await enable;
    expect(session.mode).toBe("off");
    expect(sentinel.released).toBe(true);
  });
});

describe("copy", () => {
  it("keeps the manual hint and the side-button note", () => {
    expect(WAKE_LOCK_UNSUPPORTED_HINT).toMatch(/Keep the screen on manually/i);
    expect(WAKE_LOCK_UNSUPPORTED_HINT).toMatch(/Auto-Lock to Never/i);
    expect(SCREEN_LOCK_LIMIT_NOTE).toMatch(/side button/i);
    expect(SCREEN_LOCK_LIMIT_NOTE).toMatch(/pauses web apps/i);
  });
});
