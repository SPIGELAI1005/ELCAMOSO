import { describe, expect, it, vi } from "vitest";
import {
  applyCockpitProfileSwitch,
  createProfileSwitchController,
  favouriteSlotAccess,
} from "@/lib/drive/cockpit-profile-switch";

describe("createProfileSwitchController", () => {
  it("latest selection wins across rapid taps", async () => {
    const ctrl = createProfileSwitchController();
    const apply = vi.fn(async (id: string) => {
      await Promise.resolve();
      return id;
    });

    const g1 = ctrl.request("gt-v8");
    const g2 = ctrl.request("racing-v10");

    const first = applyCockpitProfileSwitch({
      profileId: "gt-v8",
      activeProfileId: "cyber-pulse",
      generation: g1,
      isCurrent: (g) => ctrl.isCurrent(g),
      canDriveWithProfile: () => true,
      apply,
    });

    const second = applyCockpitProfileSwitch({
      profileId: "racing-v10",
      activeProfileId: "cyber-pulse",
      generation: g2,
      isCurrent: (g) => ctrl.isCurrent(g),
      canDriveWithProfile: () => true,
      apply,
    });

    await expect(first).resolves.toBe("stale");
    await expect(second).resolves.toBe("applied");
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("racing-v10");
  });

  it("blocks locked profiles without applying", async () => {
    const ctrl = createProfileSwitchController();
    const apply = vi.fn();
    const gen = ctrl.request("american-muscle-v8");
    const outcome = await applyCockpitProfileSwitch({
      profileId: "american-muscle-v8",
      activeProfileId: "gt-v8",
      generation: gen,
      isCurrent: (g) => ctrl.isCurrent(g),
      canDriveWithProfile: () => false,
      apply,
    });
    expect(outcome).toBe("locked");
    expect(apply).not.toHaveBeenCalled();
  });

  it("returns failed when apply throws and leaves caller to keep current sound", async () => {
    const ctrl = createProfileSwitchController();
    const gen = ctrl.request("racing-v10");
    const outcome = await applyCockpitProfileSwitch({
      profileId: "racing-v10",
      activeProfileId: "gt-v8",
      generation: gen,
      isCurrent: (g) => ctrl.isCurrent(g),
      canDriveWithProfile: () => true,
      apply: async () => {
        throw new Error("build failed");
      },
    });
    expect(outcome).toBe("failed");
  });
});

describe("favouriteSlotAccess", () => {
  it("keeps favourites visible when access expires", () => {
    expect(favouriteSlotAccess("racing-v10", () => false)).toBe("locked");
    expect(favouriteSlotAccess("gt-v8", () => true)).toBe("ready");
  });
});
