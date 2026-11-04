import { describe, expect, it } from "vitest";
import { resolveDisplayedProfileId, shouldApplySharedSound } from "./sound-share";
const base = { fallbackId: "racing-v10" };
describe("shared sound selection", () => {
  it("keeps a locked shared sound displayed", () => {
    expect(resolveDisplayedProfileId({ ...base, current: "racing-v10", shared: "traby", lockedFallback: "traby", canDrive: () => false })).toEqual({ id: "traby", lockedPreview: true });
  });
  it("shows current when unlocked", () => {
    expect(resolveDisplayedProfileId({ ...base, current: "traby", shared: "traby", lockedFallback: null, canDrive: () => true }).lockedPreview).toBe(false);
  });
  it("applies once over a saved sound", () => {
    expect(shouldApplySharedSound({ ...base, current: "gt-v8", shared: "traby", alreadyApplied: false, lockedFallback: null, canDrive: () => true })).toBe(true);
  });
  it("re-applies after entitlements resolve", () => {
    expect(shouldApplySharedSound({ ...base, current: "racing-v10", shared: "traby", alreadyApplied: true, lockedFallback: "traby", canDrive: () => true })).toBe(true);
    expect(shouldApplySharedSound({ ...base, current: "racing-v10", shared: "traby", alreadyApplied: true, lockedFallback: "traby", canDrive: () => false })).toBe(false);
    expect(shouldApplySharedSound({ ...base, current: "gt-v8", shared: "traby", alreadyApplied: true, lockedFallback: null, canDrive: () => true })).toBe(false);
  });
});
