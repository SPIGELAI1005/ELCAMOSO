import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { driveGenreBackdropSrc, GENRE_IDS_WITH_HERO } from "./profile-hero-image";

const sig = (id: string) => id === "symphony-latino-fiesta";
describe("drive genre backdrop", () => {
  it("only plain music profiles with a picked genre swap stills (car fx hidden then)", () => {
    expect(driveGenreBackdropSrc("symphony-neon-run", "house", sig)).toBe("/hero/genres/house.png");
    expect(driveGenreBackdropSrc("symphony-neon-run", "auto", sig)).toBeNull();
    expect(driveGenreBackdropSrc("symphony-latino-fiesta", "house", sig)).toBeNull();
    expect(driveGenreBackdropSrc("gt-v8", "house", sig)).toBeNull();
    expect(driveGenreBackdropSrc("symphony-cinematic-rock", "rock", sig)).toBeNull();
    expect(driveGenreBackdropSrc("symphony-motion-orchestra", "rock", sig)).toBe("/hero/genres/rock.png");
  });
  it("every genre still exists", () => {
    for (const g of GENRE_IDS_WITH_HERO) expect(existsSync(`public/hero/genres/${g}.png`), g).toBe(true);
  });
});
