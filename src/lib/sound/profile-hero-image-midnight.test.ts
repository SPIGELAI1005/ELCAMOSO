import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { profileHeroImageSrc } from "@/lib/sound/profile-hero-image";

describe("Midnight Dark Rave hero still", () => {
  it("reuses the Motion Orchestra curated still (no duplicate asset)", () => {
    const midnight = profileHeroImageSrc("fusion-midnight-boost");
    const orchestra = profileHeroImageSrc("symphony-motion-orchestra");
    expect(orchestra).toBe("/hero/sound-profiles/symphony-motion-orchestra.png");
    expect(midnight).toBe(orchestra);
    expect(existsSync(`public${orchestra}`)).toBe(true);
    // Old dedicated file may still exist on disk; the resolver must not point at it.
    expect(midnight).not.toBe("/hero/sound-profiles/fusion-midnight-boost.png");
  });
});
