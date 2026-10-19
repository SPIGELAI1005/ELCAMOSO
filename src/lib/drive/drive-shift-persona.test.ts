import { describe, expect, it } from "vitest";
import { getProfile } from "@/lib/sound/profiles";
import {
  moodLabel,
  motionStageIndex,
  nextMoodId,
  resolveActiveMoodId,
  resolveDriveShiftPersona,
  stageDisplayValue,
} from "@/lib/drive/drive-shift-persona";
import { IDLE_STATE } from "@/lib/drive/model";

describe("drive-shift-persona", () => {
  it("keeps combustion cars on Classic/City/Touring/Sport (+ opt-in Race) with real gears", () => {
    const profile = getProfile("american-muscle-v8");
    const persona = resolveDriveShiftPersona(profile, 6);
    expect(persona.modeBinding).toBe("shift-map");
    expect(persona.ladderCount).toBe(6);
    expect(persona.modes.map((m) => m.label)).toEqual([
      "Classic",
      "City",
      "Touring",
      "Sport",
      "Race",
    ]);
  });

  it("gives Rocket Car thrust stages and playful modes", () => {
    const persona = resolveDriveShiftPersona(getProfile("rocket-car"));
    expect(persona.modeBinding).toBe("mood");
    expect(persona.stageNames?.[0]).toBe("Lift");
    expect(persona.modes.some((m) => m.label === "Hover Drive")).toBe(true);
    expect(stageDisplayValue(persona, 2)).toBe("Burn");
  });

  it("gives Time Machine era moods", () => {
    const persona = resolveDriveShiftPersona(getProfile("time-machine"));
    expect(persona.modes.map((m) => m.label)).toContain("1985");
    expect(persona.modes.map((m) => m.label)).toContain("3000");
    const mid = resolveActiveMoodId(persona, "era-1985", "city");
    expect(moodLabel(persona, mid)).toBe("1985");
    expect(moodLabel(persona, nextMoodId(persona, mid))).toBe("2000");
  });

  it("maps idle motion to N and motion energy to a stage", () => {
    expect(motionStageIndex(IDLE_STATE, 5)).toBe(0);
    expect(
      motionStageIndex({ ...IDLE_STATE, speed: 30 / 3.6, throttle: 0.4, load: 0.35 }, 5),
    ).toBeGreaterThan(0);
  });
});
