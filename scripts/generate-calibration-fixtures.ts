import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  CALIBRATION_SCENARIOS,
  runCalibrationScenario,
  sanitizeTraceForFixture,
  computeCalibrationMetrics,
} from "../src/lib/calibration/index.ts";

const outDir = join(process.cwd(), "src/lib/calibration/fixtures");
mkdirSync(outDir, { recursive: true });

const ids = [
  "gentle-city-launch",
  "cruise-80",
  "highway-kickdown",
  "noisy-gps-2",
  "phone-relay-reconnect",
] as const;

const manifest: Array<Record<string, number | string>> = [];
for (const id of ids) {
  const def = CALIBRATION_SCENARIOS.find((s) => s.id === id);
  if (!def) throw new Error(`missing scenario ${id}`);
  const trace = sanitizeTraceForFixture(runCalibrationScenario(def), 120);
  const metrics = computeCalibrationMetrics(trace);
  const path = join(outDir, `${id}.json`);
  writeFileSync(path, JSON.stringify(trace));
  manifest.push({
    id,
    samples: trace.samples.length,
    upshifts: metrics.upshifts,
    downshifts: metrics.downshifts,
    gearHuntingEvents: metrics.gearHuntingEvents,
    rpmDiscontinuitiesOutsideShifts: metrics.rpmDiscontinuitiesOutsideShifts,
  });
  console.log("wrote", path, trace.samples.length, "samples");
}

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify({ version: 1, fixtures: manifest }, null, 2),
);
console.log("done");
