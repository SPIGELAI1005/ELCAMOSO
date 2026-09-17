# Road-test calibration workflow

Repeatable Tesla (and phone-relay) road testing for ELCAMOSO virtual powertrain and Realism V2 audio.

**Goal:** record one real drive once, then replay the same motion locally while changing transmission and audio calibration—without re-driving for every code change.

Dev-only UI: [`/debug/calibration`](../src/routes/debug.calibration.tsx) (not in customer navigation). Related: [`POWERTRAIN_CALIBRATION_V2.md`](./POWERTRAIN_CALIBRATION_V2.md), [`AUDIO_REALISM_V2.md`](./AUDIO_REALISM_V2.md).

## Principles

- Traces store **time + speed + accel + demand/load + gear/RPM/shift + motion source metadata**. They do **not** store latitude/longitude or a GPS route.
- Schema kind `elcamoso.calibration.trace`, **version 1**. Old or wrong kinds/versions fail parse instead of silently breaking.
- Same trace + drivetrain personality + settings → same gear sequence, shift times, RPM, demand, and powertrain events (no uncontrolled drivetrain randomness).
- Audio variety may use a **fixed seed** during replay so Current vs Realism V2 A/B stays comparable.
- Subjective ratings are local calibration notes only—not automated quality truth. There is **no single “realism score.”**

## Capture (Tesla browser)

1. Park or have a passenger operate the phone/UI. Do **not** interact while the car is moving unless conditions are safe and you are not the driver.
2. On the car browser (dev build), open **Drive**, start a normal session with the Sound Profile and Dynamic Drive settings you want to evaluate.
3. Open `/debug/calibration` → **Tesla road-test mode**.
4. Large controls only:
   - **Start calibration recording** — buffers ~20 Hz samples (no sync JSON on the audio/motion path).
   - **Mark problem** — timestamp marker only (no typing while moving).
   - **Stop** — finishes the trace; attach labels after.
5. After stop, label markers (examples): wrong upshift, shift too late, RPM jump, sound too electronic, too much hiss, kickdown missed, engine sound disconnected from speed.
6. **Export JSON** (or rely on localStorage; export before clearing browser data).

Phone-relay motion is fine: source / confidence / fallback tier are stored so sensor transitions can be reproduced **without** the route.

## Export / import

- Export produces versioned JSON (`elcamoso.calibration.trace` v1).
- Import the same file in the Calibration lab (desktop Chrome/Edge recommended for listening).
- Local store keeps a small number of recent traces; treat export as the durable artifact.

## Replay locally

1. Open `/debug/calibration` (lab mode).
2. Import the JSON **or** pick a named scenario (Gentle city launch, Hard acceleration, Highway kickdown, GPS noise/spike/dropout, phone reconnect, etc.).
3. Choose Sound Profile / personality.
4. Optional: **Resimulate powertrain** to re-run Dynamic Drive on the recorded speed/demand (same motion inputs, current gearbox code).
5. Playback: Play / Pause / Restart, **0.5× / 1× / 2×**, scrub the timeline.
6. Synced traces: speed, gear, RPM, mechanical RPM, demand, load; coral marks on every shift. Click a shift for before/after speed, gears, RPM, demand, reason, duration.
7. Metrics panel: up/down shifts, hunting, hold times, RPM discontinuities, shift RPM error, redline flags, kickdown latency, sensor-transition-induced shifts—**flags, not a realism score**.

## Current vs Realism V2 A/B

1. Load one motion trace.
2. Press **Play**.
3. Toggle **Current** ↔ **Realism V2** while playback continues—**motion does not restart**.
4. Loudness is approximately matched for listening; still use headphones and a quiet room.
5. Optionally toggle **Dynamic** vs **Legacy** powertrain audio path the same way.
6. Use subjective buttons (Mechanical/Electronic, Natural/Artificial shift, Good/Weak load, Comfortable/Fatiguing). Notes stay on-device.

## Before / after comparison

1. Load a baseline replay → **Set as before**.
2. Change code or resimulate with a different personality → load the new result.
3. Read the comparison narrative: e.g. “Gear 2→3: before 48.2 km/h @ …; after 52.1 km/h @ …” under the same demand.
4. Interpret deltas as **behavior change**, not automatic proof of more realism.

## Regression fixtures

Sanitized scenario traces live under `src/lib/calibration/fixtures/` (no personal routes). Vitest locks soft bands (no hunting, limited RPM discontinuities, no sensor-transition shifts on those cases). Update fixtures intentionally when gearbox behavior is meant to change.

## Performance note

Recording uses a buffered ~20 Hz timer. Serialization/export happens only on stop/export—never large JSON stringify inside `requestAnimationFrame`.

---

## Next real drive — concise checklist

1. Dev build on Tesla browser; passenger or parked for UI.
2. Drive session on: preferred combustion Sound Profile, Dynamic Drive on, Realism V2 if available.
3. `/debug/calibration` → Tesla road-test mode → **Start**.
4. Cover in one loop if possible:
   - gentle city launch
   - normal then hard acceleration
   - 50 / 80 / ~120 km/h steady
   - highway tip-in (kickdown)
   - lift-off from ~100 km/h
   - progressive brake to stop
   - a few 30–50 km/h urban cycles
5. If phone relay is paired: briefly disconnect/reconnect once; **Mark problem** if the gearbox or sound jumps.
6. **Mark problem** on any wrong shift, late shift, RPM jump, electronic/hiss feel, missed kickdown, or speed–sound disconnect (no typing while moving).
7. Stop → label markers → **Export JSON**.
8. At the desk: import → replay → A/B Current vs Realism V2 on the same trace → note subjective ratings → set before/after if comparing a code change.
