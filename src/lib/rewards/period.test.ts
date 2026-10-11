import { describe, expect, it } from "vitest";

import { nextUtcMonthStart, utcMonthPeriodFromInstant } from "./period";

describe("UTC calendar month periods", () => {
  it("assigns late October UTC to 2026-10", () => {
    const p = utcMonthPeriodFromInstant(Date.parse("2026-10-31T23:30:00.000Z"));
    expect(p.periodKey).toBe("2026-10");
    expect(p.startsAtUtc).toBe(Date.parse("2026-10-01T00:00:00.000Z"));
    expect(p.endsAtUtcExclusive).toBe(Date.parse("2026-11-01T00:00:00.000Z"));
  });

  it("crosses the boundary at November 1 00:00 UTC", () => {
    const before = utcMonthPeriodFromInstant(Date.parse("2026-10-31T23:59:59.999Z"));
    const after = utcMonthPeriodFromInstant(Date.parse("2026-11-01T00:00:00.000Z"));
    expect(before.periodKey).toBe("2026-10");
    expect(after.periodKey).toBe("2026-11");
    expect(nextUtcMonthStart(Date.parse("2026-10-15T12:00:00.000Z"))).toBe(
      Date.parse("2026-11-01T00:00:00.000Z"),
    );
  });
});
