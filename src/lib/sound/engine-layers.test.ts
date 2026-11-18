import { describe, expect, it } from "vitest";

import { getProfile } from "@/lib/sound/profiles";
import {
  MUSCLE_V8_LAYER_MAKEUP_GAIN,
  MUSCLE_V8_LAYER_PRIMARY_GAIN,
  MUSCLE_V8_LAYER_SECONDARY_GAIN,
  MUSCLE_V8_LAYER_SECONDARY_PROFILE_ID,
  effectiveLayerGain,
  engineLayerStackFor,
} from "@/lib/sound/engine-layers";

describe("engine sound layers", () => {
  it("no longer layers Big Twin under American Muscle V8 (replaced by the Coyote loop bank)", () => {
    expect(engineLayerStackFor("american-muscle-v8")).toBeNull();
    // the 60/40 constants stay exported for reference / A-B tooling
    expect(MUSCLE_V8_LAYER_PRIMARY_GAIN).toBe(0.6);
    expect(MUSCLE_V8_LAYER_SECONDARY_GAIN).toBe(0.4);
    expect(MUSCLE_V8_LAYER_SECONDARY_PROFILE_ID).toBe("big-twin");
    expect(MUSCLE_V8_LAYER_MAKEUP_GAIN).toBeGreaterThan(0);
    expect(typeof effectiveLayerGain).toBe("function");
  });

  it("does not change the standalone Big Twin profile or other catalog sounds", () => {
    expect(engineLayerStackFor("big-twin")).toBeNull();
    expect(engineLayerStackFor("gt-v8")).toBeNull();
    expect(engineLayerStackFor("police-patrol")).toBeNull();
    expect(engineLayerStackFor("racing-v10")).toBeNull();
    const twin = getProfile("big-twin");
    expect(twin.id).toBe("big-twin");
    expect(twin.drivetrainPersonalityId).toBe("v-twin-cruiser");
    expect(engineLayerStackFor(twin.id)).toBeNull();
  });
});
