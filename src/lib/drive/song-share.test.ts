import { describe, expect, it } from "vitest";
import { drawSongShareCard, formatDriveDuration, SONG_SHARE_MESSAGES, songShareFileName, songShareIntents } from "./song-share";

describe("song share", () => {
  it("has a short message in every language, no hashtags or emojis", () => {
    for (const m of Object.values(SONG_SHARE_MESSAGES)) {
      expect(m).toContain("ELCAMOSO");
      expect(m).not.toMatch(/#|[\u{1F300}-\u{1FAFF}]/u);
    }
  });
  it("builds intents with the site link", () => {
    const i = songShareIntents("de");
    expect(decodeURIComponent(i.whatsapp)).toContain("https://www.elcamoso.com");
    expect(i.x).toContain("url=https%3A%2F%2Fwww.elcamoso.com");
    expect(i.email.startsWith("mailto:")).toBe(true);
  });
  it("formats duration and file names", () => {
    expect(formatDriveDuration(103)).toBe("1 min 43 s");
    expect(formatDriveDuration(3725)).toBe("1 h 02 min");
    expect(songShareFileName("Latino Fiesta", 1080, 1350)).toBe("elcamoso-drive-song-latino-fiesta-1080x1350.png");
  });
  it("draws the card without a car image", () => {
    const calls: string[] = [];
    const grad = { addColorStop: () => undefined };
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_t, k) => (k === "createLinearGradient" ? () => grad : (...a: unknown[]) => { calls.push(`${String(k)}:${String(a[0] ?? "")}`); }),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    drawSongShareCard(ctx, 1080, 1350, {
      chart: { durationSec: 100, maxSpeedKmh: 109, maxAbsAccel: 3, points: [{ t: 0, speedKmh: 0, accel: 0 }, { t: 50, speedKmh: 109, accel: 1 }], moments: [{ t: 50, kind: "top-speed", label: "Top", effect: "Peak", songSec: 30 }], gaps: [], bands: [{ startSec: 0, endSec: 100, chapter: "PEAK" as never, songStartSec: 0 }] },
      genreName: "Latino Fiesta", durationSec: 100, topSpeedKmh: 109,
    });
    expect(calls.some((c) => c.startsWith("fillText:ELCAMOSO"))).toBe(true);
    expect(calls.filter((c) => c.startsWith("bezierCurveTo")).length).toBe(3);
    expect(calls.some((c) => c.startsWith("fillText:Latino Fiesta"))).toBe(true);
    expect(calls.some((c) => c.startsWith("fillText:www.elcamoso.com"))).toBe(true);
  });
});
