import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { genreHeroImageSrc, profileHeroImageSrc } from "@/lib/sound/profile-hero-image";

describe("Midnight Dark Rave hero still", () => {
  it("reuses the Drive the Music darkrave genre still (no duplicate asset)", () => {
    const midnight = profileHeroImageSrc("fusion-midnight-boost");
    const darkrave = genreHeroImageSrc("darkrave");
    const orchestra = profileHeroImageSrc("symphony-motion-orchestra");
    expect(darkrave).toBe("/hero/genres/darkrave.png");
    expect(midnight).toBe(darkrave);
    expect(orchestra).toBe("/hero/sound-profiles/symphony-motion-orchestra.png");
    expect(midnight).not.toBe(orchestra);
    expect(existsSync(`public${darkrave}`)).toBe(true);
    // Old dedicated still and the Motion Orchestra still stay on disk unused by this resolver.
    expect(midnight).not.toBe("/hero/sound-profiles/fusion-midnight-boost.png");
    expect(midnight).not.toBe("/hero/sound-profiles/symphony-motion-orchestra.png");
  });
});
