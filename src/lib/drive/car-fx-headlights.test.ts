import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { CAR_FX, DRIVE_MOTION_FX_ENABLED } from "./car-fx";

/** Profiles whose stills have no reliably detectable headlight (or none at all): lights disabled. */
const NO_HEADLIGHTS = ["heartbeat", "symphony-motion-orchestra", "big-twin", "motorcycle-superbike", "rocket-car", "kazoo-kart", "f1-v10", "formula-electric"];

describe("drive headlight anchors", () => {
  it("wheel spin + floor streaks are switched off (kept behind a flag)", () => {
    expect(DRIVE_MOTION_FX_ENABLED).toBe(false);
  });
  it("profiles without a detectable lamp have no headlight overlay", () => {
    for (const id of NO_HEADLIGHTS) expect(CAR_FX[id]!.headlights, id).toEqual([]);
  });
  it("every headlight ellipse covers actual bright lamp pixels in its PNG", () => {
    for (const [id, c] of Object.entries(CAR_FX)) {
      if (!c.headlights.length) continue;
      const png = PNG.sync.read(readFileSync(`public/hero/sound-profiles/${id}.png`));
      expect(png.width, id).toBe(c.image.w);
      for (const h of c.headlights) {
        let bright = 0;
        for (let y = Math.round(h.cy - h.ry); y <= h.cy + h.ry; y++)
          for (let x = Math.round(h.cx - h.rx); x <= h.cx + h.rx; x++) {
            if (((x - h.cx) / h.rx) ** 2 + ((y - h.cy) / h.ry) ** 2 > 1) continue;
            const i = (y * png.width + x) * 4;
            if (Math.max(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!) > 235) bright++;
          }
        expect(bright, `${id} @${h.cx},${h.cy}`).toBeGreaterThanOrEqual(20);
      }
    }
  });
});
