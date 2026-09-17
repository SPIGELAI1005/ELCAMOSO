# Powertrain Calibration V2

ELCAMOSO virtual drivetrain personalities — not representations of trademarked vehicles.

Generated from physical gear ratios, final drive, wheel circumference, and recalibrated demand RPM curves.

## Architecture notes

- Dynamic Drive (`PowertrainSimulator`) is canonical for virtual-transmission profiles when `(settings.dynamicDrive ∧ entitlement) ∨ demo`.
- Continuous profiles never use `PowertrainSimulator`, including in demo.
- Three speed signals: `displaySpeedKmh` (UI, unfiltered fused), `mechanicalSpeedKmh` (~160 ms τ for RPM), `shiftDecisionSpeedKmh` (~550 ms τ for gear schedule).
- RPM uses `mechanicalSpeedKmh` only. Gear selection uses `shiftDecisionSpeedKmh` only.
- `driverDemand` is accelerator intention; `engineLoad` may include road-load/aero. Road speed must not masquerade as pedal.
- Kickdown queues are reconciled every tick: release, brake, or unsafe RPM clears remaining steps.
- Diagnostics field `powertrainBackend: "legacy" | "dynamic"` is developer-only.

## Demand bands (schedule generation)

| Demand | Intent |
|---|---|
| 0.00–0.15 | Very light — early economy/normal shifts |
| 0.15–0.35 | Light — comfortable road driving |
| 0.35–0.60 | Medium — sportier gear holding |
| 0.60–0.80 | High — strong acceleration |
| 0.80–1.00 | WOT — high-load / soft-redline behavior |

## Steady-speed driverDemand (flat-six-sport, directThrottle 0.12)

| Speed km/h | driverDemand | engineLoad | roadLoadEstimate |
|---:|---:|---:|---:|
| 30 | 0.110 | 0.090 | 0.016 |
| 50 | 0.110 | 0.097 | 0.028 |
| 80 | 0.110 | 0.108 | 0.048 |
| 100 | 0.110 | 0.116 | 0.062 |
| 130 | 0.110 | 0.129 | 0.086 |

## Flat-Six Sport (`flat-six-sport`)

| Property | Value |
|---|---|
| Idle RPM | 880 |
| Redline RPM | 8000 |
| Gear ratios | 3.15, 2.05, 1.52, 1.18, 0.96, 0.80, 0.68 |
| Final drive | 3.44 |
| Wheel circumference | 2.05 m |
| Upshift duration | 110 ms |
| Downshift duration | 160 ms |
| Rev-match | yes (overshoot 0.11) |
| Kickdown | threshold 0.82, maxSteps 2 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 3783 / 5920 / 7508 |

### Road-speed range per gear (idle → redline)

| Gear | Idle km/h | Redline km/h |
|---|---:|---:|
| 1 | 10.0 | 90.8 |
| 2 | 15.3 | 139.5 |
| 3 | 20.7 | 188.2 |
| 4 | 26.7 | 242.4 |
| 5 | 32.8 | 298.0 |
| 6 | 39.3 | 357.6 |
| 7 | 46.3 | 420.7 |

### Upshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 1→2 | 42.9 | 51.7 | 67.2 | 79.5 | 85.2 |
| 2→3 | 66.0 | 79.4 | 103.3 | 122.1 | 131.0 |
| 3→4 | 89.0 | 107.1 | 139.3 | 164.7 | 176.6 |
| 4→5 | 114.6 | 137.9 | 179.4 | 212.1 | 227.5 |
| 5→6 | 140.9 | 169.5 | 220.5 | 260.7 | 279.6 |
| 6→7 | 169.1 | 203.5 | 264.6 | 312.9 | 335.6 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 36.4 | 45.2 | 56.6 | 59.3 | 59.3 |
| 3→2 | 58.7 | 69.0 | 77.2 | 77.2 | 77.2 |
| 4→3 | 81.0 | 89.8 | 95.8 | 95.8 | 95.8 |
| 5→4 | 105.9 | 111.4 | 113.2 | 113.2 | 113.2 |
| 6→5 | 127.8 | 130.5 | 130.5 | 130.5 | 130.5 |

