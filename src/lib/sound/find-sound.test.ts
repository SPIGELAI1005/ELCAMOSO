import { describe, expect, it } from "vitest";
import { findSoundsFromPrompt } from "@/lib/sound/find-sound";

describe("findSoundsFromPrompt", () => {
  it("maps joyful accelerate to Laughing Machine", () => {
    const hits = findSoundsFromPrompt("joyful when I accelerate", 3);
    expect(hits[0]?.profileId).toBe("laughing-machine");
  });

  it("maps neon night language", () => {
    const hits = findSoundsFromPrompt("night neon pulses", 3);
    expect(hits.some((h) => h.profileId === "neon-drive")).toBe(true);
  });

  it("maps hydraulic digger language", () => {
    const hits = findSoundsFromPrompt("hydraulic digger under load", 3);
    expect(hits[0]?.profileId).toBe("construction-monster");
  });
});
