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
- Road Feel V3: light/normal shift maps earlier for mainstream combustion; shift audibility from phase load + RPM, not fake swooshes.

## Demand bands (schedule generation)

| Demand | Intent |
|---|---|
| 0.00–0.15 | Very light — early economy/normal shifts |
| 0.15–0.35 | Light — comfortable road driving |
| 0.35–0.60 | Medium — progressive pull |
| 0.60–0.80 | High — sport hold |
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
| Gear ratios | 3.15, 2.05, 1.52, 1.18, 0.96, 0.8, 0.68 |
| Final drive | 3.44 |
| Wheel circumference | 2.05 m |
| Upshift duration | 125 ms |
| Downshift duration | 170 ms |
| Rev-match | yes (overshoot 0.11) |
| Kickdown | threshold 0.82, maxSteps 2 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 2261 / 3437 / 7396 |

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
| 1→2 | 25.7 | 30.3 | 39.0 | 58.9 | 84.0 |
| 2→3 | 39.4 | 46.6 | 60.0 | 90.5 | 129.0 |
| 3→4 | 53.2 | 62.9 | 80.9 | 122.1 | 174.0 |
| 4→5 | 68.5 | 81.0 | 104.2 | 157.2 | 224.1 |
| 5→6 | 84.2 | 99.6 | 128.0 | 193.3 | 275.5 |
| 6→7 | 101.0 | 119.5 | 153.6 | 231.9 | 330.6 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 19.2 | 23.8 | 32.5 | 52.4 | 59.3 |
| 3→2 | 32.2 | 39.4 | 52.7 | 72.3 | 77.2 |
| 4→3 | 45.2 | 54.9 | 72.9 | 91.8 | 95.8 |
| 5→4 | 59.8 | 72.2 | 95.4 | 111.0 | 113.2 |
| 6→5 | 74.7 | 90.1 | 118.5 | 130.2 | 130.5 |

## American V8 (`american-v8`)

| Property | Value |
|---|---|
| Idle RPM | 680 |
| Redline RPM | 6000 |
| Gear ratios | 3.5, 2.2, 1.45, 1.08, 0.85 |
| Final drive | 3.73 |
| Wheel circumference | 2.12 m |
| Upshift duration | 280 ms |
| Downshift duration | 340 ms |
| Rev-match | yes (overshoot 0.08) |
| Kickdown | threshold 0.85, maxSteps 1 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 2088 / 2964 / 5526 |

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
| 1→2 | 20.3 | 23.5 | 28.9 | 38.9 | 53.8 |
| 2→3 | 32.4 | 37.4 | 45.9 | 62.0 | 85.7 |
| 3→4 | 49.1 | 56.7 | 69.7 | 94.0 | 130.0 |
| 4→5 | 65.9 | 76.1 | 93.6 | 126.2 | 174.5 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 13.8 | 17.0 | 22.4 | 32.4 | 39.7 |
| 3→2 | 25.1 | 30.1 | 38.7 | 53.5 | 57.4 |
| 4→3 | 41.1 | 48.7 | 61.7 | 71.6 | 73.3 |
| 5→4 | 57.2 | 67.4 | 82.9 | 88.3 | 88.3 |

## Turbo Inline-6 (`turbo-inline-6`)

