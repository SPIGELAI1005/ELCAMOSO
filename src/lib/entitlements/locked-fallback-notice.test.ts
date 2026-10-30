import { describe, expect, it } from "vitest";
import {
  clearLockedFallback,
  demoClipForProfile,
  getLockedFallback,
  noteLockedFallback,
} from "./locked-fallback-notice";
import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";

describe("locked sound fallback notice", () => {
  it("remembers the requested Drive+ sound until cleared", () => {
    noteLockedFallback("symphony-motion-orchestra");
    expect(getLockedFallback()).toBe("symphony-motion-orchestra");
    clearLockedFallback();
    expect(getLockedFallback()).toBeNull();
  });
  it("offers the music demo clip for music sounds only", () => {
    expect(demoClipForProfile("symphony-neon-run")).toBe("/demos/drive-the-music.m4a");
    expect(demoClipForProfile("fusion-road-anthem")).not.toBeNull();
    expect(demoClipForProfile("horse-gallop")).toBeNull();
  });
  it("fallback stays the free V10", () => expect(FALLBACK_SOUND_PROFILE_ID).toBe("racing-v10"));
});
