# Journey Trace V1

Versioned, privacy-safe motion log for Silent Capture / Live+Capture.

## Schema (`JourneyTraceV1`)

```
version: 1
journeyId
startedAt / endedAt / durationMs
outputMode: live | capture | live-and-capture
captureProfileId   // selection at capture time — not baked into samples
status: recording | complete | incomplete
samples[]          // personality-independent motion
semanticEvents[]
gaps[]
summary
```

### Sample fields

`t`, `speedKmh`, `acceleration`, `longitudinalAccel`, `jerk`,
`driverDemandEstimate`, `regenEstimate`, `movementConfidence`,
`sourceQuality`, `primarySource`

**Never stored:** latitude, longitude, street, route, home, destination.

### Semantic events

`movement_start`, `strong_acceleration`, `cruise_start`, `cruise_end`,
`lift`, `regen`, `stop`, `data_gap`, `capture_paused`, `capture_resumed`

### Gaps

`startT`, `endT`, `reason`: visibility | sensor_loss | browser_suspend | unknown

## Sampling

`AdaptiveTraceSampler` — target **8–15 Hz**:

- Dynamic accel: ~12 Hz (≈85 ms)
- Steady cruise: down toward ~5–8 Hz
- Chunk flush ~ every 4 s for crash recovery

### Storage size (estimate)

~110 bytes JSON / sample → **~12 Hz × 3600 ≈ 4.8 MB / hour** (JSON).

Future: typed-array / binary chunks for large journeys. Cap: 30 traces in IndexedDB.

## Repository

`JourneyRepository` (`src/lib/journey-trace/repository.ts`) — IndexedDB `elcamoso-journey-traces`:

- createJourney / appendChunk / finalizeJourney
- loadJourney / listJourneys / deleteJourney
- cleanupIncompleteJourney
- interpretations store (experienceId + seed per re-listen)

Native apps can swap the repository implementation.

## Replay / reinterpretation

`JourneyReplaySource` / `JourneyTraceReplaySource`:

- Emits `DriveState` for the same SoundEngine / Symphony / World / Fusion path
- Optional `profileId` re-runs **PowertrainSimulator** against raw motion
  → same drive, different virtual gears/RPM per Engine personality
- Raw JourneyTrace is never mutated

Motion Signature: `energySamplesFromJourneyTrace` → `generateMotionSignature`

### Journey Player (`/journeys/$journeyId`)

- **REPLAY DRIVE** is real-time and follows the captured duration and time index.
- **DRIVE SONG** is a separate Journey Composer product condensed to 2–3 minutes.
- Engine choices (GT V8, Flat-Six, Turbo I6, V10, and other virtual-transmission profiles) rebuild driver demand, gear, RPM, shift state, and load with that profile's own `PowertrainSimulator`.
- Pause, seek, restart, stop, and interpretation switching operate on one immutable Journey. Stop can park the playhead for the next interpretation.
- Engine / Symphony / World / Fusion selections can be saved as `JourneyInterpretationV1`; the UI calls these **Remixes**.
- Interpretation seeds are stable per Journey by default and saved with each Remix. Replaying the same Symphony seed produces the same arrangement decisions.
- Interpretation switching awaits old `SoundEngine.stop()` teardown before constructing the replacement graph.
- Development-only **A/B SAME DRIVE** advances both Engine sources from the same time index and never feeds B with A's interpreted state.

Replay invariants covered by tests:

- one trace produces different virtual RPM/gears for different Engine personalities;
- repeated `peek`, seek, and restart remain deterministic;
- identical Symphony seeds produce identical arrangement snapshots;
- profile switching keeps at most one synthesis strategy and leaves zero tracked voices after stop.

## Modules

| Path                                  | Role                      |
| ------------------------------------- | ------------------------- |
| `src/lib/journey-trace/types.ts`      | Schema                    |
| `src/lib/journey-trace/sampler.ts`    | Adaptive capture          |
| `src/lib/journey-trace/repository.ts` | IndexedDB                 |
| `src/lib/journey-trace/replay.ts`     | Replay + reinterpretation |
| `src/lib/drive/session.ts`            | DriveOutputMode wiring    |

## Remaining native requirements

- Reliable background capture (OS background modes)
- Lower-power IMU sampling
- Binary/chunked storage for multi-hour drives
- Optional explicit route-history feature (off by default, separate consent)