| Property | Value |
|---|---|
| Idle RPM | 750 |
| Redline RPM | 7000 |
| Gear ratios | 3.2, 2, 1.45, 1.12, 0.92, 0.78, 0.68 |
| Final drive | 3.15 |
| Wheel circumference | 2.08 m |
| Upshift duration | 145 ms |
| Downshift duration | 195 ms |
| Rev-match | yes (overshoot 0.1) |
| Kickdown | threshold 0.8, maxSteps 1 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 2053 / 3106 / 6667 |

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
| 1→2 | 25.4 | 30.0 | 38.5 | 57.8 | 82.5 |
| 2→3 | 40.7 | 48.0 | 61.5 | 92.5 | 132.1 |
| 3→4 | 56.1 | 66.3 | 84.9 | 127.6 | 182.2 |
| 4→5 | 72.6 | 85.8 | 109.9 | 165.2 | 235.8 |
| 5→6 | 88.4 | 104.4 | 133.8 | 201.1 | 287.1 |
| 6→7 | 104.3 | 123.2 | 157.8 | 237.2 | 338.6 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 18.9 | 23.5 | 32.0 | 51.3 | 63.4 |
| 3→2 | 33.4 | 40.8 | 54.3 | 78.0 | 84.2 |
| 4→3 | 48.1 | 58.3 | 76.9 | 99.5 | 104.7 |
| 5→4 | 63.9 | 77.0 | 101.1 | 119.3 | 122.3 |
| 6→5 | 78.9 | 94.9 | 124.3 | 137.5 | 138.2 |

## GT V8 (`gt-v8`)

| Property | Value |
|---|---|
| Idle RPM | 900 |
| Redline RPM | 6500 |
| Gear ratios | 3.4, 2.15, 1.5, 1.12, 0.92, 0.78 |
| Final drive | 3.55 |
| Wheel circumference | 2.06 m |
| Upshift duration | 110 ms |
| Downshift duration | 155 ms |
| Rev-match | yes (overshoot 0.09) |
| Kickdown | threshold 0.78, maxSteps 2 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 2389 / 3316 / 6042 |

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
| 1→2 | 24.5 | 28.0 | 34.0 | 44.9 | 61.9 |
| 2→3 | 38.7 | 44.2 | 53.7 | 71.0 | 97.8 |
| 3→4 | 55.5 | 63.4 | 77.0 | 101.8 | 140.2 |
| 4→5 | 74.3 | 84.9 | 103.1 | 136.3 | 187.8 |
| 5→6 | 90.4 | 103.4 | 125.5 | 166.0 | 228.6 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 18.0 | 21.5 | 27.5 | 38.4 | 46.6 |
| 3→2 | 31.4 | 37.0 | 46.4 | 60.6 | 64.1 |
| 4→3 | 47.5 | 55.4 | 69.0 | 80.1 | 82.1 |
| 5→4 | 65.5 | 76.2 | 90.8 | 95.4 | 95.4 |
| 6→5 | 80.9 | 93.9 | 105.6 | 107.1 | 107.1 |

## Synthetic Hyper EV (`synthetic-ev`)

| Property | Value |
|---|---|
| Idle RPM | 0 |
| Redline RPM | 12000 |
| Gear ratios | 4.2, 2.8, 1.9, 1.35, 1, 0.82 |
| Final drive | 2.8 |
| Wheel circumference | 2.04 m |
| Upshift duration | 75 ms |
| Downshift duration | 90 ms |
| Rev-match | no |
| Kickdown | threshold 0.7, maxSteps 1 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 2369 / 4032 / 10941 |

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
| 1→2 | 24.7 | 30.9 | 42.0 | 67.6 | 113.9 |
| 2→3 | 37.0 | 46.4 | 62.9 | 101.4 | 170.8 |
| 3→4 | 54.5 | 68.3 | 92.8 | 149.4 | 251.7 |
| 4→5 | 76.7 | 96.2 | 130.6 | 210.3 | 354.3 |
| 5→6 | 103.6 | 129.8 | 176.3 | 283.9 | 478.3 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 18.2 | 24.4 | 35.5 | 56.5 | 62.1 |
| 3→2 | 29.7 | 39.1 | 55.7 | 82.1 | 88.8 |
| 4→3 | 46.5 | 60.3 | 84.8 | 114.4 | 121.1 |
| 5→4 | 68.0 | 87.4 | 121.8 | 152.4 | 158.2 |
| 6→5 | 94.1 | 120.3 | 166.8 | 186.1 | 186.6 |

## Motorcycle Inline-4 (`motorcycle-inline-4`)

