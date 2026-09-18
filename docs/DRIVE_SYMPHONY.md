# Drive Symphony V1

**Status:** Engine live (procedural stem placeholders).
**Principle:** The driver conducts the arrangement — not a speed-controlled music player.

## Pipeline

```
DriveState
  → Drive Energy / Musical Intent (smoothed)
  → Semantic events (rate-limited)
  → Quantized arrangement (bar/beat boundaries)
  → Stem mixer (phase-aligned loops)
  → StrategyBuses.body → cabin → master → limiter
  → Output
```

Single `AudioContext` via `DriveSession` → `SoundEngine` → `SymphonySynth`.

## Modules (`src/lib/symphony/`)

| File                    | Role                                           |
| ----------------------- | ---------------------------------------------- |
| `drive-energy.ts`       | Drive Energy 0..1 + movementState + hysteresis |
| `music-clock.ts`        | Fixed BPM clock on `AudioContext.currentTime`  |
| `events.ts`             | Semantic bus (`energy_rise`, `upshift`, …)     |
| `arrangement-engine.ts` | Movement → stem gains; quantized transitions   |
| `stem-player.ts`        | Gapless looped stems; mute ≠ stop clock        |
| `procedural-stems.ts`   | Dev placeholder buffers (bar-aligned)          |
| `packs/*`               | Cinematic Rock, Motion Orchestra manifests     |
| `symphony-synth.ts`     | Facade wired from `SoundEngine`                |
| `demo-sequence.ts`      | ~32s parked demo script                        |

## Drive Energy (not speed/maxSpeed)

Default weights (`DEFAULT_ENERGY_WEIGHTS`):

| Input         | Weight | Notes                                |
| ------------- | ------ | ------------------------------------ |
| driverDemand  | 0.34   | throttle / powertrain demand         |
| acceleration  | 0.28   | tip-in raises energy at low speed    |
| speed context | 0.18   | soft curve; 120 km/h cruise ≈ medium |
| engine load   | 0.22   |                                      |
| regen         | 0.35   | pulls energy down                    |

EMA time constants: energy 0.55s, momentum 0.9s, smoothness 1.1s, tension 0.4s.

Movement states: `stopped` → `calm` → `cruise` → `building` → `energetic` → `peak`, plus `decelerating`. Hysteresis prevents flapping.

## Musical clock

- BPM fixed per pack (Cinematic Rock 112, Motion Orchestra 96).
- **Driving does not scrub tempo.**
- Changes quantize to beat / half-bar / bar / two bars.

## Packs

- **Cinematic Rock** — `symphony-cinematic-rock`
- **Motion Orchestra** — `symphony-motion-orchestra`

Select in Drive Experience picker or `/symphony`. Flag: `SYMPHONY_ENABLED` (default **on**; set `0` to disable).

## Assets

See `docs/SYMPHONY_AUDIO_ASSETS.md`. Development synthesis is available locally, while production
requires approved per-asset manifests and original, commissioned, or licensed stems.

## Debug

`/debug/symphony` (dev) — JSON diagnostics from `SoundEngine.getSymphonyDiagnostics()`.

## Tesla test procedure

1. Park. Enable audio. Open `/symphony` → **Listen — Demo**. Confirm energy meter and stem dots follow the sequence without feeling like a scrubbing track.
2. `/drive` → Change experience → **Cinematic Rock** → Start Drive (passenger phone optional).
3. Steady cruise: arrangement stable (no stem flicker).
4. Brief accel: denser drums/guitar at next beat/bar — not instant solos.
5. Lift / regen: arrangement thins at half-bar/bar.
6. Stop: resolve toward atmosphere.
7. Kill phone briefly: music clock continues (no song restart).
8. Switch to GT V8: Symphony sources dispose cleanly; engine sound returns.
