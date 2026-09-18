# Fusion Audio — Engine + Symphony

**Status:** V1 live
**Principle:** The engine becomes part of the musical experience — not two players at full volume.

## Pipeline

```
DriveState
  → shared Drive Energy (via Symphony path)
  → Machine backend (Dynamic Drive / Improved / Hybrid V2)
  → Symphony arrangement (fixed BPM, quantized stems)
  → FusionMixer (Machine · Music · Atmosphere · Events)
  → optional Harmonic Resonance (machine path)
  → StrategyBuses.body → cabin → master → limiter
```

Single `AudioContext` via `DriveSession` → `SoundEngine` → `FusionSynth`.

## Buses

| Bus        | Role                      |
| ---------- | ------------------------- |
| Machine    | Engine / drivetrain voice |
| Music      | Symphony stems            |
| Atmosphere | Soft shared bed           |
| Events     | Accents / fills           |

Default mix intent ≈ **40% machine / 60% music**, applied with **perceptual (equal-power) curves** — not linear faders.

Dynamic accommodation:

- Acceleration / driver demand → machine more present
- Musical climax → music expands; machine keeps a little space (no dance-style pumping unless `softPump`)

## Harmonic Resonance

Optional subtle peaking EQ on the machine bus at the Symphony pack root + fifth.

- Not pitch-correction / Auto-Tune
- Depth 0..1 (presets ~0.2–0.35)
- Soft high-shelf cut reduces masking

Flag/depth adjustable on `/fusion`.

## Presets

| Id                           | Name                | Machine            | Music            |
| ---------------------------- | ------------------- | ------------------ | ---------------- |
| `fusion-road-anthem`         | Road Anthem         | GT V8              | Cinematic Rock   |
| `fusion-mechanical-symphony` | Mechanical Symphony | Flat-Six           | Motion Orchestra |
| `fusion-midnight-boost`      | Midnight Boost      | Turbo I6           | Neon Run         |
| `fusion-future-pulse`        | Future Pulse        | Synthetic Hyper EV | Neon Run         |

Custom blends save to `settings.savedFusionPresets` and Garage · Experiences.

## Flags

`FUSION_ENABLED` — default **on** (`0` to disable).

## Modules

`src/lib/fusion/` — mixer, harmonic-resonance, presets, fusion-synth, fusion-profiles.

## Tesla checklist

1. `/fusion` → Road Anthem → Preview — hear machine under music, not a scrubbed track.
2. Push mix toward Machine, then Music — perceptual balance, no hard mute until extremes.
3. Raise Harmonic Resonance slightly — machine feels “in key” without singing notes.
4. Start Fusion Drive — cruise sits under arrangement; tip-in brings engine forward.
5. Switch Experience Engine → Symphony → World → Fusion → Engine — no leftover stems, no second context.
