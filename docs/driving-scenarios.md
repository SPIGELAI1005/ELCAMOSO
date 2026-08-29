# Automated driving scenarios

Deterministic simulation tests for the virtual powertrain and sensor-fusion pipeline. Scenarios fail when motion or transmission state becomes physically implausible.

Run:

```bash
npm test -- src/lib/drive/driving-scenarios.test.ts
npm test -- src/lib/motion/fusion-scenarios.test.ts
```

Implementation: `src/lib/drive/driving-scenarios.ts`, `src/lib/powertrain/scenarios.ts`.

## Powertrain scenarios (A–E)

Fixed **16 ms** timesteps via `PowertrainSimulator` + dev simulator controls. Each run is checked with `assertPhysicalPlausibility()` (RPM bounds, shift lockout, no gear hunting, plausible speed rates).

| ID | Scenario | Profile | Expected |
| --- | --- | --- | --- |
| **A** | 0 → 100 km/h WOT | flat-six-sport | ≥3 upshifts, RPM drops after each upshift |
| **B** | 0 → 80 km/h gentle | flat-six-sport | First upshift at lower road speed than A |
| **C** | 80 km/h cruise → hard tip-in | gt-v8 (sensitive kickdown) | Kickdown downshift, acceleration / shift mode |
| **D** | 120 → 60 km/h braking | american-v8 | Progressive downshifts, rev-match frames |
| **E** | 100 km/h lift throttle | american-v8 (deterministic overrun) | Overrun state after lift-off |

## Fusion scenarios (F–G)

Sensor fusion → `PowertrainSimulator.tick()` at fixed dt. Checked with `assertFusionScenarioPlausibility()` (powertrain rules + fusion jump limits).

| ID | Scenario | Expected |
| --- | --- | --- |
| **F** | Phone relay lost for 3 s at cruise | Hold tier, speed coast, no RPM/speed snap |
| **G** | Telemetry reconnect after stale gap | Smooth speed correction, max RPM jump &lt; 900 |

## API

```typescript
import {
  runDrivingScenario,
  runDrivingScenarioById,
  runAllDrivingScenarios,
  ALL_DRIVING_SCENARIO_IDS,
} from "@/lib/drive/driving-scenarios";
```

## Related fusion scenarios (H–K)

Higher-level multi-source feeds in `src/lib/motion/fusion-scenarios.ts` (IMU lead, city stop-go, browser-only, GPS priority).

## Plausibility rules

From `assertPhysicalPlausibility()`:

- Valid gear, throttle, load, RPM (idle–redline)
- No negative speed
- Shift lockout and single-gear steps
- No RPM spikes outside shifts
- Speed rate ≤ ~55 km/h per second between frames

Fusion scenarios add max frame speed jump (8 km/h) and RPM jump (900) limits.
