import { describe, expect, it } from "vitest";
import { resolveProfileDriveAccess } from "@/lib/entitlements/access-resolver";
import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import {
  canDriveWithSoundProfile,
  HALLOWEEN_WINDOW_END_UTC_MS,
  isHalloweenWindow,
  isSeasonalFreeProfile,
  lockedProfilePreviewSeconds,
  resolveProfileAccess,
} from "@/lib/sound/profile-access";
import { getProfile } from "@/lib/sound/profiles";

const IN = Date.parse("2026-11-01T12:00:00+01:00");
const FIRST = Date.parse("2026-10-31T16:00:00+01:00");
const LAST = Date.parse("2026-11-01T23:59:59+01:00");
const AFTER = Date.parse("2026-11-02T00:00:00+01:00");
const LATER = Date.parse("2026-12-01T12:00:00+01:00");
const BEFORE = Date.parse("2026-10-31T15:59:59+01:00");
const police = () => getProfile("police-patrol");
const drive = (now: number) =>
  resolveProfileDriveAccess("police-patrol", { user: { ...DEFAULT_ENTITLEMENT_USER }, now } as never);

describe("Halloween window: Police Patrol", () => {
  it("window bounds are 31 Oct 16:00 – 2 Nov 00:00 Berlin", () => {
    expect(isHalloweenWindow(FIRST)).toBe(true);
    expect(isHalloweenWindow(LAST)).toBe(true);
    expect(isHalloweenWindow(BEFORE)).toBe(false);
    expect(isHalloweenWindow(AFTER)).toBe(false);
  });

  it("is free in the window", () => {
    for (const t of [FIRST, IN, LAST]) {
      expect(isSeasonalFreeProfile("police-patrol", t)).toBe(true);
      expect(resolveProfileAccess(police(), undefined, t)).toBe("free");
      expect(canDriveWithSoundProfile(police(), false, undefined, [], t)).toBe(true);
      expect(lockedProfilePreviewSeconds(police(), false, undefined, t)).toBeNull();
    }
    const d = drive(IN);
    expect(d.allowed).toBe(true);
    expect(d.expiresAtUtc).toBe(HALLOWEEN_WINDOW_END_UTC_MS);
  });

  it("goes back to Drive+ automatically after the window", () => {
    for (const t of [AFTER, LATER]) {
      expect(isSeasonalFreeProfile("police-patrol", t)).toBe(false);
      expect(resolveProfileAccess(police(), undefined, t)).toBe("drive_plus");
      expect(canDriveWithSoundProfile(police(), false, undefined, [], t)).toBe(false);
      expect(canDriveWithSoundProfile(police(), true, undefined, [], t)).toBe(true);
      expect(drive(t).allowed).toBe(false);
    }
  });

  it("Dracula Carriage stays free after the window; other Drive+ profiles stay locked in it", () => {
    expect(resolveProfileAccess(getProfile("dracula-carriage"), undefined, LATER)).toBe("free");
    expect(isSeasonalFreeProfile("dracula-carriage", IN)).toBe(false);
    expect(resolveProfileAccess(getProfile("wild-west-carriage"), undefined, IN)).toBe("drive_plus");
  });
});

import { halloweenPinned } from "@/lib/halloween/halloween";
import { profilesByCategory } from "@/components/HeaderSoundsMenu";
describe("Halloween pinned list", () => {
  const list = [{ id: "a" }, { id: "police-patrol" }, { id: "dracula-carriage" }];
  it("pins both sounds only inside the window", () => {
    expect(halloweenPinned(list, IN).pinned.map((p) => p.id)).toEqual(["dracula-carriage", "police-patrol"]);
    expect(halloweenPinned(list, AFTER).pinned).toEqual([]);
    expect(halloweenPinned(list, BEFORE).rest).toHaveLength(3);
  });
  it("Sounds menu shows the Halloween group first in the window and hides it after", () => {
    expect(profilesByCategory(IN)[0]!.category).toBe("Halloween 🎃 Special");
    const after = profilesByCategory(AFTER);
    expect(after[0]!.category).not.toBe("Halloween 🎃 Special");
    expect(after.flatMap((g) => g.profiles.map((p) => p.id))).toContain("dracula-carriage");
  });
});
