import { describe, expect, it } from "vitest";
import { getWorldPack } from "./experience-pack";

describe("space worlds: thrust bass + brief whistle", () => {
  it("all space / sci-fi worlds get thrust bass; whistle packs are governed", () => {
    for (const id of ["world-space-drive", "space-ship", "world-cyber-city", "cyber-pulse", "world-storm-run", "storm-glider"]) {
      const pack = getWorldPack(id)!;
      expect(pack.thrust?.level ?? 0).toBeGreaterThan(0);
      expect(pack.thrust?.highPassHz ?? 34).toBeGreaterThanOrEqual(32);
      if (pack.layers.some((l) => l.kind === "shimmer")) expect(pack.whistle?.floor ?? 1).toBeLessThanOrEqual(0.3);
    }
  });
  it("Space Drive idle stays as authored", () => {
    const idle = getWorldPack("world-space-drive")!.stateRules.find((r) => r.state === "idle");
    expect(idle?.gains).toEqual({ reactor: 0.45, cabin: 0.25 });
  });
});
