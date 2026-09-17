# Audio Realism V2.1

**Status:** Implemented (procedural-first). Sample-assisted path is wired for dual-player crossfade when buffers are injected; no combustion WAVs ship yet.

**Related:** `docs/SOUND_CHARACTER_SPEC.md`, `docs/audio-asset-requirements.md`, `docs/SOUND_NOISE_AND_FIDELITY.md`, `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`, `docs/POWERTRAIN_CALIBRATION_V2.md`

---

## Goal

Combustion Sound Profiles must sound like a living mechanical powertrain — not an electronic synthesizer.

Powertrain V2/V3 remains authoritative for:

speed · mechanical RPM · driver demand · engine load · gear · target gear · shift phase · overrun · regen · kickdown

Realism V2.1 consumes those fields. It does **not** invent a parallel gearbox.

Do **not** solve realism by EQ-ing sawtooth voices, raising broadband noise, or spawning hundreds of per-fire `AudioNode`s.

---

## Why V1 / “Current” sounded electronic

| Cause | Effect |
| --- | --- |
| Dominant saw / multi-oscillator stacks | Pitch-bent synth voice as RPM rises |
| Globally pitch-shifted harmonics | Everything scales with RPM like one oscillator |
| Continuous filtered noise beds | Hiss / whoosh instead of combustion pressure |
| White/pink shift “swooshes” | Fake gear events |
| Cap ~40 Hz per-stroke pulse nodes | Either too soft or too expensive if uncapped |
| Missing semi-stationary resonances | No stable exhaust/body “place” |

---

## Architecture (V2.1)

```
DriveState (+ VirtualPowertrainState)
  → HybridCombustionSynth.update
       ├─ firingHz = RPM × cylinders / 120   (four-stroke)
       ├─ AudioWorklet excitation (or AM brown fallback)
       │     architecture / sharpness / load / irregularity
       │     → exhaust formants (mostly stationary)
       │     → body / structure peaking resonances (mostly stationary)
       │     → spectral tilt (load → timbre)
       │     → intake formants → beds
       ├─ triangle/sine support harmonics (subordinate, order-linked)
       ├─ mechanical bandpass (restrained)
       ├─ overrun / turbo (state-gated, spool inertia)
       ├─ shift: Powertrain shiftLoadMultiplier + phase; resonant engagement only
       └─ optional sample A/B crossfade (0.85–1.18 rate) under procedural
  → body / accents / beds → cabin EQ → MasterBus (Road Feel V3 gains) → limiter
```

**Default:** `SoundEngine` realism engine is **`v2`** for eligible combustion profiles. Debug `/debug` A/B can still select **Current Engine**.

Lifecycle preserved: DriveSession, profile crossfade, cabin EQ, Road Feel V3 perceptual volume / MasterBus / limiter.

---

## Combustion DSP

| Mode | Mechanism |
| --- | --- |
| Worklet | `/audio/combustion-processor.js` — one processor, impulse train at `firingHz` |
| Fallback | Single looping brown buffer AM’d by one sine at `firingHz` + soft shaper |

Impulse ≈ pressure event. Load raises punch + brightness inside the worklet. Architecture codes:

| Code | Character |
| --- | --- |
| 0 | Even (I6 / V10 / I4) |
| 1 | Lope (American V8) |
| 2 | Flat overlapping (Flat-Six) |
| 3 | Cross-plane refined (GT V8) |
| 4 | V-twin uneven |
| 5 | Single |

No per-fire `OscillatorNode` / `AudioBufferSourceNode` creation.

---

## Resonance model

- **Exhaust formants** — band/lowpass centers from personality; slight upper-band RPM drift only
- **Body resonances** — peaking filters nearly fixed in Hz (anti pitch-bent synth)
- **Intake formants** — demand/load open them; close on overrun / torque cut
- **Spectral tilt** — highshelf moves with load (timbre change at fixed RPM)

---

## Personality model

Configured in `src/lib/sound/realism/v2/acoustic-engine.ts`:

| Profile | Feel |
| --- | --- |
| GT V8 | Dense, refined, broad-spectrum |
| American Muscle V8 | Lower pulse, idle lope, exhaust-dominant |
| Flat-Six Sport | Smooth, precise, strong intake development |
| Turbo Inline-6 | Deep midrange + load-linked spool |
| Racing V10 | Dense high-RPM intake richness |
| Motorcycle / Big Twin | High-RPM I4 / lopey twin (secondary priority) |

---

## Load response

At **identical RPM**, 10% vs 50% vs 90% load must differ via:

combustion intensity · sharpness · spectral tilt · formant Q/energy · intake · body resonance excitation · support density

Not gain alone.

---

## Shift integration

Uses Powertrain phases + `shiftLoadMultiplier`:

| Phase | Audio |
| --- | --- |
| torque_cut / disengage | Combustion/intake energy drops |
| ratio_transition | RPM falls/rises from powertrain |
| reengage | Short resonant engagement impulse |
| settle | Load restores |

Primary cue = **RPM + load interruption**, not a white-noise transient.

---

## Sample architecture

Schema: `sample-bank.ts`. Inject decoded buffers via `HybridCombustionSynth.setDecodedSamples`.

- Crossfade adjacent RPM refs within load region
- Playback rate clamped ≈ **0.85–1.18**
- Samples assist **under** procedural excitation (never sole source)
- Premium assets via catalog — not dumped in `public/`

Empty banks → 100% procedural.

---

## Performance strategy

- Reuse a fixed node graph (~tens of nodes, not hundreds/sec)
- Prefer AudioWorklet for excitation
- Diagnostics: `getHybridCombustionDiagnostics()` → excitationMode, firingHz, shiftPhase, activeNodeEstimate, audioContextState
- Road Feel V3 master gain chain unchanged

---

## Fallback

1. Worklet unavailable → AM brown fallback (still pulsed, not naked saw stack)
2. Samples missing → procedural only
3. Non-combustion profiles → Current Improved / Dynamic Drive / classic paths

Legacy `createCombustionPulseLayer` (per-fire nodes, 40 Hz cap) is **not** on the V2.1 path.

---

## A/B method

| Control | Values | Where |
| --- | --- | --- |
| `SoundEngine.setRealismEngine` | `"current"` \| `"v2"` | Dev |
| Harness | Current Engine / Realism V2 | `/debug`, `/debug/calibration` |

Use the **same** prerecorded / scenario trace. Match loudness (Road Feel V3 staging + profile trim) before judging — louder must not win by default.

---

## Manual listening checklist (Tesla)

1. GT V8 idle → 3k → 5k: same mechanical character, not a bent oscillator
2. 3000 RPM light vs heavy load: clear intake/exhaust/body difference
3. Upshift 1→2: unload → RPM fall → engage → pull
4. Cruise 30 s+: no constant hiss or loop seam
5. Turbo I6: spool with load; flutter only after boosted lift
6. A/B Current vs V2 on `/debug` with matched volume

---

## What still needs licensed recordings

- Personality idle / cruise / high-load loops
- Shift / rev-match / overrun one-shots
- Turbo BOV / wastegate character samples

Procedural V2.1 is the production path until those exist.
