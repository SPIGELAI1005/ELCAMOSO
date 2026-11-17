import { describe, expect, it } from "vitest";

import { EFFORT_ZONES } from "./colors";
import { effortChartPoints, effortZoneGradientStops } from "./effort-chart";

describe("effortZoneGradientStops", () => {
  it("uses the same palette tokens as the map route and zone bar", () => {
    const stops = effortZoneGradientStops();
    expect(stops.map((s) => s.color)).toEqual([
      ...EFFORT_ZONES.map((z) => z.color),
      EFFORT_ZONES[EFFORT_ZONES.length - 1]!.color,
    ]);
    expect(stops[0]).toEqual({ offset: 0, color: "#8a8f98" });
    expect(stops.find((s) => s.offset === 0.25)?.color).toBe("#5eead4");
    expect(stops.find((s) => s.offset === 0.45)?.color).toBe("#fbbf24");
    expect(stops.find((s) => s.offset === 0.65)?.color).toBe("#f97316");
    expect(stops.find((s) => s.offset === 0.8)?.color).toBe("#e53935");
  });
});

describe("effortChartPoints", () => {
  it("places higher effort closer to the top of the chart", () => {
    const pts = effortChartPoints(
      [
        { atMs: 0, effort: 0 },
        { atMs: 1000, effort: 100 },
      ],
      320,
      88,
    );
    expect(pts[0]!.y).toBeGreaterThan(pts[1]!.y);
    expect(pts[1]!.x).toBe(320);
  });
});