| Property | Value |
|---|---|
| Idle RPM | 1200 |
| Redline RPM | 14000 |
| Gear ratios | 2.85, 2.05, 1.58, 1.32, 1.14, 1 |
| Final drive | 2.54 |
| Wheel circumference | 1.88 m |
| Upshift duration | 55 ms |
| Downshift duration | 85 ms |
| Rev-match | yes (overshoot 0.15) |
| Kickdown | threshold 0.72, maxSteps 2 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 7212 / 8844 / 13382 |

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
| 1→2 | 112.4 | 126.3 | 137.8 | 153.1 | 208.5 |
| 2→3 | 156.2 | 175.5 | 191.6 | 212.8 | 289.9 |
| 3→4 | 202.7 | 227.8 | 248.6 | 276.2 | 376.1 |
| 4→5 | 242.6 | 272.6 | 297.5 | 330.5 | 450.2 |
| 5→6 | 281.0 | 315.7 | 344.5 | 382.7 | 521.3 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 105.9 | 113.1 | 114.4 | 114.4 | 114.4 |
| 3→2 | 140.8 | 145.0 | 145.0 | 145.0 | 145.0 |
| 4→3 | 169.6 | 169.6 | 169.6 | 169.6 | 169.6 |
| 5→4 | 191.7 | 191.7 | 191.7 | 191.7 | 191.7 |
| 6→5 | 213.2 | 213.2 | 213.2 | 213.2 | 213.2 |

## V-Twin Cruiser (`v-twin-cruiser`)

| Property | Value |
|---|---|
| Idle RPM | 900 |
| Redline RPM | 5500 |
| Gear ratios | 3.75, 2.48, 1.72, 1.34, 1.08, 0.9 |
| Final drive | 3.15 |
| Wheel circumference | 2 m |
| Upshift duration | 240 ms |
| Downshift duration | 300 ms |
| Rev-match | yes (overshoot 0.06) |
| Kickdown | threshold 0.88, maxSteps 1 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 1934 / 2554 / 4884 |

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
| 1→2 | 19.6 | 22.0 | 25.9 | 34.3 | 49.6 |
| 2→3 | 29.7 | 33.3 | 39.2 | 51.9 | 75.0 |
| 3→4 | 42.8 | 48.0 | 56.6 | 74.8 | 108.2 |
| 4→5 | 55.0 | 61.5 | 72.6 | 96.0 | 138.8 |
| 5→6 | 68.2 | 76.4 | 90.1 | 119.1 | 172.3 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 13.1 | 15.5 | 19.4 | 27.8 | 39.6 |
| 3→2 | 22.5 | 26.0 | 32.0 | 44.6 | 54.5 |
| 4→3 | 34.8 | 40.0 | 48.6 | 62.9 | 66.5 |
| 5→4 | 46.2 | 52.8 | 63.9 | 75.8 | 78.3 |
| 6→5 | 58.7 | 66.9 | 80.6 | 88.1 | 88.9 |

## Single-Cylinder Ag (`single-cylinder-ag`)

| Property | Value |
|---|---|
| Idle RPM | 280 |
| Redline RPM | 650 |
| Gear ratios | 4.5, 3.15, 2.35, 1.82 |
| Final drive | 4.75 |
| Wheel circumference | 2.25 m |
| Upshift duration | 380 ms |
| Downshift duration | 450 ms |
| Rev-match | no |
| Kickdown | threshold 0.92, maxSteps 1 |
| Torque converter slip | no |
| Shift map valid | yes |
| Schedule RPM @10/50/100% | 437 / 466 / 588 |

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
| 1→2 | 2.8 | 2.9 | 2.9 | 3.1 | 3.7 |
| 2→3 | 3.9 | 4.1 | 4.2 | 4.4 | 5.3 |
| 3→4 | 5.3 | 5.5 | 5.6 | 5.9 | 7.1 |

### Downshift speeds by demand (km/h)

| From gear | 10% | 25% | 50% | 75% | 100% |
|---|---:|---:|---:|---:|---:|
| 2→1 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 3→2 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 4→3 | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 |
