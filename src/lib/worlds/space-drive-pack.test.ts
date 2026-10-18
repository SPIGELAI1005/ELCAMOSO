import { describe, expect, it } from "vitest";
import { getBassEnhancerConfig } from "@/lib/sound/dsp/bass-enhancer";
import { SPACE_DRIVE_PACK } from "./packs/space-drive";

describe("Space Drive pack", () => {
  it("keeps the idle exactly as authored", () => {
    const idle = SPACE_DRIVE_PACK.stateRules.find((r) => r.state === "idle");
    expect(idle?.gains).toEqual({ reactor: 0.45, cabin: 0.25 });
    expect(getBassEnhancerConfig("world-space-drive")?.neutralAtRest).toBe(true);
  });
  it("keeps whistle layers soft and eased in, with long noise loops", () => {
    const byId = Object.fromEntries(SPACE_DRIVE_PACK.layers.map((l) => [l.id, l]));
    for (const id of ["energyField", "warp", "windEnergy"] as const) {
      expect(byId[id]?.rampTau ?? 0).toBeGreaterThanOrEqual(0.5);
      for (const rule of SPACE_DRIVE_PACK.stateRules) expect(rule.gains[id] ?? 0).toBeLessThanOrEqual(0.32);
    }
    for (const l of SPACE_DRIVE_PACK.layers) if (l.kind === "noise") expect(l.loopSec ?? 0).toBeGreaterThanOrEqual(10);
    expect(SPACE_DRIVE_PACK.liftOffThunder?.endHz).toBeGreaterThanOrEqual(34);
  });
});
