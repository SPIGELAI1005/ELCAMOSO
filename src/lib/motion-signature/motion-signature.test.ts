import { describe, expect, it } from "vitest";
import {
  generateMotionSignature,
  normalizeEnergySeries,
  energySamplesFromTimeline,
} from "@/lib/motion-signature";

describe("Motion Signature", () => {
  it("is deterministic for the same seed", () => {
    const a = generateMotionSignature({ seed: "night-motion", ribbons: 4 });
    const b = generateMotionSignature({ seed: "night-motion", ribbons: 4 });
    expect(a.ribbons.map((r) => r.d)).toEqual(b.ribbons.map((r) => r.d));
    expect(a.seed).toBe(b.seed);
  });

  it("differs across drives", () => {
    const a = generateMotionSignature({ seed: "drive-a" });
    const b = generateMotionSignature({ seed: "drive-b" });
    expect(a.ribbons[0]!.d).not.toBe(b.ribbons[0]!.d);
  });

  it("shapes ribbons from energy history", () => {
    const flat = generateMotionSignature({
      seed: "same",
      energy: Array.from({ length: 20 }, () => 0.4),
    });
    const peaked = generateMotionSignature({
      seed: "same",
      energy: [0.1, 0.2, 0.3, 0.9, 0.95, 0.5, 0.2],
    });
    expect(flat.ribbons[0]!.d).not.toBe(peaked.ribbons[0]!.d);
  });

  it("normalizes and downsamples timeline safely", () => {
    const series = normalizeEnergySeries([0, 0.5, 1], 5, 1);
    expect(series).toHaveLength(5);
    expect(series[0]).toBe(0);
    expect(series[4]).toBe(1);
    const samples = energySamplesFromTimeline(
      Array.from({ length: 100 }, (_, i) => ({ t: i, energy: i / 100 })),
      24,
    );
    expect(samples).toHaveLength(24);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  });

  it("emits valid SVG path commands", () => {
    const geo = generateMotionSignature({ seed: 42, family: "drive-song", ribbons: 4 });
    expect(geo.ribbons.length).toBe(4);
    for (const r of geo.ribbons) {
      expect(r.d.startsWith("M")).toBe(true);
      expect(r.d).toContain("C");
    }
  });
});
