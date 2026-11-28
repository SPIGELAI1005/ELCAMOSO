import { describe, expect, it } from "vitest";
import { NEWS_ITEMS, getVisibleNewsItems } from "./items";

describe("news items", () => {
  it("has 28 week posts plus the safety, 7-day special, 50+ sounds Black Friday Special and Cyber Monday Special items with Berlin offsets", () => {
    expect(NEWS_ITEMS).toHaveLength(34);
    expect(NEWS_ITEMS.some((i) => i.id === "black-friday-special-2026")).toBe(true);
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
  it("shows the 7-day special from 3 Nov 15:00", () => {
    expect(getVisibleNewsItems(Date.parse("2026-11-03T15:00:00+01:00"))).toHaveLength(30);
  });
  it("shows all after the week", () => {
    expect(getVisibleNewsItems(Date.parse("2026-11-02T00:00:00+01:00"))).toHaveLength(29);
  });
  it("shows the Black Friday Special from 9 Nov 13:00", () => {
    expect(getVisibleNewsItems(Date.parse("2026-11-09T12:59:59+01:00"))).toHaveLength(31);
    const v = getVisibleNewsItems(Date.parse("2026-11-09T13:00:00+01:00"));
    expect(v).toHaveLength(32);
    expect(v[0]?.id).toBe("black-friday-special-2026");
  });
  it("shows the last-hours Black Friday item from 27 Nov 11:47", () => {
    expect(getVisibleNewsItems(Date.parse("2026-11-27T11:46:59+01:00"))).toHaveLength(32);
    const v = getVisibleNewsItems(Date.parse("2026-11-27T11:47:00+01:00"));
    expect(v).toHaveLength(33);
    expect(v[0]?.id).toBe("black-friday-tonight-2026");
    expect(v[0]?.image).toBe("/news/black-friday/black-friday-special-v8.png");
  });
  it("says the last-hours Black Friday item is try-free until tonight and Start Drive opens the V8", () => {
    const item = NEWS_ITEMS.find((i) => i.id === "black-friday-tonight-2026")!;
    expect(item.text).toBe(
      "Last hours of Black Friday Special on ELCAMOSO run until tonight, 27.11. 23:59 Berlin time. I made this for my Tesla Model Y, but you can actually try it in any car… even for free. Start Drive opens the V8.",
    );
    expect(item.textDe).toMatch(/letzten Stunden/);
    expect(item.textDe).toMatch(/Tesla Model Y/);
    expect(item.textDe).toMatch(/jedem Auto/);
    expect(item.textDe).toMatch(/sogar kostenlos/);
    expect(item.textRo).toMatch(/Ultimele ore/);
    expect(item.textRo).toMatch(/Model Y/);
    expect(item.textRo).toMatch(/orice mașină/);
    expect(item.textRo).toMatch(/gratuit/);
    for (const text of [item.text, item.textDe, item.textRo]) {
      expect(text).toMatch(/Start Drive/);
      expect(text).toMatch(/V8/);
      expect(text).toMatch(/27\.11\./);
      expect(text).toMatch(/23:59/);
    }
  });
  it("says home-page Start Drive opens American Muscle V8, and keeps the Rave allowance separate", () => {
    const item = NEWS_ITEMS.find((i) => i.id === "black-friday-special-2026")!;
    for (const text of [item.text, item.textDe, item.textRo]) {
      expect(text).toMatch(/Start Drive/);
      expect(text).toContain("American Muscle V8");
      expect(text).not.toMatch(/Start Drive[^.]{0,80}Midnight Dark Rave/);
      expect(text).toMatch(/Midnight Dark Rave/);
    }
  });
  it("shows the Cyber Monday Special from 28 Nov 00:00", () => {
    expect(getVisibleNewsItems(Date.parse("2026-11-27T23:59:59+01:00"))).toHaveLength(33);
    const v = getVisibleNewsItems(Date.parse("2026-11-28T00:00:00+01:00"));
    expect(v).toHaveLength(34);
    expect(v[0]?.id).toBe("cyber-monday-special-2026");
    expect(v[0]?.link?.href).toBe("/sounds");
  });
  it("Cyber Monday item names the dates, the same conditions and excludes Drive+ in EN/DE/RO", () => {
    const item = NEWS_ITEMS.find((i) => i.id === "cyber-monday-special-2026")!;
    for (const text of [item.text, item.textDe!, item.textRo!]) {
      expect(text).toContain("Cyber Monday");
      expect(text).toContain("28");
      expect(text).toMatch(/30/);
      expect(text).toMatch(/2026/);
      expect(text).toMatch(/23:59/);
      expect(text).toContain("American Muscle V8");
      expect(text).toContain("Midnight Dark Rave");
      expect(text).toMatch(/15/);
      expect(text).toMatch(/Drive\+/);
      expect(text).not.toMatch(/Start Drive[^.]{0,80}Midnight Dark Rave/);
    }
    expect(item.textDe).toMatch(/28\. November bis 30\. November 2026/);
    expect(item.textRo).toMatch(/28 noiembrie până pe 30 noiembrie 2026/);
  });
});
