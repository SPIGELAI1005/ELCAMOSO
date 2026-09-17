/**
 * Regenerates docs/POWERTRAIN_CALIBRATION_V2.md from live shift-map helpers.
 * Run: npx tsx scripts/generate-powertrain-calibration-v2.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DRIVETRAIN_PERSONALITY_IDS, getDrivetrainPersonality } from "../src/lib/drive/drivetrain-personalities";
import { getPowertrainProfile } from "../src/lib/powertrain/profiles";
import {
  calibrationUpshiftTable,
  downshiftSpeedForDemand,
  resolveShiftMap,
  scheduleUpshiftRpmForDemand,
  validateShiftMap,
} from "../src/lib/powertrain/shift-map";
import { speedKmhFromRpmAndGear } from "../src/lib/powertrain/rpm-model";
import { createDriverDemandState, roadLoadEstimate, updateDriverDemand } from "../src/lib/powertrain/driver-demand";
import type { VehicleMotionState } from "../src/lib/motion/types";

function motion(partial: Partial<VehicleMotionState> = {}): VehicleMotionState {
  return {
    timestamp: 1,
    speedKmh: 80,
    accelerationMs2: 0,
    accelerationFiltered: 0,
    decelerationMs2: 0,
    inferredThrottle: 0.08,
    motionConfidence: 1,
    primarySource: "simulator",
    sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
    fallbackTier: "decay",
    transitioning: false,
    ...partial,
  };
}

function fmt(n: number, digits = 1) {
  return n.toFixed(digits);
}

const lines: string[] = [];
function w(s = "") {
  lines.push(s);
}

w("# Powertrain Calibration V2");
w();
w("ELCAMOSO virtual drivetrain personalities — not representations of trademarked vehicles.");
w();
w("Generated from physical gear ratios, final drive, wheel circumference, and recalibrated demand RPM curves.");
w();
w("## Architecture notes");
w();
w("- Dynamic Drive (`PowertrainSimulator`) is canonical for virtual-transmission profiles when `(settings.dynamicDrive ∧ entitlement) ∨ demo`.");
w("- Continuous profiles never use `PowertrainSimulator`, including in demo.");
w("- Three speed signals: `displaySpeedKmh` (UI, unfiltered fused), `mechanicalSpeedKmh` (~160 ms τ for RPM), `shiftDecisionSpeedKmh` (~550 ms τ for gear schedule).");
w("- RPM uses `mechanicalSpeedKmh` only. Gear selection uses `shiftDecisionSpeedKmh` only.");
w("- `driverDemand` is accelerator intention; `engineLoad` may include road-load/aero. Road speed must not masquerade as pedal.");
w("- Kickdown queues are reconciled every tick: release, brake, or unsafe RPM clears remaining steps.");
w("- Diagnostics field `powertrainBackend: \"legacy\" | \"dynamic\"` is developer-only.");
w("- Road Feel V3: light/normal shift maps earlier for mainstream combustion; shift audibility from phase load + RPM, not fake swooshes.");
w();
w("## Demand bands (schedule generation)");
w();
w("| Demand | Intent |");
w("|---|---|");
w("| 0.00–0.15 | Very light — early economy/normal shifts |");
w("| 0.15–0.35 | Light — comfortable road driving |");
w("| 0.35–0.60 | Medium — progressive pull |");
w("| 0.60–0.80 | High — sport hold |");
w("| 0.80–1.00 | WOT — high-load / soft-redline behavior |");
w();

{
  const profile = getPowertrainProfile("flat-six-sport");
  w("## Steady-speed driverDemand (flat-six-sport, directThrottle 0.12)");
  w();
  w("| Speed km/h | driverDemand | engineLoad | roadLoadEstimate |");
  w("|---:|---:|---:|---:|");
  for (const speed of [30, 50, 80, 100, 130]) {
    let state = createDriverDemandState();
    let last = updateDriverDemand({
      motion: motion({ speedKmh: speed, accelerationMs2: 0, accelerationFiltered: 0, inferredThrottle: 0 }),
      profile,
      rpmNormalized: 0.35,
      dt: 0.05,
      state,
      directThrottle: 0.12,
    });
    for (let i = 0; i < 40; i += 1) {
      last = updateDriverDemand({
        motion: motion({ speedKmh: speed, accelerationMs2: 0, accelerationFiltered: 0, inferredThrottle: 0 }),
        profile,
        rpmNormalized: 0.35,
        dt: 0.05,
        state: last.state,
        directThrottle: 0.12,
      });
    }
    w(`| ${speed} | ${fmt(last.driverDemand, 3)} | ${fmt(last.engineLoad, 3)} | ${fmt(roadLoadEstimate(speed), 3)} |`);
  }
  w();
}

for (const id of DRIVETRAIN_PERSONALITY_IDS) {
  const personality = getDrivetrainPersonality(id);
  const profile = getPowertrainProfile(id);
  const map = resolveShiftMap(profile);
  const validation = validateShiftMap(map, profile);
  const table = calibrationUpshiftTable(profile);
  const rpm10 = scheduleUpshiftRpmForDemand(0.1, profile);
  const rpm50 = scheduleUpshiftRpmForDemand(0.5, profile);
  const rpm100 = scheduleUpshiftRpmForDemand(1, profile);

  w(`## ${personality.name} (\`${id}\`)`);
  w();
  w("| Property | Value |");
  w("|---|---|");
  w(`| Idle RPM | ${profile.engine.idleRpm} |`);
  w(`| Redline RPM | ${profile.engine.redlineRpm} |`);
  w(`| Gear ratios | ${profile.transmission.gearRatios.join(", ")} |`);
  w(`| Final drive | ${profile.transmission.finalDrive} |`);
  w(`| Wheel circumference | ${profile.wheelCircumferenceM} m |`);
  w(`| Upshift duration | ${profile.transmission.shift.upshiftDurationMs} ms |`);
  w(`| Downshift duration | ${profile.transmission.shift.downshiftDurationMs} ms |`);
  w(`| Rev-match | ${profile.transmission.shift.revMatchEnabled ? `yes (overshoot ${profile.transmission.shift.revMatchOvershoot})` : "no"} |`);
  w(`| Kickdown | threshold ${profile.transmission.kickdown.throttleThreshold}, maxSteps ${profile.transmission.kickdown.maxSteps} |`);
  w(`| Torque converter slip | ${profile.transmission.torqueConverter ? `yes (lock ~${profile.transmission.torqueConverter.lockSpeedKmh ?? 52} km/h)` : "no"} |`);
  w(`| Shift map valid | ${validation.ok ? "yes" : `no (${validation.issues.join("; ")})`} |`);
  w(`| Schedule RPM @10/50/100% | ${Math.round(rpm10)} / ${Math.round(rpm50)} / ${Math.round(rpm100)} |`);
  w();
  w("### Road-speed range per gear (idle → redline)");
  w();
  w("| Gear | Idle km/h | Redline km/h |");
  w("|---|---:|---:|");
  for (let g = 1; g <= profile.transmission.gears; g += 1) {
    const idle = speedKmhFromRpmAndGear(profile.engine.idleRpm, g, profile);
    const red = speedKmhFromRpmAndGear(profile.engine.redlineRpm, g, profile);
    w(`| ${g} | ${fmt(idle)} | ${fmt(red)} |`);
  }
  w();
  w("### Upshift speeds by demand (km/h)");
  w();
  w("| From gear | 10% | 25% | 50% | 75% | 100% |");
  w("|---|---:|---:|---:|---:|---:|");
  const demands = [0.1, 0.25, 0.5, 0.75, 1] as const;
  for (let g = 1; g < profile.transmission.gears; g += 1) {
    const cells = demands.map((d) => {
      const row = table.find((r) => r.demand === d)!;
      return fmt(row.speeds[g - 1]!);
    });
    w(`| ${g}→${g + 1} | ${cells.join(" | ")} |`);
  }
  w();
  w("### Downshift speeds by demand (km/h)");
  w();
  w("| From gear | 10% | 25% | 50% | 75% | 100% |");
  w("|---|---:|---:|---:|---:|---:|");
  for (let g = 2; g <= Math.min(profile.transmission.gears, 6); g += 1) {
    const cells = demands.map((d) => fmt(downshiftSpeedForDemand(map, g, d)));
    w(`| ${g}→${g - 1} | ${cells.join(" | ")} |`);
  }
  w();
}

const out = resolve(process.cwd(), "docs/POWERTRAIN_CALIBRATION_V2.md");
writeFileSync(out, lines.join("\n"), "utf8");
console.log("Wrote", out);
