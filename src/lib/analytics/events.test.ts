import { describe, expect, it } from "vitest";

import { addBatch, mergeDays, sanitizeBatch, type DayAggregate } from "./events";

describe("analytics events", () => {
  it("drops unknown events and props", () => {
    const b = sanitizeBatch({
      deviceId: "elc-12345678",
      device: "tesla",
      events: [
        { t: "drive_end", at: Date.now(), p: { km: 3.2, lat: 52.1, durationMs: 60000 } },
        { t: "evil", at: Date.now() },
      ],
    });
    expect(b?.events).toHaveLength(1);
    expect(b?.events[0]?.p).not.toHaveProperty("lat");
  });
  it("aggregates and separates test events", () => {
    const m = new Map<string, DayAggregate>();
    const at = Date.UTC(2026, 9, 20, 12);
    addBatch(m, {
      deviceId: "elc-a",
      device: "phone",
      events: [
        { t: "sound_listen", at, p: { profileId: "v8", ms: 5000 } },
        { t: "sound_listen", at, p: { profileId: "v8", ms: 60000 } },
        { t: "session_start", at, p: { test: true } },
      ],
    });
    const t = mergeDays([...m.values()]);
    expect(t.plays["v8"]).toBe(2);
    expect(t.quickSkips["v8"]).toBe(1);
    expect(t.test).toBe(1);
  });
});
