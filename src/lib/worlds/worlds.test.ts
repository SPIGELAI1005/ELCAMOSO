import { describe, expect, it } from "vitest";
import { deriveWorldState } from "./world-state";
import { getWorldPack, isWorldProfileId, listWorldPacks } from "./experience-pack";
import type { DriveEnergyState } from "@/lib/symphony";

function energy(partial: Partial<DriveEnergyState>): DriveEnergyState {
  return {
    energy: 0,
    smoothness: 0.5,
    momentum: 0,
    tension: 0,
    regenIntensity: 0,
    driverDemand: 0,
    movementState: "stopped",
    ...partial,
  };
}

describe("Worlds engine", () => {
  it("ships Space Drive, Cyber City, Storm Run", () => {
    const packs = listWorldPacks();
    expect(packs.map((p) => p.id)).toEqual([
      "world-space-drive",
      "world-cyber-city",
      "world-storm-run",
    ]);
    expect(isWorldProfileId("world-space-drive")).toBe(true);
    expect(isWorldProfileId("space-ship")).toBe(true);
  });

  it("maps idle / motion / regen without flapping to peak", () => {
    expect(deriveWorldState(energy({ energy: 0.02 }), "idle", 0)).toBe("idle");
    expect(
      deriveWorldState(
        energy({ energy: 0.25, movementState: "cruise", driverDemand: 0.3 }),
        "idle",
        12,
      ),
    ).toBe("motion");
    expect(
      deriveWorldState(
        energy({
          energy: 0.4,
          regenIntensity: 0.5,
          driverDemand: 0.1,
          movementState: "decelerating",
        }),
        "motion",
        20,
      ),
    ).toBe("regen");
  });

  it("keeps storm thunder soft via cooldown metadata", () => {
    const storm = getWorldPack("world-storm-run");
    expect(storm?.eventCooldownSec).toBeGreaterThanOrEqual(6);
    const thunder = storm?.layers.find((l) => l.id === "thunder");
    expect(thunder?.level).toBeLessThan(0.35);
  });
});
