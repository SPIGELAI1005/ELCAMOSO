import { describe, expect, it } from "vitest";
import { electronicGainsFromDrive, midiToHz } from "./viral-techno";

describe("Viral Mix techno layers", () => {
  it("stays silent at idle and low speed", () => {
    const idle = electronicGainsFromDrive(0, "stopped", 0);
    const roll = electronicGainsFromDrive(40, "calm", 0.22);
    for (const g of [idle, roll]) {
      expect(g.sub).toBe(0);
      expect(g.kick).toBe(0);
      expect(g.offbeatBass).toBe(0);
      expect(g.acid).toBe(0);
      expect(g.openHat).toBe(0);
      expect(g.arp).toBe(0);
    }
  });

  it("enters at cruise and intensifies on the highway", () => {
    const cruise = electronicGainsFromDrive(90, "cruise", 0.36);
    const highway = electronicGainsFromDrive(180, "energetic", 0.64);
    expect(cruise.sub).toBeGreaterThan(0.4);
    expect(cruise.kick).toBeGreaterThan(0.3);
    expect(cruise.offbeatBass).toBeGreaterThan(0.15);
    expect(cruise.acid).toBeGreaterThan(0.1);
    expect(cruise.openHat).toBeGreaterThan(0.1);
    expect(cruise.arp).toBeGreaterThan(0.05);
    expect(cruise.pump).toBeGreaterThan(0.25);
    expect(cruise.filter).toBeGreaterThan(0.25);

    expect(highway.sub).toBeGreaterThan(cruise.sub);
    expect(highway.kick).toBeGreaterThan(cruise.kick);
    expect(highway.offbeatBass).toBeGreaterThan(cruise.offbeatBass);
    expect(highway.acid).toBeGreaterThan(cruise.acid);
    expect(highway.filter).toBeGreaterThan(cruise.filter);
  });

  it("strips electronic layers when decelerating", () => {
    const hot = electronicGainsFromDrive(160, "energetic", 0.6);
    const decel = electronicGainsFromDrive(160, "decelerating", 0.6);
    expect(decel.sub).toBeLessThan(hot.sub * 0.35);
    expect(decel.acid).toBeLessThan(hot.acid * 0.35);
    expect(decel.arp).toBeLessThan(hot.arp * 0.35);
  });

  it("maps the walking-bass C#2 to the expected frequency", () => {
    expect(midiToHz(37)).toBeCloseTo(69.3, 0);
    expect(midiToHz(25)).toBeCloseTo(34.65, 0);
  });
});