## American V8 (`american-v8`)

| Property | Value |
|---|---|
| Idle RPM | 680 |
| Redline RPM | 6000 |
| Gear ratios | 3.50, 2.20, 1.45, 1.08, 0.85 |
| Final drive | 3.73 |
| Wheel circumference | 2.12 m |
| Upshift duration | 280 ms |
| Downshift duration | 340 ms |
| Rev-match | yes (overshoot 0.08) |
| Kickdown | threshold 0.85, maxSteps 1 |
| Torque converter slip | yes (lock ~52 km/h) |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 2178 / 4400 / 5598 |

### Road-speed range per gear (idle → redline)

| Gear | Idle km/h | Redline km/h |
|---|---:|---:|
| 1 | 6.6 | 58.5 |
| 2 | 10.5 | 93.0 |
| 3 | 16.0 | 141.1 |
| 4 | 21.5 | 189.5 |
| 5 | 27.3 | 240.7 |

### Upshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 1→2 | 21.2 | 29.4 | 42.9 | 51.2 | 54.5 |
| 2→3 | 33.8 | 46.8 | 68.2 | 81.4 | 86.8 |
| 3→4 | 51.2 | 71.0 | 103.5 | 123.5 | 131.7 |
| 4→5 | 68.8 | 95.4 | 138.9 | 165.8 | 176.8 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 14.7 | 22.9 | 36.0 | 39.7 | 39.7 |
| 3→2 | 26.5 | 39.6 | 55.1 | 57.4 | 57.4 |
| 4→3 | 43.2 | 59.0 | 73.3 | 73.3 | 73.3 |

## Turbo Inline-6 (`turbo-inline-6`)

| Property | Value |
|---|---|
| Idle RPM | 750 |
| Redline RPM | 7000 |
| Gear ratios | 3.20, 2.00, 1.45, 1.12, 0.92, 0.78, 0.68 |
| Final drive | 3.15 |
| Wheel circumference | 2.08 m |
| Upshift duration | 130 ms |
| Downshift duration | 180 ms |
| Rev-match | yes (overshoot 0.1) |
| Kickdown | threshold 0.8, maxSteps 1 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 3115 / 5320 / 6705 |

### Road-speed range per gear (idle → redline)

| Gear | Idle km/h | Redline km/h |
|---|---:|---:|
| 1 | 9.3 | 86.7 |
| 2 | 14.9 | 138.7 |
| 3 | 20.5 | 191.3 |
| 4 | 26.5 | 247.6 |
| 5 | 32.3 | 301.4 |
| 6 | 38.1 | 355.6 |
| 7 | 43.7 | 407.8 |

### Upshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 1→2 | 38.6 | 48.4 | 65.9 | 79.2 | 83.0 |
| 2→3 | 61.7 | 77.4 | 105.4 | 126.8 | 132.8 |
| 3→4 | 85.1 | 106.8 | 145.4 | 174.9 | 183.2 |
| 4→5 | 110.2 | 138.2 | 188.2 | 226.4 | 237.2 |
| 5→6 | 134.2 | 168.3 | 229.1 | 275.6 | 288.7 |
| 6→7 | 158.2 | 198.5 | 270.2 | 325.1 | 340.5 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 32.1 | 41.9 | 58.2 | 63.4 | 63.4 |
| 3→2 | 54.5 | 70.1 | 84.0 | 84.2 | 84.2 |
| 4→3 | 77.1 | 92.3 | 104.7 | 104.7 | 104.7 |
| 5→4 | 101.5 | 113.6 | 122.3 | 122.3 | 122.3 |
| 6→5 | 124.7 | 133.5 | 138.2 | 138.2 | 138.2 |

## GT V8 (`gt-v8`)

| Property | Value |
|---|---|
| Idle RPM | 900 |
| Redline RPM | 6500 |
| Gear ratios | 3.40, 2.15, 1.50, 1.12, 0.92, 0.78 |
| Final drive | 3.55 |
| Wheel circumference | 2.06 m |
| Upshift duration | 95 ms |
| Downshift duration | 140 ms |
| Rev-match | yes (overshoot 0.09) |
| Kickdown | threshold 0.78, maxSteps 2 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 2737 / 4800 / 6123 |

