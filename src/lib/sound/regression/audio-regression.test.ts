import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareFingerprints } from "@/lib/sound/regression/fingerprint";
import { REGRESSION_SCENARIOS, fingerprintScenario } from "@/lib/sound/regression/scenarios";
import references from "@/lib/sound/regression/references.json";

const refs = references as Record<string, ReturnType<typeof fingerprintScenario>>;
const updating =
  process.env["UPDATE_AUDIO_REFS"] === "1" ||
  process.env["npm_lifecycle_event"] === "test:update-audio";

describe("audio regression", () => {
  it("covers the key drive states and Studio edits", () => {
    if (updating) {
      expect(REGRESSION_SCENARIOS.length).toBeGreaterThan(0);
      return;
    }
    expect(REGRESSION_SCENARIOS.map((s) => s.id).sort()).toEqual(Object.keys(refs).sort());
  });

  it("matches saved reference fingerprints", () => {
    const next: Record<string, ReturnType<typeof fingerprintScenario>> = {};
    const failures: string[] = [];
    for (const scenario of REGRESSION_SCENARIOS) {
      const actual = fingerprintScenario(scenario);
      next[scenario.id] = actual;
      const expected = refs[scenario.id];
      if (!expected) {
        failures.push(`${scenario.id}: missing reference`);
        continue;
      }
      const diff = compareFingerprints(actual, expected);
      if (!diff.ok) failures.push(`${scenario.id}: ${diff.reasons.join(", ")}`);
    }
    if (updating) {
      const here = dirname(fileURLToPath(import.meta.url));
      writeFileSync(join(here, "references.json"), `${JSON.stringify(next, null, 2)}\n`);
      return;
    }
    expect(failures).toEqual([]);
  });
});
