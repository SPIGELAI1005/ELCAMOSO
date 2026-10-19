import { describe, expect, it } from "vitest";
import { ACOUSTIC_ENGINE_BY_PROFILE } from "@/lib/sound/realism/v2/acoustic-engine";

describe("idleLife (alive idle)", () => {
  it("is set only on the Racing V10 and the F1 V10, within ±50-150 rpm wander", () => {
    for (const [id, cfg] of Object.entries(ACOUSTIC_ENGINE_BY_PROFILE)) {
      if (id === "racing-v10" || id === "f1-v10") {
        expect(cfg.idleLife).toBeDefined();
        expect(cfg.idleLife!.wanderRpm).toBeGreaterThanOrEqual(50);
        expect(cfg.idleLife!.wanderRpm).toBeLessThanOrEqual(150);
        expect(cfg.idleLife!.blipEveryS[0]).toBeGreaterThanOrEqual(3);
      } else {
        expect(cfg.idleLife).toBeUndefined();
      }
    }
  });
});
