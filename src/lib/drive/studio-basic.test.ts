import { describe, expect, it } from "vitest";
import { DEFAULT_TWEAKS } from "@/lib/drive/settings";
import { DEFAULT_LAYER_MIX } from "@/lib/sound/environments";
import { applyBasicFeel, basicFeelFromTuning } from "@/lib/drive/studio-basic";

describe("studio-basic mapping", () => {
  it("defaults sit near mid feel", () => {
    const feel = basicFeelFromTuning(DEFAULT_TWEAKS, DEFAULT_LAYER_MIX);
    expect(feel.character).toBeCloseTo(0.5, 1);
    expect(feel.weight).toBeCloseTo(1 - (1 - 0.4) / (2 - 0.4), 1);
    expect(feel.response).toBeCloseTo(0.5, 1);
    expect(feel.pitch).toBeCloseTo((1 - 0.5) / (2 - 0.5), 1);
    expect(feel.texture).toBeCloseTo(0.5, 1);
  });

  it("Character maps onto grit and character dials", () => {
    const next = applyBasicFeel("character", 1, DEFAULT_TWEAKS, DEFAULT_LAYER_MIX);
    expect(next.tweaks.grit).toBe(2);
    expect(next.tweaks.character).toBe(2);
  });

  it("Weight inverts brightness", () => {
    const heavy = applyBasicFeel("weight", 1, DEFAULT_TWEAKS, DEFAULT_LAYER_MIX);
    const light = applyBasicFeel("weight", 0, DEFAULT_TWEAKS, DEFAULT_LAYER_MIX);
    expect(heavy.tweaks.brightness).toBeLessThan(light.tweaks.brightness);
  });

  it("Space maps onto layer wet sends", () => {
    const wide = applyBasicFeel("space", 1, DEFAULT_TWEAKS, DEFAULT_LAYER_MIX);
    expect(wide.mix.body.wet).toBeCloseTo(0.85, 2);
    expect(wide.mix.beds.wet).toBeCloseTo(0.85, 2);
    expect(wide.mix.accents.wet).toBeCloseTo(0.85, 2);
  });

  it("round-trips pitch and response", () => {
    const applied = applyBasicFeel("pitch", 0.25, DEFAULT_TWEAKS, DEFAULT_LAYER_MIX);
    const withResponse = applyBasicFeel("response", 0.8, applied.tweaks, applied.mix);
    const feel = basicFeelFromTuning(withResponse.tweaks, withResponse.mix);
    expect(feel.pitch).toBeCloseTo(0.25, 1);
    expect(feel.response).toBeCloseTo(0.8, 1);
  });
});
