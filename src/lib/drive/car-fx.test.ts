import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { floorHeading, groundYAt, GALLOP_VIDEO, gallopPlaybackRate, CAR_FX, carFxFor, floorScrollPxPerSecond, headlightsOn, resetDriveFxSpeed, sampleDriveFxSpeed, wheelBlur, wheelTurnsPerSecond, FLOOR_MAX_PX_S, WHEEL_MAX_TURNS } from "./car-fx";

describe("drive car fx", () => {
  it("police patrol has config inside the image", () => {
    const c = carFxFor("police-patrol")!;
    for (const e of [...c.wheels, ...c.headlights]) {
      expect(e.cx).toBeGreaterThan(0);
      expect(e.cx).toBeLessThan(c.image.w);
      expect(e.cy).toBeLessThan(c.image.h);
    }
    expect(carFxFor("unknown")).toBeNull();
    expect(Object.keys(CAR_FX)).toContain("police-patrol");
  });
  it("still at 0, capped at speed", () => {
    expect(wheelTurnsPerSecond(0)).toBe(0);
    expect(floorScrollPxPerSecond(0)).toBe(0);
    expect(wheelTurnsPerSecond(300)).toBeLessThanOrEqual(WHEEL_MAX_TURNS);
    expect(floorScrollPxPerSecond(300)).toBeLessThanOrEqual(FLOOR_MAX_PX_S);
    expect(wheelTurnsPerSecond(120)).toBeGreaterThan(wheelTurnsPerSecond(40));
    expect(wheelBlur(500)).toBe(1);
  });
  it("headlights on when running or moving", () => {
    expect(headlightsOn(false, 0)).toBe(false);
    expect(headlightsOn(true, 0)).toBe(true);
    expect(headlightsOn(false, 20)).toBe(true);
  });
  it("shared speed eases toward target and settles to 0", () => {
    resetDriveFxSpeed();
    let t = 0;
    sampleDriveFxSpeed(t, 100);
    for (let i = 0; i < 30; i++) sampleDriveFxSpeed((t += 16), 100);
    const mid = sampleDriveFxSpeed(t, 100);
    expect(mid).toBeGreaterThan(30);
    expect(mid).toBeLessThan(100);
    for (let i = 0; i < 400; i++) sampleDriveFxSpeed((t += 16), 0);
    expect(sampleDriveFxSpeed(t, 0)).toBe(0);
  });
  it("dracula gallop loop: paused at 0, 0.25-1.6x, file exists", () => {
    expect(gallopPlaybackRate(0)).toBe(0);
    expect(gallopPlaybackRate(3)).toBe(0.25);
    expect(gallopPlaybackRate(500)).toBe(1.6);
    const src = GALLOP_VIDEO["dracula-carriage"]!;
    expect(existsSync(`public${src}`)).toBe(true);
    expect(carFxFor("dracula-carriage")).toBeNull();
  });
  it("every car config sits inside its image; floor runs along the tyre line, front -> rear", () => {
    expect(Object.keys(CAR_FX).length).toBeGreaterThanOrEqual(43);
    for (const [id, c] of Object.entries(CAR_FX)) {
      expect(existsSync(`public/hero/sound-profiles/${id}.png`), id).toBe(true);
      expect(c.wheels.length, id).toBeGreaterThanOrEqual(2);
      for (const e of [...c.wheels, ...c.headlights]) {
        expect(e.cx - e.rx, id).toBeGreaterThanOrEqual(-5);
        expect(e.cx + e.rx, id).toBeLessThanOrEqual(c.image.w + 5);
        expect(e.cy + e.ry, id).toBeLessThanOrEqual(c.image.h);
      }
      const h = floorHeading(c);
      expect(h.ux, id).toBeGreaterThan(0.9); // cars face left: floor scrolls toward the rear (right)
      expect(Math.abs(h.deg), id).toBeLessThan(20);
      expect(groundYAt(c, c.ground[0][0])).toBe(c.ground[0][1]);
    }
    const p = floorHeading(carFxFor("police-patrol")!);
    expect(p.deg).toBeLessThan(-5); // police: floor recedes up-right toward the vanishing point
  });
  it("non-car images get no car fx", () => {
    for (const id of ["horse-gallop", "wild-west-carriage", "romanian-85-carriage", "dragon", "cruise-ship", "helicopter", "tank"]) expect(carFxFor(id)).toBeNull();
  });
});
