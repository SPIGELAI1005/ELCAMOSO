import { afterEach, describe, expect, it } from "vitest";

import {
  resetEntitlementGrantsForTests,
  activeGrantedProfileIds,
  listAllGrantsForAccount,
} from "@/lib/entitlements/grants";
import { FOUNDER_FOREVER_PICK_LIMIT, FOUNDERS_FOREVER_PICK_SOURCE } from "@/lib/founders/founders";
import {
  founderPickCounter,
  isFounderPickable,
  isGloballyFreeSound,
} from "@/lib/founders/sound-picks";
import {
  confirmFounderSoundPicks,
  corruptFounderPickForTests,
  resetFounderSoundPicksForTests,
  saveFounderSoundPicks,
} from "@/lib/founders/sound-picks.server";

const PICKS = ["gt-v8", "police-patrol", "fusion-road-anthem", "wild-west-carriage"] as const;

describe("Founders forever-sound picks", () => {
  afterEach(() => {
    resetFounderSoundPicksForTests();
    resetEntitlementGrantsForTests();
  });

  it("does not allow globally free sounds and they do not count", () => {
    expect(isGloballyFreeSound("racing-v10")).toBe(true);
    expect(isGloballyFreeSound("american-muscle-v8")).toBe(true);
    expect(isGloballyFreeSound("dracula-carriage")).toBe(true);
    expect(isGloballyFreeSound("symphony-latino-fiesta")).toBe(true);
    expect(isFounderPickable("racing-v10")).toBe(false);
    expect(isFounderPickable("gt-v8")).toBe(true);
    expect(isFounderPickable("police-patrol")).toBe(true);
    expect(isFounderPickable("wild-west-carriage")).toBe(true);
    expect(isFounderPickable("romanian-85-carriage")).toBe(true);
    const counter = founderPickCounter(["racing-v10", "gt-v8"]);
    expect(counter.selected).toBe(1);
    expect(counter.left).toBe(3);
    expect(counter.label).toBe("1 of 4 selected, 3 left");
    expect(counter.limit).toBe(FOUNDER_FOREVER_PICK_LIMIT);
  });

  it("confirms 4 picks and keeps them after a simulated cancel", async () => {
    await saveFounderSoundPicks("acc-picks", PICKS);
    await confirmFounderSoundPicks("acc-picks");
    expect(activeGrantedProfileIds("acc-picks").sort()).toEqual([...PICKS].sort());
    await expect(saveFounderSoundPicks("acc-picks", ["gt-v8"])).resolves.toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ soundId: "gt-v8", confirmedAt: expect.any(Number) }),
      ]),
    );
    expect(activeGrantedProfileIds("acc-picks").sort()).toEqual([...PICKS].sort());
    const forever = listAllGrantsForAccount("acc-picks").filter(
      (g) => g.source === FOUNDERS_FOREVER_PICK_SOURCE,
    );
    expect(forever).toHaveLength(4);
    expect(forever.every((g) => g.expiresAt == null)).toBe(true);
  });

  it("allows a replacement when a confirmed pick is removed", async () => {
    await saveFounderSoundPicks("acc-vacant", PICKS);
    await confirmFounderSoundPicks("acc-vacant");
    await corruptFounderPickForTests("acc-vacant", "gt-v8", "removed-profile");
    await saveFounderSoundPicks("acc-vacant", ["romanian-85-carriage"]);
    await confirmFounderSoundPicks("acc-vacant");
    const ids = activeGrantedProfileIds("acc-vacant");
    expect(ids).toContain("romanian-85-carriage");
    expect(ids).not.toContain("gt-v8");
    expect(ids).not.toContain("removed-profile");
    expect(ids).toHaveLength(4);
  });
});
