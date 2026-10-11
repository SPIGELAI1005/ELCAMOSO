import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acousticEngineBaseForProfile,
  acousticEngineForProfile,
} from "@/lib/sound/realism/v2/acoustic-engine";
import {
  ARCHETYPE_TO_ARCHITECTURE_CODE_V1,
  ARCHITECTURE_CODE_MAX,
  ARCHITECTURE_CONTRACT_VERSION,
  ARCHITECTURE_LABELS_V1,
  architectureCodeForArchetype,
  clampArchitectureCodeV1,
  halfOrderWeightForArchitectureCode,
  RALLY_TURBO_3_LOPE_SHORTCUT,
} from "@/lib/sound/realism/v2/architecture-contract";

describe("architecture contract v1", () => {
  it("keeps flat-plane and single on distinct codes", () => {
    expect(architectureCodeForArchetype("flat-plane-v8")).toBe(6);
    expect(architectureCodeForArchetype("single")).toBe(5);
    expect(ARCHITECTURE_LABELS_V1[5]).toBe("single");
    expect(ARCHITECTURE_LABELS_V1[6]).toBe("flat-plane-v8");
    expect(ARCHITECTURE_CODE_MAX).toBe(6);
  });

  it("maps race-car / flat-plane track configs to code 6, not single", () => {
    const track = acousticEngineBaseForProfile("race-car")!;
    const personality = acousticEngineForProfile("race-car")!;
    expect(track.architecture).toBe("flat-plane-v8");
    expect(track.architectureCode).toBe(6);
    expect(personality.architectureCode).toBe(6);
    expect(track.architectureCode).not.toBe(5);
  });

  it("documents Rally Turbo 3 lope shortcut as unresolved", () => {
    const rally = acousticEngineBaseForProfile("rally-car")!;
    expect(rally.architecture).toBe("inline-3");
    expect(rally.architectureCode).toBe(RALLY_TURBO_3_LOPE_SHORTCUT.architectureCode);
    expect(RALLY_TURBO_3_LOPE_SHORTCUT.status).toBe("unresolved-tuning-decision");
    expect(architectureCodeForArchetype("inline-3")).toBe(1);
  });

  it("gives flat-plane low half-order weight and single high", () => {
    expect(halfOrderWeightForArchitectureCode(6)).toBe(0.18);
    expect(halfOrderWeightForArchitectureCode(5)).toBe(0.75);
    expect(halfOrderWeightForArchitectureCode(1)).toBe(0.75);
    expect(halfOrderWeightForArchitectureCode(3)).toBe(0.5);
  });

  it("clamps invalid architecture codes", () => {
    expect(clampArchitectureCodeV1(Number.NaN)).toBe(0);
    expect(clampArchitectureCodeV1(99)).toBe(0);
    expect(clampArchitectureCodeV1(6.2)).toBe(6);
    expect(clampArchitectureCodeV1(-1)).toBe(0);
  });

  it("covers every firing-order archetype", () => {
    const keys = Object.keys(ARCHETYPE_TO_ARCHITECTURE_CODE_V1);
    expect(keys).toEqual(
      expect.arrayContaining([
        "cross-plane-v8",
        "cross-plane-v8-lope",
        "flat-plane-v8",
        "flat-six",
        "inline-6",
        "inline-3",
        "v10-even",
        "inline-4",
        "v-twin",
        "single",
      ]),
    );
    expect(keys).toHaveLength(10);
  });

  it("stays in sync with the public worklet embedding", () => {
    const worklet = readFileSync(
      resolve(process.cwd(), "public/audio/combustion-processor.js"),
      "utf8",
    );
    expect(worklet).toContain(`ARCHITECTURE_CONTRACT_VERSION = ${ARCHITECTURE_CONTRACT_VERSION}`);
    expect(worklet).toContain(`ARCHITECTURE_CODE_MAX = ${ARCHITECTURE_CODE_MAX}`);
    expect(worklet).toContain("6 flat-plane-v8");
    expect(worklet).toMatch(/5 single/);
    expect(worklet).toContain("arch === 6");
  });
});