### Road-speed range per gear (idle → redline)

| Gear | Idle km/h | Redline km/h |
|---|---:|---:|
| 1 | 9.2 | 66.6 |
| 2 | 14.6 | 105.3 |
| 3 | 20.9 | 150.9 |
| 4 | 28.0 | 202.1 |
| 5 | 34.1 | 246.0 |
| 6 | 40.2 | 290.1 |

### Upshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 1→2 | 28.0 | 35.9 | 49.2 | 58.6 | 62.7 |
| 2→3 | 44.3 | 56.8 | 77.7 | 92.7 | 99.2 |
| 3→4 | 63.5 | 81.4 | 111.4 | 132.9 | 142.1 |
| 4→5 | 85.1 | 109.0 | 149.2 | 178.0 | 190.3 |
| 5→6 | 103.6 | 132.7 | 181.7 | 216.7 | 231.7 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 21.5 | 29.4 | 42.6 | 46.6 | 46.6 |
| 3→2 | 37.1 | 49.5 | 62.7 | 64.1 | 64.1 |
| 4→3 | 55.5 | 69.7 | 82.1 | 82.1 | 82.1 |
| 5→4 | 76.3 | 87.0 | 95.4 | 95.4 | 95.4 |

## Synthetic Hyper EV (`synthetic-ev`)

| Property | Value |
|---|---|
| Idle RPM | 0 |
| Redline RPM | 12000 |
| Gear ratios | 4.20, 2.80, 1.90, 1.35, 1.00, 0.82 |
| Final drive | 2.8 |
| Wheel circumference | 2.04 m |
| Upshift duration | 75 ms |
| Downshift duration | 90 ms |
| Rev-match | no |
| Kickdown | threshold 0.7, maxSteps 1 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 4147 / 7500 / 11193 |

### Road-speed range per gear (idle → redline)

| Gear | Idle km/h | Redline km/h |
|---|---:|---:|
| 1 | 0.0 | 124.9 |
| 2 | 0.0 | 187.3 |
| 3 | 0.0 | 276.1 |
| 4 | 0.0 | 388.6 |
| 5 | 0.0 | 524.6 |
| 6 | 0.0 | 639.7 |

### Upshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 1→2 | 43.2 | 53.7 | 78.1 | 104.1 | 116.5 |
| 2→3 | 64.7 | 80.6 | 117.1 | 156.1 | 174.7 |
| 3→4 | 95.4 | 118.7 | 172.6 | 230.1 | 257.5 |
| 4→5 | 134.3 | 167.1 | 242.9 | 323.8 | 362.4 |
| 5→6 | 181.3 | 225.6 | 327.9 | 437.1 | 489.3 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 36.7 | 47.2 | 59.7 | 62.1 | 62.1 |
| 3→2 | 57.5 | 73.3 | 87.9 | 88.8 | 88.8 |
| 4→3 | 87.4 | 106.2 | 121.1 | 121.1 | 121.1 |
| 5→4 | 125.5 | 144.7 | 158.2 | 158.2 | 158.2 |

## Motorcycle Inline-4 (`motorcycle-inline-4`)

| Property | Value |
|---|---|
| Idle RPM | 1200 |
| Redline RPM | 14000 |
| Gear ratios | 2.85, 2.05, 1.58, 1.32, 1.14, 1.00 |
| Final drive | 2.54 |
| Wheel circumference | 1.88 m |
| Upshift duration | 55 ms |
| Downshift duration | 85 ms |
| Rev-match | yes (overshoot 0.15) |
| Kickdown | threshold 0.72, maxSteps 2 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 7340 / 10200 / 13486 |

### Road-speed range per gear (idle → redline)

| Gear | Idle km/h | Redline km/h |
|---|---:|---:|
| 1 | 18.7 | 218.2 |
| 2 | 26.0 | 303.3 |
| 3 | 33.7 | 393.5 |
| 4 | 40.4 | 471.0 |
| 5 | 46.7 | 545.4 |
| 6 | 53.3 | 621.7 |

### Upshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 1→2 | 114.4 | 129.3 | 158.9 | 197.1 | 210.1 |
| 2→3 | 159.0 | 179.8 | 221.0 | 274.0 | 292.1 |
| 3→4 | 206.3 | 233.2 | 286.7 | 355.6 | 379.1 |
| 4→5 | 246.9 | 279.2 | 343.2 | 425.6 | 453.7 |
| 5→6 | 285.9 | 323.3 | 397.3 | 492.8 | 525.4 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 107.9 | 113.1 | 114.4 | 114.4 | 114.4 |
| 3→2 | 143.6 | 145.0 | 145.0 | 145.0 | 145.0 |
| 4→3 | 169.6 | 169.6 | 169.6 | 169.6 | 169.6 |
| 5→4 | 191.7 | 191.7 | 191.7 | 191.7 | 191.7 |

## V-Twin Cruiser (`v-twin-cruiser`)

| Property | Value |
|---|---|
| Idle RPM | 900 |
| Redline RPM | 5500 |
| Gear ratios | 3.75, 2.48, 1.72, 1.34, 1.08, 0.90 |
| Final drive | 3.15 |
| Wheel circumference | 2.00 m |
| Upshift duration | 240 ms |
| Downshift duration | 300 ms |
| Rev-match | yes (overshoot 0.06) |
| Kickdown | threshold 0.88, maxSteps 1 |
| Torque converter slip | yes (lock ~52 km/h) |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 1998 / 3700 / 4989 |

### Road-speed range per gear (idle → redline)

| Gear | Idle km/h | Redline km/h |
|---|---:|---:|
| 1 | 9.1 | 55.9 |
| 2 | 13.8 | 84.5 |
| 3 | 19.9 | 121.8 |
| 4 | 25.6 | 156.4 |
| 5 | 31.7 | 194.0 |
| 6 | 38.1 | 232.8 |

### Upshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 1→2 | 20.3 | 26.1 | 37.6 | 46.2 | 50.7 |
| 2→3 | 30.7 | 39.5 | 56.8 | 69.9 | 76.6 |
| 3→4 | 44.3 | 57.0 | 81.9 | 100.8 | 110.5 |
| 4→5 | 56.8 | 73.1 | 105.2 | 129.4 | 141.8 |
| 5→6 | 70.5 | 90.7 | 130.5 | 160.5 | 176.0 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 13.8 | 19.6 | 31.1 | 38.5 | 39.6 |
| 3→2 | 23.4 | 32.3 | 48.8 | 54.5 | 54.5 |
| 4→3 | 36.3 | 49.0 | 64.2 | 66.5 | 66.5 |
| 5→4 | 48.1 | 63.8 | 78.3 | 78.3 | 78.3 |

## Single-Cylinder Ag (`single-cylinder-ag`)

| Property | Value |
|---|---|
| Idle RPM | 280 |
| Redline RPM | 650 |
| Gear ratios | 4.50, 3.15, 2.35, 1.82 |
| Final drive | 4.75 |
| Wheel circumference | 2.25 m |
| Upshift duration | 380 ms |
| Downshift duration | 450 ms |
| Rev-match | no |
| Kickdown | threshold 0.92, maxSteps 1 |
| Torque converter slip | yes (lock ~52 km/h) |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 441 / 494 / 595 |

### Road-speed range per gear (idle → redline)

| Gear | Idle km/h | Redline km/h |
|---|---:|---:|
| 1 | 1.8 | 4.1 |
| 2 | 2.5 | 5.9 |
| 3 | 3.4 | 7.9 |
| 4 | 4.4 | 10.2 |

### Upshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 1→2 | 2.8 | 2.9 | 3.1 | 3.5 | 3.8 |
| 2→3 | 4.0 | 4.1 | 4.5 | 5.0 | 5.4 |
| 3→4 | 5.3 | 5.5 | 6.0 | 6.8 | 7.2 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 3→2 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |

