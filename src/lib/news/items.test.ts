import { describe, expect, it } from "vitest";
import { NEWS_ITEMS, getVisibleNewsItems } from "./items";

describe("news items", () => {
  it("has 28 week posts plus the safety item with Berlin offsets", () => {
    expect(NEWS_ITEMS).toHaveLength(29);
    for (const item of NEWS_ITEMS) expect(item.publishAt).toMatch(/\+01:00$/);
  });
  it("hides everything before the first slot", () => {
    expect(getVisibleNewsItems(Date.parse("2026-10-26T07:59:59+01:00"))).toHaveLength(0);
  });
  it("shows items from their publish time, newest first", () => {
    const v = getVisibleNewsItems(Date.parse("2026-10-26T12:30:00+01:00"));
    expect(v.map((i) => i.publishAt)).toEqual([
      "2026-10-26T12:30:00+01:00",
      "2026-10-26T10:05:00+01:00",
      "2026-10-26T08:00:00+01:00",
    ]);
  });
  it("shows all after the week", () => {
    expect(getVisibleNewsItems(Date.parse("2026-11-02T00:00:00+01:00"))).toHaveLength(29);
  });
});
