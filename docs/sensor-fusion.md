# Sensor fusion

Multi-source motion fusion produces a single `VehicleMotionState` for the virtual drivetrain and audio engine. Raw coordinates never leave the device; relay payloads strip latitude/longitude.

## Input hierarchy

| Priority | Channel           | Source tag          | Role                                                     |
| -------- | ----------------- | ------------------- | -------------------------------------------------------- |
| 1        | Vehicle telemetry | `vehicle-telemetry` | Accurate speed/accel baseline (Fleet API stream or poll) |
| 2        | Phone IMU         | `phone`             | Fast transients (acceleration spikes, lead correction)   |
| 3        | Phone GPS         | `phone`             | Speed fallback when telemetry is absent or stale         |
| 4        | Tesla browser IMU | `tesla-browser`     | IMU fallback when phone relay is unavailable             |
| 5        | Tesla browser GPS | `tesla-browser`     | Final speed fallback                                     |

Ingress helpers: `browserGpsMotionSample`, `browserImuMotionSample`, `phoneRelayMotionSample`, `vehicleTelemetryMotionSample`.

Channel logic: `src/lib/motion/sensor-fusion-channels.ts`.

## Output

`VehicleMotionState` — speed, filtered/transient acceleration, inferred throttle, confidence, primary source, fallback tier, source health.

Fed into `PowertrainSimulator.tick()` when Dynamic Drive is active (`src/lib/drive/session.ts`).

## Processing pipeline

1. **Ingest** — `pushMotionSample()` merges partial updates per source, rejects GPS speed spikes, aligns timestamps.
2. **Stale rejection** — per-source age limits (IMU ~450 ms, phone ~2.8 s, telemetry ~1.2 s, browser GPS ~5 s).
3. **GPS accuracy rejection** — fixes with accuracy > 80 m ignored for speed baseline.
4. **Speed baseline** — priority: telemetry → phone GPS → Tesla browser GPS.
5. **Layered speed fusion** — `fuseSpeedLayers()` applies the slow anchor, lets phone IMU lead transients, then rate-limits correction toward the anchor (no abrupt jumps).
6. **IMU transients** — phone accelerometer preferred; browser IMU fallback. `fuseAccelLayers()` with spike rejection (`MAX_ACCEL_SPIKE`).
7. **Correction** — lag-aware, conflict-aware rate limits; when the fast layer leads, correction is gentler so phone spikes arrive before telemetry catches up.
8. **Fallback tiers** — telemetry → phone → browser → hold → decay when sources drop (`motion-fallback.ts`). Reconnect uses a ~1.5 s blend window. Type: `MotionFallbackTier` in `types.ts` (single canonical definition).
9. **Confidence** — blends GPS freshness, IMU live, telemetry, and fallback tier.

Relay loss helpers: `markTelemetryRelayLost()`, `markPhoneRelayLost()`, `markPhoneRelayRestored()`.

## Key files

| File                          | Role                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| `sensor-fusion.ts`            | Fusion state, tick, ingest                                 |
| `sensor-fusion-correction.ts` | Layered speed/accel correction, conflict/lag tuning        |
| `sensor-fusion-channels.ts`   | Input channel model                                        |
| `motion-fallback.ts`          | Tier transitions, hold/decay, reconnect blend              |
| `types.ts`                    | `MotionSample`, `VehicleMotionState`, `MotionFallbackTier` |
| `filters.ts`                  | Low-pass, spike reject, interpolate                        |
| `fusion-scenarios.ts`         | Fusion → powertrain test scenarios                         |

## Tests

```bash
npm test -- src/lib/motion/sensor-fusion.test.ts
npm test -- src/lib/motion/sensor-fusion-correction.test.ts
npm test -- src/lib/motion/fusion-scenarios.test.ts
npm test -- src/lib/drive/driving-scenarios.test.ts
```

`sensor fusion hierarchy and correction` covers:

- Telemetry lag with phone IMU leading
- Phone acceleration ahead of telemetry correction
- Telemetry disconnect → phone fallback
- Conflicting telemetry vs phone GPS (no abrupt jumps)
- Bad phone GPS ignored when telemetry is healthy
- Telemetry reconnect with smooth blend
- Tesla browser GPS as final fallback

Scenarios F/G (phone loss, telemetry reconnect) and H–K validate physically plausible motion before RPM/gear.
