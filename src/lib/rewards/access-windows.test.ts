import { describe, expect, it } from "vitest";

import {
  fullLibraryWeekendWindow,
  sound48hWindow,
  soundPack7dWindow,
} from "./access-windows";

describe("access windows", () => {
  it("starts sound rewards at claim time", () => {
    const claim = Date.parse("2026-10-15T12:00:00.000Z");
    expect(sound48hWindow(claim).startsAtUtc).toBe(claim);
    expect(sound48hWindow(claim).endsAtUtc).toBe(claim + 48 * 3600 * 1000);
    expect(soundPack7dWindow(claim).endsAtUtc).toBe(claim + 7 * 24 * 3600 * 1000);
  });

  it("expires weekend pass on the applicable UTC Sunday with 96h cap", () => {
    // Thursday → following Sunday
    const thu = Date.parse("2026-10-15T12:00:00.000Z"); // Thursday
    const thuWin = fullLibraryWeekendWindow(thu);
    expect(thuWin.startsAtUtc).toBe(thu);
    expect(thuWin.endsAtUtc).toBe(Date.parse("2026-10-18T23:59:59.999Z"));

    // Saturday → this Sunday
    const sat = Date.parse("2026-10-17T08:00:00.000Z");
    const satWin = fullLibraryWeekendWindow(sat);
    expect(satWin.endsAtUtc).toBe(Date.parse("2026-10-18T23:59:59.999Z"));
  });
});
