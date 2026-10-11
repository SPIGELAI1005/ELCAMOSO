# Raw mechanical audio acceptance (Prompt 07)

**Status:** automatically verified (unit lifecycle) · listening **unverified** · device **unverified**  
**Catalog count:** **47** core Sound Profiles · **57** assembled public IDs ( +3 Symphony, +3 World, +4 Fusion ).  
**IDs / entitlements / favourites:** unchanged.

This document does **not** claim that every sound is authentic. Procedural improvements shipped for the full catalog; hybrid sample banks remain **awaiting assets** where recordings were never supplied.

## What shipped (runtime)

| Path | Change |
| --- | --- |
| `src/lib/sound/realism/catalog-tuning/` | Typed per-ID tuning matrix (57), family defaults, apply helpers, listening rubric scaffold |
| `acousticEngineForProfile` | Merges Prompt 07 acoustic overlays for the 9 Realism V2 combustion IDs |
| `profileExperienceConfig` | Merges Prompt 07 experience overlays for all 57 public IDs |
| Untuned baselines | `acousticEngineBaseForProfile` / `profileExperienceConfigBase` for A/B |
| Tests | `catalog-tuning.test.ts`, `all-profiles-finite.test.ts` (build → regime update → dispose) |
| Matrix | `docs/audio/profile-upgrade-matrix-prompt-07.md` |
| Captures | `npm run audio:prompt-07` → `artifacts/audio-lab/prompt-07-catalog/` (targeted subset) |

## Family guidance applied (matching IDs only)

| Guidance | Matching live IDs |
| --- | --- |
| Cross-plane muscle V8 | `american-muscle-v8` (primary); `big-twin` shares intake restraint / pulse weight with distinct V-twin architecture |
| Cross-plane GT V8 | `gt-v8` |
| Flat-six / sports six | `flat-six-sport` |
| Turbo inline-six | `turbo-inline-6` (street spool); `rally-car` uses faster turbo I3 deviation |
| High-rev V10 / race | `racing-v10`, `race-car`, `motorcycle-superbike` |
| Diesel / heavy mechanical | **No diesel ID in catalog.** Closest: `wiesn-tractor`, `tank`, `construction-monster`, `steam-train` (procedural / asset-pending) |
| Electric / futuristic | `cyber-pulse`, `electric-hypercar`, `formula-electric`, trains, `fusion-future-pulse`, … |
| Creature / cinematic / ambient | dragon/thunder-beast, carriages, wind/ocean/zen, worlds, … |

V3 raw-mechanical opt-in pilots remain `american-muscle-v8` and `flat-six-sport` only (`VITE_DRIVE_AUDIO_V3`). Prompt 07 does not expand pilot IDs.

## Listening rubric (humans only)

Score **1–5** after loudness-matched A/B (`levelMatchGainDb` in lab). Automated meters must never fill these cells.

| Dimension | Guide |
| --- | --- |
| Bass / body | Mass appropriate to identity (not mud, not thin) |
| Raw mechanical character | Believable texture for the stated identity |
| Identity | Sounds like this profile’s promise, not a neighbor clone |
| Load responsiveness | Idle / cruise / load / release read differently for a reason |
| Shift believability | Sequenced when engaged; gearless free of fake clacks |
| Harshness / fatigue | Comfortable on long listen without dulling identity |
| Loop artefacts | No obvious seams, pumping, or periodic glitches |

### Score sheet

All **57** IDs start **unverified**. Copy a row when a listener scores.

| profileId | loudnessMatched | bassBody | rawMechanical | identity | loadResp | shift | harshness | loops | scoredBy | scoredAt | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| *(none yet)* | | | | | | | | | | | |

## Remaining gaps (honest)

| Gap | Detail |
| --- | --- |
| Approved hybrid recordings | Combustion sample banks still empty / awaiting acquisition (`docs/audio/SAMPLE_ACQUISITION_BRIEF.md`) |
| Diesel acoustic engine | Not in `ACOUSTIC_ENGINE_BY_PROFILE`; tractor is experience-tuned + asset-pending |
| Human listening | 0 / 57 listening-verified |
| Device (cabin / phone / car BT) | 0 / 57 device-verified |
| Full-catalog WAV portfolio | Unit lifecycle covers 57; Chromium lab renders target a family subset unless `AUDIO_LAB_PROFILES` lists all |
| Baseline vs after WAV pairs | After paths written by `audio:prompt-07`; pre-Prompt-07 baselines may be regenerated from `acousticEngineBaseForProfile` / experience base if needed for A/B |
| Authenticity | Procedural improvement ≠ recorded authenticity |

## How to accept a profile

1. Render loudness-matched A/B (lab or `npm run audio:prompt-07`).
2. Score the seven rubric dimensions; set `loudnessMatched=true`.
3. Update the score sheet above and the matrix `humanListeningStatus`.
4. Only then mark `listening-verified` in progress tracking — never from peak/LUFS alone.

## Related

- Complete matrix: `docs/audio/profile-upgrade-matrix-prompt-07.md`
- Prior matrix audit: `docs/audio/profile-upgrade-matrix.md`
- Progress: `docs/DRIVE_COCKPIT_V2_PROGRESS.md`
- Rubric code: `src/lib/sound/realism/catalog-tuning/listening-rubric.ts`
