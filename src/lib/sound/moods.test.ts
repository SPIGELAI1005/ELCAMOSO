import { describe, expect, it } from "vitest";
import { getProfile } from "@/lib/sound/profiles";
import { profileMatchesMood, searchProfiles, sectionForProfile } from "@/lib/sound/moods";

describe("sound moods", () => {
  it("maps GT V8 to powerful", () => {
    expect(profileMatchesMood(getProfile("gt-v8"), "powerful")).toBe(true);
  });

  it("maps Zen Drive to calm", () => {
    expect(profileMatchesMood(getProfile("zen-drive"), "calm")).toBe(true);
  });

  it("maps Cyber Pulse to futuristic", () => {
    expect(profileMatchesMood(getProfile("cyber-pulse"), "futuristic")).toBe(true);
  });

  it("finds playful sounds", () => {
    const playful = searchProfiles("", "playful");
    expect(playful.some((p) => p.id === "laughing-machine" || p.category === "Playful")).toBe(true);
  });

  it("places featured profiles in Featured", () => {
    expect(sectionForProfile(getProfile("gt-v8"))).toBe("Featured");
  });
});
