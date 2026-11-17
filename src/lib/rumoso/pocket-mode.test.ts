import { describe, expect, it } from "vitest";

import { POCKET_UNLOCK_HOLD_MS, pocketUnlockProgress, pocketUnlockReady } from "./pocket-mode";

describe("pocket unlock hold", () => {
  it("requires 1.5 seconds", () => {
    expect(POCKET_UNLOCK_HOLD_MS).toBe(1500);
    expect(pocketUnlockProgress(0)).toBe(0);
    expect(pocketUnlockProgress(750)).toBeCloseTo(0.5);
    expect(pocketUnlockProgress(1500)).toBe(1);
    expect(pocketUnlockProgress(2000)).toBe(1);
    expect(pocketUnlockReady(1499)).toBe(false);
    expect(pocketUnlockReady(1500)).toBe(true);
  });

  it("treats missing or negative time as no progress", () => {
    expect(pocketUnlockProgress(Number.NaN)).toBe(0);
    expect(pocketUnlockProgress(-20)).toBe(0);
    expect(pocketUnlockReady(-1)).toBe(false);
  });
});
