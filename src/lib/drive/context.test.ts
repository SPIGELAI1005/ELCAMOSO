import { describe, expect, it } from "vitest";
import { classifyWindow, predictState } from "@/lib/drive/context";
import { matchRule, type AutoRule, type ProfileRule } from "@/lib/drive/rules";
import { evaluateProfileRules } from "@/lib/drive/profile-rules";
import { DEFAULT_LAYER_MIX } from "@/lib/sound/environments";
import { IDLE_STATE } from "@/lib/drive/model";
import { REGRESSION_SCENARIOS, fingerprintScenario } from "@/lib/sound/regression/scenarios";
import { compareFingerprints } from "@/lib/sound/regression/fingerprint";
import references from "@/lib/sound/regression/references.json";

describe("drive context classifier", () => {
  it("labels city crawl, cruise, spirited and regen windows", () => {
    expect(
      classifyWindow(
        Array(20).fill(8 / 3.6),
        Array(20).fill(0.2),
        Array(20).fill(0.05),
        Array(20).fill(0.1),
      ),
    ).toBe("city");
    expect(
      classifyWindow(
        Array(20).fill(100 / 3.6),
        Array(20).fill(0.3),
        Array(20).fill(0.05),
        Array(20).fill(0.05),
      ),
    ).toBe("cruise");
    expect(
      classifyWindow(
        Array(20).fill(60 / 3.6),
        Array(20).fill(0.7),
        Array(20).fill(0.05),
        Array(20).fill(1.4),
      ),
    ).toBe("spirited");
    expect(
      classifyWindow(
        Array(20).fill(50 / 3.6),
        Array(20).fill(0.1),
        Array(20).fill(0.5),
        Array(20).fill(-1.2),
      ),
    ).toBe("regen");
  });

  it("extrapolates speed for latency lookahead", () => {
    const next = predictState({ ...IDLE_STATE, speed: 20, acceleration: 2 }, 100);
    expect(next.speed).toBeCloseTo(20.2, 5);
  });
});

describe("auto and profile rules", () => {
  it("matches a Motion context auto rule", () => {
    const rules: AutoRule[] = [
      {
        id: "1",
        enabled: true,
        profileId: "cruise-ship",
        when: { kind: "context", context: "cruise" },
      },
    ];
    expect(matchRule(rules, 90, 12, 5, "cruise")).toBe("cruise-ship");
    expect(matchRule(rules, 90, 12, 5, "city")).toBeNull();
  });

  it("applies a mixDelta trigger rule for high throttle", () => {
    const rules: ProfileRule[] = [
      {
        id: "wind",
        enabled: true,
        metric: "throttle",
        op: "gt",
        value: 0.6,
        action: { kind: "mixDelta", layer: "beds", delta: 0.1 },
      },
    ];
    const result = evaluateProfileRules({
      rules,
      kmh: 80,
      throttle: 0.7,
      regen: 0,
      context: "spirited",
      mix: DEFAULT_LAYER_MIX,
      latched: new Set(),
    });
    expect(result.mix.beds.volume).toBeCloseTo(DEFAULT_LAYER_MIX.beds.volume + 0.1, 5);
  });
});

describe("audio regression still covers Studio edits", () => {
  it("keeps Studio grit fingerprint within tolerance of the golden sample", () => {
    const scenario = REGRESSION_SCENARIOS.find((s) => s.id === "studio-grit");
    expect(scenario).toBeTruthy();
    const refs = references as Record<string, ReturnType<typeof fingerprintScenario>>;
    const expected = refs["studio-grit"];
    expect(expected).toBeTruthy();
    const actual = fingerprintScenario(scenario!);
    expect(compareFingerprints(actual, expected!).ok).toBe(true);
  });
});
