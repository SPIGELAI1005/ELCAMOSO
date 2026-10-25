import { describe, expect, it } from "vitest";
import { isTooShortDrive, tooShortVariant } from "./smiles";
import { isSmilesWorthy } from "@/lib/inbox/inbox";

describe("too-short drives", () => {
  it("flags drives under 1 km or under 1 minute", () => {
    expect(isTooShortDrive(0, 5_000)).toBe(true);
    expect(isTooShortDrive(999, 600_000)).toBe(true);
    expect(isTooShortDrive(5_000, 59_000)).toBe(true);
    expect(isTooShortDrive(1_000, 60_000)).toBe(false);
  });
  it("inbox agrees", () => {
    expect(isSmilesWorthy({ distanceM: 500, durationMs: 120_000 })).toBe(false);
    expect(isSmilesWorthy({ distanceM: 1500, durationMs: 120_000 })).toBe(true);
  });
  it("variant is stable and in range", () => {
    expect(tooShortVariant("abc")).toBe(tooShortVariant("abc"));
    for (const id of ["a", "b", "xyz", ""]) expect([0, 1, 2]).toContain(tooShortVariant(id));
  });
});
