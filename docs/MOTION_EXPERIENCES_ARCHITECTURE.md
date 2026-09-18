# Motion Experiences Architecture

**Status:** Engine / Symphony / Worlds / Fusion V1 engines live (procedural audio placeholders where noted).
**Baseline commit:** `18606f3` (Free phone pairing, Road Feel V3, Realism V2.1).
**Last updated:** 2026-09-17

ELCAMOSO evolves from “an app that gives an EV different sounds” to a **motion-to-sound platform**: movement can become a machine, music, or another world.

Tagline remains: **Your EV. Your Sound. More Emotion.**
Central proposition: **Turn motion into sound.**

---

## Product taxonomy

### Experience (user-facing)

| Kind         | Meaning                 | Today                                                                             |
| ------------ | ----------------------- | --------------------------------------------------------------------------------- |
| **Engine**   | Feel a machine          | Existing combustion / physical SoundProfiles via `/sounds`                        |
| **Symphony** | Drive the music         | Fixed-BPM arrangement engine + packs (Cinematic Rock, Motion Orchestra, Neon Run) |
| **World**    | Enter another world     | Reactive World engine (Space / Cyber / Storm) + curated Arcade / Ocean            |
| **Fusion**   | Blend machine and music | Engine + Symphony via FusionMixer + Harmonic Resonance                            |

### Relationship to SoundProfile

Chosen architecture: a **thin `ExperienceDescriptor` layer** above `SoundProfile` — not a rewrite.

- `SoundProfile` remains the runtime audio identity (`capabilities.profileId`).
- Symphony / World / Fusion profiles select specialized synth backends in `SoundEngine`.
- Drive continues to select `settings.profileId` for playable experiences.

Code: `src/lib/experiences/` (`types.ts`, `catalog.ts`, `flags.ts`).

### Drive Symphony — **V1 shipped**

See `docs/DRIVE_SYMPHONY.md`. Flag: `SYMPHONY_ENABLED` (default on).

### Worlds — **V1 shipped**

See `docs/WORLDS_ENGINE.md`. Flag: `WORLDS_ENGINE_ENABLED` (default on).

### Fusion — **V1 shipped**

See `docs/FUSION_AUDIO.md`. Flag: `FUSION_ENABLED` (default on).

### Future Journey / Drive Song (Phase 4) — **V1 shipped**

- **Drive Song** — condensed local composition (`DRIVE_SONG_ENABLED`, default on)
- **Drive DNA** — musical motion signature (not a safety score)
- **Journey** — `/journeys` library; Garage → Journeys links here
- See `docs/JOURNEY_COMPOSER.md`, `docs/DRIVE_DNA.md`, `docs/DRIVE_SHARING_PRIVACY.md`

---

## Routes

| Route       | Role                                                         |
| ----------- | ------------------------------------------------------------ |
| `/`         | Repositioned landing — Turn motion into sound                |
| `/explore`  | Discovery hub (four families + Recent / Favorites / For you) |
| `/sounds`   | Engine / Sound Profile catalogue (**preserved**)             |
| `/symphony` | Drive Symphony overview + Listen demo                        |
| `/worlds`   | Worlds Listen + Start Drive                                  |
| `/fusion`   | Fusion mixer + presets + Save to Garage                      |
| `/drive`    | Experience picker when parked; safety mode unchanged         |
| `/garage`   | Tabs: Sounds · Experiences · Songs · Journeys                |
| `/studio`   | Unchanged                                                    |

Primary nav: **Drive · Explore · Studio · Garage**. `/sounds` remains linked from Explore and desktop menu.

---

## Feature flags

| Env                     | Default | Gates                      |
| ----------------------- | ------- | -------------------------- |
| `SYMPHONY_ENABLED`      | on      | Playable Symphony in Drive |
| `FUSION_ENABLED`        | on      | Live Fusion mix            |
| `WORLDS_ENGINE_ENABLED` | on      | Reactive Worlds engine     |
| `DRIVE_SONG_ENABLED`    | on      | Drive Song composer        |
| `DRIVE_REEL_ENABLED`    | on      | Drive Reel highlight       |

Convention matches `MONETIZATION_ENABLED` (`src/lib/experiences/flags.ts`).

---

## Non-regressions

Do not regress Road Feel V3, Powertrain V2/V3, Realism V2.1, Free phone QR pairing, single AudioContext, DriveSession lifecycle, auth, entitlements, Studio, Garage data, sharing, safety mode, i18n EN/DE/RO.

Profile count grows with Symphony / World / Fusion backend profiles; classic Improved strategies remain for non-backend ids.

---

## Terminology

**User-facing:** Experience, Engine, Symphony, World, Fusion, Drive Song, Drive DNA, Journey.
**Internal only:** oscillator, worklet, gain graph, AudioContext, fusion algorithm, telemetry.
