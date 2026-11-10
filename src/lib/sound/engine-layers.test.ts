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
  it("layers Big Twin under American Muscle V8 at 60/40 with makeup", () => {
    const stack = engineLayerStackFor("american-muscle-v8");
    expect(stack).toBeTruthy();
    expect(stack!.primaryGain).toBe(MUSCLE_V8_LAYER_PRIMARY_GAIN);
    expect(stack!.primaryGain).toBe(0.6);
    expect(stack!.makeupGain).toBe(MUSCLE_V8_LAYER_MAKEUP_GAIN);
    expect(stack!.layers).toHaveLength(1);
    expect(stack!.layers[0]!.profileId).toBe(MUSCLE_V8_LAYER_SECONDARY_PROFILE_ID);
    expect(stack!.layers[0]!.profileId).toBe("big-twin");
    expect(stack!.layers[0]!.gain).toBe(MUSCLE_V8_LAYER_SECONDARY_GAIN);
    expect(stack!.layers[0]!.gain).toBe(0.4);
    expect(stack!.layers[0]!.continuousOnly).toBe(true);
    expect(effectiveLayerGain(stack!, stack!.primaryGain)).toBeCloseTo(
      0.6 * MUSCLE_V8_LAYER_MAKEUP_GAIN,
    );
    expect(effectiveLayerGain(stack!, stack!.layers[0]!.gain)).toBeCloseTo(
      0.4 * MUSCLE_V8_LAYER_MAKEUP_GAIN,
    );
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
