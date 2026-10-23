import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/drive/settings";
import { DEFAULT_PROFILE_ID, getProfile } from "@/lib/sound/profiles";
import { isShiftMapPresetModeId, resolveDriveShiftPersona } from "@/lib/drive/drive-shift-persona";

describe("first-run default", () => {
  it("is Racing V10 in Race mode", () => {
    expect(DEFAULT_PROFILE_ID).toBe("racing-v10");
    expect(DEFAULT_SETTINGS.profileId).toBe("racing-v10");
    expect(DEFAULT_SETTINGS.shiftMapPreset).toBe("race");
  });
  it("Race is a real mode for Racing V10", () => {
    const persona = resolveDriveShiftPersona(getProfile("racing-v10")!);
    expect(persona.modeBinding).toBe("shift-map");
    expect(isShiftMapPresetModeId("race")).toBe(true);
  });
});
