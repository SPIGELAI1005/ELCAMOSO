# Drive Cockpit V2 + Raw Mechanical Audio — Progress

**Pack:** `cursor-prompts/ELCAMOSO_DRIVE_AUDIO_UPGRADE.md`  
**Plan:** `docs/DRIVE_COCKPIT_V2_PLAN.md`  
**Last updated:** 2026-10-11 (Prompt 14)

Status values: `not started` · `in progress` · `implemented` · `automatically verified` · `listening-verified` · `device-verified` · `production-configured` · `blocked` · `deferred`

| Prompt | Title | Status | Notes |
| --- | --- | --- | --- |
| **00** | Repository audit and implementation map | **implemented** (docs) | PLAN + PROGRESS + matrix audit note. No runtime/audible changes. Baseline checks recorded below. |
| **01** | Reproducible audio diagnosis and comparison lab | **implemented** + **automatically verified** (unit) | Production SoundEngine lab: fixtures, metrics, `/debug/audio-lab`, `npm run audio:lab`. Full portfolio WAV capture **pending** until CLI run. Listening **not** claimed. |
| **02** | Typed acoustic contracts and per-profile recipes | **implemented** + **automatically verified** (unit) | Extended `AcousticProfileSpec.recipe` for all 57 IDs; gearless safety locked; no audible path change |
| **03** | Shared virtual drivetrain and earlier gear changes | **implemented** + **automatically verified** (unit) | City/Touring/Sport presets; sequence IDs; City default only behind `VITE_CITY_SHIFT_PRESET` |
| **04** | Raw mechanical combustion renderer | **implemented** + **automatically verified** (unit); listening **pending** | Opt-in `VITE_DRIVE_AUDIO_V3`; pilots Muscle + Flat-Six; Current/V2 fallback when flag off |
| **05** | Recorded sample layers and hybrid playback | **implemented** + **automatically verified** (unit); assets **awaiting** | Loader/manifest/cache/fallback; catalog empty; no invented recordings; granular **deferred** |
| **06** | Mechanical shift audio and load transitions | **implemented** + **automatically verified** (unit); listening **pending** | sequenceId choreography; shiftIntensity; engagement presets; stale discard |
| **07** | Tune every sound profile and prove coverage | **implemented** + **automatically verified** (unit); listening **unverified** | Full **57**-ID catalog tuning overlays; matrix + acceptance; assets/device still open |
| **08** | Gain staging, output boost and shared controls | **implemented** + **automatically verified** (unit); listening/device **unverified** | Coherent gain path; −1 dBFS peak protect; default volume 35%; boost + character; see `GAIN_STAGING.md` |
| **09** | Drive Cockpit UI + fast sound switching | **implemented** + **automatically verified** (unit); visual **partial** (Playwright screenshots when audio starts) | Branded `/drive` cockpit; shared settings; warm-start powertrain; entitlement-gated favourites; see completion record |
| **10** | Supabase passwordless email-code login | **implemented** + **automatically verified** (unit/mocks); staging delivery **pending** | Additive OTP; Google + magic-link preserved; ELCAMOSO cookie session; see `EMAIL_OTP_SETUP.md` |
| **11** | Free sounds, premium access, temporary unlocks | **implemented** + **automatically verified** (unit) | Free trio; access-resolver; grants + offline lease; see `ENTITLEMENTS.md` |
| **12** | Monthly reward service and reward wheel | **implemented** + **automatically verified** (unit); campaign **off** | Sound Spin behind `ELCAMOSO_REWARDS_ENABLED`; see `SOUND_SPIN.md` |
| **13** | Stripe discount fulfilment | **implemented** + **automatically verified** (unit/mocks); coupons **off** until configured | See `STRIPE_DISCOUNT_FULFILMENT.md`; no live coupons |
| **14** | Integration, device validation, staged release | **implemented** (docs + integration fixes); device/listening **pending** | See `DRIVE_COCKPIT_V2_RELEASE_CHECKLIST.md`; no auto-deploy |

## Prompt 00 completion record

### Files changed (this prompt)

| File | Change |
| --- | --- |
| `cursor-prompts/ELCAMOSO_DRIVE_AUDIO_UPGRADE.md` | Added (copy of pack) |
| `docs/DRIVE_COCKPIT_V2_PLAN.md` | Created |
| `docs/DRIVE_COCKPIT_V2_PROGRESS.md` | Created |
| `docs/audio/profile-upgrade-matrix.md` | Audit header note (Prompt 00); 57 ID rows retained |
| `docs/MEMORY_BANK_AND_CHANGELOG.md` | Changelog entry |

### Resulting behaviour

- **None audible / runtime.** Documentation and planning only.

### Catalog facts verified

- Core Sound Profiles: **47** (22 + 25 expansion)
- Assembled selectable: **57** (+3 Symphony, +3 World, +4 Fusion)
- Realism V2 combustion IDs: **9** (`ACOUSTIC_ENGINE_BY_PROFILE`)
- Family mismatches documented (not renamed): `neon-drive`, `dragon`, `thunder-beast`
- AcousticProfileSpec / `getAcousticProfileSpec`: present; CURSOR_PROMPTS Prompt 2 substantially complete (metadata-only)
- Auth: Google OAuth + email magic link; **no Supabase**; **no numeric OTP**
- Billing: FREE / DRIVE_PLUS + Stripe; `MONETIZATION_ENABLED` default off
- Listening-verified: **0 / 57**

### Feature flags

- No new flags introduced in Prompt 00.
- Planned ownership documented in PLAN §2.7.

### Unresolved dependencies

- Approved recorded engine banks: still **0** public runtime WAV assets
- Full 57-ID audio goldens: not present (narrow regression: primarily `gt-v8`, `cyber-pulse`)
- Production Postgres session/OTP storage: not in scope; note only
- Human listening / Tesla cabin: pending future prompts

### Manual verification steps (Prompt 00)

1. Open `docs/DRIVE_COCKPIT_V2_PLAN.md` and confirm paths resolve in the repo.
2. Confirm `SOUND_PROFILES` length 57 via `npm test -- src/lib/sound/profiles.test.ts` (or full baseline below).
3. Do **not** treat this audit as a listening diagnosis.

### Rollback

Revert the five documentation files listed above. No migrations, billing, or engine changes to roll back.

### Baseline checks (Prompt 00)

| Command | Result |
| --- | --- |
| `npm run typecheck` | **pass** (2026-10-11) |
| `npx vitest run` on `profiles.test.ts`, `getAcousticProfileSpec.test.ts`, `hybrid-combustion.test.ts`, `audio-regression.test.ts`, `simulator.test.ts` | **48/48 pass** |

Pre-existing failures: none observed in this focused baseline. Full `npm test` suite was not required for docs-only Prompt 00.

## Prompt 01 completion record

### Files changed

| File | Change |
| --- | --- |
| `src/lib/sound/lab/*` | Fixtures, metrics, metadata, harness, baseline reports, access, tests |
| `src/routes/debug.audio-lab.tsx` | DEV + secret-gated A/B lab UI |
| `src/routes/debug.tsx` | Link to Audio Lab |
| `scripts/render-audio-lab.mjs` | Headless capture CLI |
| `docs/audio/AUDIO_LAB.md` | Ops / limitations |
| `package.json` | `audio:lab` script |
| `.env.example` | `ELCAMOSO_AUDIO_LAB_SECRET` |

### Behaviour

- Deterministic synthetic fixtures (speed-driven + RPM/load diagnostic).
- Offline production `SoundEngine` capture with WAV + metadata; realtime path falls back with disclosed limits.
- Exclusive A/B playback, level-match, layer mute/solo.
- Metrics labeled honestly (no certified LUFS / true peak).
- Normal Drive playback unchanged (no always-on recording).

### Tests / smoke capture

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npx vitest run src/lib/sound/lab` | 10 pass, 1 skipped (no OfflineAudioContext in Node) |
| `AUDIO_LAB_PROFILES=gt-v8 AUDIO_LAB_FIXTURES=idle npm run audio:lab` | pass → `realism-v2-worklet` / `worklet` under `artifacts/audio-lab/prompt-01-smoke/` |

Full 57×fixture matrix not run in Prompt 01 (use `npm run audio:lab`). Listening-verified still 0/57.

### Feature flags / secrets

- UI: DEV open; deployed requires lab/billing admin secret.
- No new audible DSP flag (Prompt 04).

### Manual verification

1. `npm run dev` → `/debug/audio-lab` → Capture A on `gt-v8` / `gentle-0-80`.
2. Optional: `AUDIO_LAB_PROFILES=gt-v8 AUDIO_LAB_FIXTURES=idle npm run audio:lab`
3. Confirm BrandNav has no Audio Lab link.

### Rollback

Revert Prompt 01 files; keep `audio:compare` / `offline-comparison` intact.

## Prompt 02 completion record

### Files changed

| File | Change |
| --- | --- |
| `src/lib/sound/profile-specs/types.ts` | Additive `AcousticRecipe` (+ cycle, layers, VT, sample bank, headroom, listening) on `AcousticProfileSpec` |
| `src/lib/sound/profile-specs/family-defaults.ts` | **New** — foundation defaults per renderer kind |
| `src/lib/sound/profile-specs/recipe-build.ts` | **New** — distinct recipe per catalog ID; inheritance overrides; gearless safety |
| `src/lib/sound/profile-specs/build.ts` | Wires `recipe: buildAcousticRecipe(id)` |
| `src/lib/sound/profile-specs/validate.ts` | Clamps/repairs recipe fields; forces gearless `allowCombustionShiftAccents=false` |
| `src/lib/sound/profile-specs/index.ts` | Exports recipe helpers; `allCatalogAcousticProfileSpecs()` (57) |
| `src/lib/sound/profile-specs/getAcousticProfileSpec.test.ts` | 57-ID coverage, gearless safety, malformed clamps, comedy VT accents |
| `docs/audio/profile-upgrade-matrix.md` | Prompt 02 evidence locations |
| `docs/DRIVE_COCKPIT_V2_PLAN.md` | §2.3 updated |
| `docs/MEMORY_BANK_AND_CHANGELOG.md` | Changelog entry |

### Behaviour

- **None audible.** `SoundEngine` / strategies / family routing unchanged. Recipes are metadata until a later feature flag enables a new renderer.
- Every `PUBLIC_PROFILE_IDS` entry (57) gets a distinct `recipe` with `inheritance.familyDefaultsId` + recorded overrides.
- Gearless / continuous profiles: `virtualTransmission.enabled=false`, `allowCombustionShiftAccents=false`, cycle `stroke="none"`.
- Comedy / EV VT (`farting-car`, `kazoo-kart`, `electric-hypercar`): VT enabled but **no** combustion shift accents.
- Listening verdicts live only under `recipe.listening` (not in runtime `acceptance`).

### Evidence (code locations)

| Concern | Location |
| --- | --- |
| Recipe types | `types.ts` (`AcousticRecipe`, `AcousticCycleGeometry`, …) |
| Family foundations | `family-defaults.ts` (`ACOUSTIC_FAMILY_DEFAULTS`) |
| Per-ID build | `recipe-build.ts` → `buildAcousticRecipe` |
| Lookup | `getAcousticProfileSpec` / `allCatalogAcousticProfileSpecs` in `index.ts` |
| Validation bounds | `validate.ts` → `clampRecipe` / `clampCycle` / `clampVt` |
| Real RPM (not 0..1) | `cycle.idleRpm` / `cycle.maxRpm` comments + clamps 0..20000 |
| Sample missing → procedural | `sampleBankRecipe.proceduralFallback: true`; `approvedAssetsPresent` from empty banks |
| Gearless safety test | `getAcousticProfileSpec.test.ts` `"keeps gearless profiles free of…"` |

### Tests / typecheck

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npx vitest run src/lib/sound/profile-specs/getAcousticProfileSpec.test.ts` | **13 pass** |

### Feature flags

- No new audible DSP flag. Recipes unused by live audio until Prompt 04+.

### Manual verification

1. Confirm `getAcousticProfileSpec("cyber-pulse").recipe.virtualTransmission.allowCombustionShiftAccents === false`.
2. Confirm `getAcousticProfileSpec("gt-v8").recipe.cycle.cycleDegrees === 720`.
3. Drive / Audio Lab playback unchanged vs Prompt 01.

### Rollback

Revert the profile-specs recipe files + docs listed above. No migrations or engine changes.

## Prompt 03 completion record

### Files changed

| File | Change |
| --- | --- |
| `src/lib/powertrain/shift-presets.ts` | City/Touring/Sport maps; ladder adapt for non-6-speed; profile dwell/envelope overlay |
| `src/lib/powertrain/shift-preset-flag.ts` | `VITE_CITY_SHIFT_PRESET` / `ELCAMOSO_CITY_SHIFT_PRESET` (City as default only when on) |
| `src/lib/powertrain/gearless-state.ts` | Authoritative gearless frame (no gears / no shift accents) |
| `src/lib/powertrain/types.ts` | `operatingRegime`, `shiftEvent`/`lastShiftEvent` + sequenceId, speed freshness, `estimatedLoad` |
| `src/lib/powertrain/simulator.ts` | Preset wiring, regime SM, unique shift sequence IDs, telemetry freshness/source change |
| `src/lib/powertrain/scenarios.ts` | `city-0-80-0` scenario; `shiftEvents` on results |
| `src/lib/powertrain/shift-presets.test.ts` | Preset, dwell, ratio RPM, GPS hold, gearless, settings sanitize |
| `src/lib/drive/settings.ts` + `session.ts` + `SessionBridge.tsx` | `shiftMapPreset` setting → live simulator |
| `src/routes/settings.tsx` | Shift map selector (Legacy / City / Touring / Sport) |
| `.env.example` | City preset flag docs |
| Calibration/diagnostics types | Accept `gearless` + new diagnostics fields |

### Behaviour

- One authoritative `VirtualPowertrainState` per VT tick (UI + audio via existing `DriveState.powertrain`).
- High-rate DSP remains on session/simulator ticks (not React).
- City gentle upshifts for six-speed (`gt-v8`): **`[15, 28, 43, 58, 75]`** km/h; down **`[10, 21, 35, 49, 65]`**. Other gear counts adapted.
- Touring ≈ ×1.18, Sport ≈ ×1.38 vs City gentle; Sport demand curve holds longer.
- Default preset remains **legacy** unless City flag enabled; Settings always selectable.
- Gearless profiles unchanged (no simulator gears).

### Fixture outputs (recorded)

`city-0-80-0` / `gt-v8` / City preset (`artifacts/prompt-03-fixture.json`):

| Metric | Value |
| --- | --- |
| Shift begin events | 9 (unique sequenceIds 1…n) |
| Upshifts | 5 (1→2 … 5→6) at ≈3600, 5984, 8544, 11104, 14016 ms |
| Max gear | 6 |
| Final | gear 0, speed 0 |

### Tests / typecheck

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npx vitest run src/lib/powertrain` | **182 pass** |
| Focused `shift-presets.test.ts` | **14 pass** |

### Feature flags

- `VITE_CITY_SHIFT_PRESET` / `ELCAMOSO_CITY_SHIFT_PRESET` (default **off**) — City as settings default only when on.
- No new audible DSP renderer flag.

### Manual verification

1. Settings → Gear-shift feel → Shift map = City; Drive `gt-v8`; confirm earlier upshifts vs Legacy.
2. Continuous profile (e.g. `cyber-pulse`): no gear readout / no shift events.
3. With flag off, fresh settings keep `shiftMapPreset: "legacy"`.

### Rollback

Revert Prompt 03 powertrain/settings/docs files; leave presets unused by setting Legacy. No migrations.

## Prompt 04 completion record

### Files changed

| File | Change |
| --- | --- |
| `src/lib/sound/realism/v3/*` | Flag, pulse primitives, pilot presets, tests, exports |
| `src/lib/sound/realism/v2/hybrid-combustion-synth.ts` | Optional `rawMechanical` overlay (rumble HP, mild sat + OS, body orders, load balance) |
| `src/lib/sound/realism/v2/combustion-excitation.ts` | Worklet `setSeed` for repeatable cycle texture |
| `public/audio/combustion-processor.js` | Seed message; pulse width aligned with `pulseWidthSeconds` |
| `src/lib/sound/engine.ts` | V3 gate: flag + `realismEngine:"v3"` + pilot IDs → overlay; else V2 |
| `src/routes/debug.tsx` + `debug.calibration.tsx` | V3 A/B control (flag + pilot gated) |
| `scripts/render-prompt-04-fixtures.mjs` + `npm run audio:prompt-04` | Loudness-matched before/after fixtures |
| `.env.example` | `VITE_DRIVE_AUDIO_V3` / `ELCAMOSO_DRIVE_AUDIO_V3` |
| Docs | PLAN / PROGRESS / matrix / MEMORY_BANK |

### Behaviour

- **Default path unchanged** when `DRIVE_AUDIO_V3` is off or mode ≠ `v3`.
- Pilots only: `american-muscle-v8`, `flat-six-sport` — distinct presets (not the same bass/octave trick).
- Reuses HybridCombustionSynth + existing worklet; no React `setInterval` pulse scheduling.
- Quality tier `high` | `low-cost` (fewer body bands, milder sat, no WaveShaper OS on low-cost).
- Diagnostics: `realismEngine: "v3"`, backend prefix `realism-v3-*`.
- Catalog IDs / display names unchanged; no guessed brands.

### Tests / typecheck / fixtures

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass (after Prompt 04) |
| `npx vitest run` raw-mechanical + hybrid-combustion | pass |
| `npm run audio:prompt-04` (`gentle-0-80`) | Muscle/Flat-Six: `realism-v2-worklet` → `realism-v3-worklet`; match ≈ −7.7 / −8.7 dB; finite output |
| Listening | **pending** — do not claim code tests prove authentic engines |

### Feature flags

- `VITE_DRIVE_AUDIO_V3` / `ELCAMOSO_DRIVE_AUDIO_V3` (default **off**)
- Runtime: `SoundEngine.setRealismEngine("v3")` only effective when flag on + pilot ID

### Manual verification

1. Set `VITE_DRIVE_AUDIO_V3=1`; `/debug` → American Muscle or Flat-Six → Raw Mechanical V3.
2. Match loudness vs V2 before judging; note listening still unverified.
3. Flag off: confirm V3 button disabled / path stays V2.

### Rollback

Unset flag (or revert V3 files). Engine falls through to Realism V2. No migrations.

## Prompt 05 completion record

### Files changed

| File | Change |
| --- | --- |
| `src/lib/sound/realism/samples/*` | Typed recording manifest, acquisition requests (9 combustion IDs), validate, blend, bounded cache, loader (stale gens), status, tests |
| `src/lib/sound/realism/v2/sample-bank.ts` | Optional equal-power mix shaping |
| `src/lib/sound/realism/v2/hybrid-combustion-synth.ts` | Restore full procedural gain when samples silent (no loudness jump) |
| `src/lib/sound/engine.ts` | `prepareHybridSampleLayer` for active personality via shared loader |
| `src/lib/sound-assets/client-loader.ts` | Decode via bounded hybrid loader |
| `docs/audio/SAMPLE_ACQUISITION_BRIEF.md` | Missing assets by real profile ID + licensing |
| `docs/audio/GRANULAR_SYNTHESIS_DECISION.md` | Defer granular until approved beds exist |
| Docs | PROGRESS / matrix / MEMORY_BANK |

### Behaviour

- Lightweight hybrid sample layer on existing Web Audio renderer (not Wwise/FMOD).
- **0** licensed catalog files → all combustion profiles **awaiting-assets**; procedural remains authoritative.
- Pitch: `playbackRate = targetRpm/sourceRpm` within per-asset bounds; RPM/load neighbour blend (linear default).
- Preload active personality only; bounded decoded-buffer cache with approx byte measure; stale loads ignored.
- CORS / decode / empty / channel failures → empty map + procedural fallback without ducking procedural forever.
- No invented or unlicensed media registered.

### Tests / typecheck

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npx vitest run src/lib/sound/realism/samples` | **10 pass** |
| `hybrid-combustion` + `manifest-service` | pass (prior suites still green) |
| Listening / sample realism | **not claimed** — assets awaiting |

### Feature flags

- No new audible DSP flag. Hybrid samples activate only when approved catalog entries decode successfully.
- Delivery remains `procedural_only` while `SOUND_ASSET_CATALOG` is empty.

### Manual verification

1. Drive any combustion profile: sound is procedural; diagnostics `sampleState` unavailable / no approved assets.
2. Confirm `sampleAssetStatusForProfile("american-muscle-v8").status === "awaiting-assets"`.
3. Read `docs/audio/SAMPLE_ACQUISITION_BRIEF.md` before commissioning recordings.

### Rollback

Revert `realism/samples` + engine/client-loader wiring. Empty catalog already means no sample audio.

### Unresolved dependencies

- Licensed multi-RPM beds for Priority-1 profiles (Muscle, Flat-Six)
- Signing secret / CDN CORS when catalog is first populated
- Human listening after first approved bank

## Prompt 06 completion record

### Files changed

| File | Change |
| --- | --- |
| `src/lib/sound/realism/shift-events/*` | sequenceId consumer, engagement presets, audio-clock choreography, tests |
| `src/lib/sound/realism/v2/hybrid-combustion-synth.ts` | Consumes Prompt 03 `shiftEvent`; intensity; profile gates; stale discard |
| `src/lib/sound/engine.ts` + `session.ts` | `setShiftIntensity`, timeline-gap on resume |
| `src/lib/drive/types-extra.ts` + `settings.ts` + `settings.tsx` | `shiftFeel.shiftIntensity` (0..1) |
| `scripts/render-prompt-06-shift-fixtures.mjs` | Isolated + city listening fixtures |
| Docs | PROGRESS / matrix / MEMORY_BANK |

### Behaviour

- Virtual gearshift is one synchronized audio-clock plan: torque-cut → mechanical → ratio hold → recovery.
- Consumes `DrivetrainShiftEvent.sequenceId` exactly once; maps `atMs` to AudioContext time (not UI frames).
- Engagement: muscle-heavy / sports-precise / restrained / none (gearless accents off).
- `shiftIntensity` 0 mutes mechanical clacks/thumps; RPM/torque-cut continuity preserved.
- Rev-blip / lift-off / overrun gated per profile + advanced-transient tier + existing cooldowns.
- Suspend/resume marks timeline gap — no overdue event burst.
- Simulated audio only — no vehicle actuation claims.

### Tests / fixtures

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npx vitest run src/lib/sound/realism/shift-events` (+ hybrid + scheduler) | **45 pass** |
| `npm run audio:prompt-06` | Muscle / Flat-Six / GT V8 idle + gentle-0-80; city `sequenceId` 1…n in `artifacts/audio-lab/prompt-06-shift-events/` |
| Listening | **pending** |

### Feature flags

- No new env flag. Uses existing VT + advanced-transient entitlement for extras.
- User control: Settings → Shift intensity.

### Manual verification

1. Drive `gt-v8` City map; confirm shifts feel synchronized (torque dip then engagement).
2. Set Shift intensity = 0: gears/RPM continue, no mechanical clack.
3. Background tab → resume: no burst of late shifts.
4. `cyber-pulse`: no combustion clacks.

### Rollback

Revert `shift-events` + hybrid/session/settings wiring. Prior edge-triggered scheduler remains as fallback path inside hybrid when no `shiftEvent` is present.

## Prompt 07 completion record

### Catalog enumeration

| Fact | Value |
| --- | --- |
| Core Sound Profiles | **47** (not 47 alone as the full live set) |
| Assembled public catalog | **57** |
| Matrix rows shipped | **57** (one per public ID) |
| Realism V2 combustion acoustic overlays | **9** |
| Experience overlays | **57** |
| IDs / access / favourites | **unchanged** |

### Files changed (this prompt)

| File | Change |
| --- | --- |
| `src/lib/sound/realism/catalog-tuning/*` | Types, family defaults, 57 by-profile entries, apply, listening rubric, tests |
| `src/lib/sound/realism/v2/acoustic-engine.ts` | `acousticEngineForProfile` applies overlays; base helper for A/B |
| `src/lib/sound/profile-experience-config.ts` | `profileExperienceConfig` applies overlays; base helper for A/B |
| `scripts/generate-catalog-tuning-by-profile.mjs` | Regenerates by-profile.ts |
| `scripts/generate-prompt-07-matrix.mjs` / `render-prompt-07-fixtures.mjs` | Matrix + targeted lab captures |
| `docs/audio/RAW_MECHANICAL_AUDIO_ACCEPTANCE.md` | Acceptance + human rubric (0 scored) |
| `docs/audio/profile-upgrade-matrix-prompt-07.md` | Complete Prompt 07 matrix |
| `package.json` | `audio:prompt-07`, `audio:prompt-07-matrix` |

### Resulting behaviour

- Audible: combustion Hybrid uses tuned acoustic scalars/formants; all profiles use tuned experience phases via Improved/Hybrid/Symphony/World/Fusion paths that call `profileExperienceConfig`.
- **Not** claimed authentic. Sample banks still awaiting assets. Listening/device **unverified**.

### Automated verification

- `npm test -- --run src/lib/sound/realism/catalog-tuning/`
- `npm run audio:prompt-07-matrix`
- Optional Chromium: `npm run audio:prompt-07`

### Gaps

- 0/57 human listening; 0/57 device; hybrid recordings absent; no diesel acoustic engine ID.

## Prompt 08 completion record

### Audit (before level raises)

| Finding | Fix |
| --- | --- |
| Session baked `profileGain` into `setVolume` while engine also multiplied it | UI volume + `setProfileGain` separated |
| Final `DynamicsCompressor` used as brickwall | WaveShaper peak protect at −1 dBFS sample |
| MasterBus + final compressor | Final compressor removed; MasterBus gentler |
| Default volume 0.7 | New-device default **0.35**; migrate keeps saved volume |
| Merge import overwrote volume | Merge keeps device volume + `outputBoostDb` |

### Files

| Area | Paths |
| --- | --- |
| Staging | `src/lib/sound/gain-staging/*` |
| Engine graph | `src/lib/sound/engine.ts`, `master-bus.ts`, `perceptual-volume.ts` |
| Settings / session | `settings.ts` (v9), `session.ts`, `SessionBridge.tsx`, `settings.tsx` |
| Docs | `docs/audio/GAIN_STAGING.md` |

### Behaviour

- Path: layers → cabin/MasterBus → perceptual user volume → optional +0…6 dB boost → peak protect → duck → out
- Shift intensity remains independent; Body/Mechanical Character advanced only
- Lab/diagnostics expose overload counters; customer UI does not

### Tests

- `npm test -- --run src/lib/sound/gain-staging/`
- Related: safety / road-feel / settings sanitize as exercised by suite

### Gaps

- Cabin listening checklist in `GAIN_STAGING.md` unverified
- True-peak not certified
- Does not control car hardware volume (documented)

## Prompt 09 completion record

### Delivered

| Area | Paths |
| --- | --- |
| Cockpit UI | `src/components/drive/DriveCockpit.tsx`, `src/routes/drive.tsx`, `src/styles.css` |
| Display model | `src/lib/drive/cockpit-model.ts` |
| Profile switch | `src/lib/drive/cockpit-profile-switch.ts` |
| Powertrain warm-start | `src/lib/powertrain/simulator.ts` `warmStartAtSpeed`, `session.ts` pending warm-start |
| Crossfade | `src/lib/sound/engine.ts` sequential ~220+320 ms, latest-wins, restore on build failure |
| Tests | `cockpit-model.test.ts`, `cockpit-profile-switch.test.ts`, `cockpit-session.integration.test.ts`, `warm-start.test.ts`, `e2e/drive-cockpit.spec.ts` |

### Behaviour

- Header: real `ElcamosoLogo`, active sound name, restrained telemetry
- Centre: large speed (stale/unavailable → em dash, not misleading zero); RPM arc; gear or gearless regime; simulated captions
- Bottom: 3 favourites, active sound picker, volume +/−/mute, Stop Drive
- Secondary: shift preset (VT only), Settings link; fullscreen optional with capability check
- Shared `settings.profileId` / volume with Settings via `useSettings` + SessionBridge
- Locked favourites stay visible; cannot start premium Drive playback
- Active Drive defers pairing, purchases, rewards to idle

### Tests run

- `npm test -- --run` on cockpit + warm-start + engine-profile-switch: **20/20 pass**
- `npx tsc --noEmit`: **pass** (Prompt 09 paths)
- Playwright `e2e/drive-cockpit.spec.ts`: layouts 390×844 and 1280×800 (skips cockpit assertions if Web Audio blocked in headless)

### Visual inspection (this environment)

Inspected live at `http://localhost:5173/drive` with seeded favourites + demo settings (browser CDP + screenshots).

| Viewport | Inspected | Notes |
| --- | --- | --- |
| 390×844 | Yes — `drive-cockpit-390x844.png` (+ footer shot) | Logo mark, active sound, weak-signal label, em-dash speed + “Waiting for motion”, gear/RPM with simulated caption, 3 favourites (Cyber Pulse truncated), volume 35%, Stop Drive. Measured control heights **48–56 CSS px**. Cockpit footer fits in first viewport (`footerBottom` ≈756 / `vh` 844); remaining page scroll is app chrome (legal + bottom nav), not redesigned. |
| 1280×800 | Yes — `drive-cockpit-1280x800-v2.png` | Wordmark + mark, Cyber Pulse regime (**Idle / Regime / Simulated**) after favourite switch, volume/shift/Stop visible. No purchase/sign-in inside active cockpit. |
| Gearless | Yes (Cyber Pulse) | Regime indicator, not six-speed gears |
| Long names | Yes | `CYBER PUL…` truncate on favourite chip |
| Safe areas | CSS `env(safe-area-inset-*)` + landscape max-height rules on `.drive-cockpit` | |
| Reduced motion | Supported via `useReducedMotion` (arc snap, no gear flash) | |
| Fullscreen | Capability-gated “Full” control when `requestFullscreen` exists | |

### Gaps

- Fullscreen depends on browser Fullscreen API (fallback: control hidden when unavailable)
- Headless Web Audio may block Start Drive → cockpit not always painted in CI
- In-car Tesla browser not device-verified; no bypass claimed
- Human cabin visual review still open

## Prompt 10 completion record

### Audit re-read (auth / billing ownership)

- Existing: Google OAuth + magic link → ELCAMOSO HttpOnly session cookie; entitlements/Stripe on `users.id`
- No prior Supabase package; Prompt 10 adds `@supabase/supabase-js` as OTP provider only
- Preserved: Google, magic-link fallback, cookie contract, Stripe customer mapping via verified email → `createUserForEmail`

### Delivered

| Area | Paths |
| --- | --- |
| Supabase OTP | `email-otp-provider.ts`, `supabase-auth-client.ts`, `supabase-config.ts` |
| Rate limits | `email-otp-rate-limit.ts` (send cooldown, hourly cap, verify lockout) |
| Service | `auth-service.ts` `requestEmailOtp` / `verifyEmailOtp` / `createSessionFromVerifiedEmail` |
| Server fns | `requestEmailOtpFn`, `verifyEmailOtpFn`, `getEmailOtpStatusFn` |
| Redirect allowlist | `return-to.ts` |
| UI | `AccountSignInDialog.tsx` email → six-digit code (paste/autofill, edit email, resend UI + server cooldown) |
| Cross-tab | `account-sync.ts` + `AccountProvider` |
| Docs | `docs/account/EMAIL_OTP_SETUP.md`, `IDENTITY_MIGRATION_PLAN.md` |
| Env names | `.env.example` `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ELCAMOSO_EMAIL_OTP_ENABLED` |

### API choices (docs-verified)

- `signInWithOtp({ email, options: { shouldCreateUser: true } })` — first-time signup allowed intentionally
- `verifyOtp({ email, token, type: 'email' })` for numeric codes
- Email template must include `{{ .Token }}`
- OTP lifetime configured in Supabase (recommended 600s); UI countdown does not change backend expiry
- Provider-wide note: Email OTP Expiration also affects magic/other email links

### Tests

- `npm test -- --run src/lib/account/email-otp.test.ts` (+ existing auth-service tests)
- Covers: new/existing account mapping, wrong code, throttle, resend cooldown, redirects, cross-user isolation
- **Mocks do not prove real email delivery**

### Staging E2E delivery check (manual — required before claiming mail works)

See `docs/account/EMAIL_OTP_SETUP.md` §9: real mailbox on staging, receive six-digit code, verify on second surface, confirm rate limit + expired/reused code.

### Gaps

- Staging/production Supabase + SMTP not configured in this environment
- Optional `auth_identity_links` table not applied (plan only)
- Live Stripe customer continuity depends on verified-email match to existing map

## Prompt 11 completion record

### Free trio (actual IDs)

| Role | ID |
| --- | --- |
| Muscle | `american-muscle-v8` |
| Sport / mechanical | `flat-six-sport` |
| Futuristic | `cyber-pulse` |

Config + rationale: `src/lib/sound/profile-access-config.ts`. Default / fallback profile = muscle free id. Grandfathered grants preserve prior purchases (e.g. `gt-v8`) when free set shrinks.

### Delivered

| Area | Paths |
| --- | --- |
| Resolver | `access-resolver.ts` (catalog, favourites, playback, rewards, UI) |
| Grants | `grants.ts` + `drizzle/migrations/0003_entitlement_grants.sql` |
| Offline lease | `offline-lease.ts` + `live-drive-access.ts` (`fade_to_free`) |
| Wiring | `resolve.ts`, `service.ts`, `selectors.ts`, `EntitlementEnforcer`, `SessionBridge` |
| Docs | `docs/entitlements/ENTITLEMENTS.md` |

### Policy

- Precedence + UTC ms documented in ENTITLEMENTS.md
- Past-due grace via existing `DRIVE_PLUS_PAST_DUE_GRACE_DAYS` (default 7)
- Client cannot write premium grants; server session required for protected assets
- Sample delivery: short-lived signed URLs; procedural code not secret by UI hiding
- No new prices / payment plans

### Tests

- `npm test -- --run src/lib/entitlements …` (+ profile-access, subscription-access-policy, manifest-service): **57 pass**
- Matrix: free trio, grandfathered, reward expiry, trial, past_due grace boundaries, offline expiry, account switch

### Gaps

- Postgres grant persistence requires applying migration `0003` in each environment
- Reward campaign writers (Prompt 12) wire grants in-memory; apply `0004` for durable claim tables

## Prompt 12 — Monthly Sound Spin

| Field | Value |
| --- | --- |
| Status | **implemented** (flagged off by default) |
| Flag | `ELCAMOSO_REWARDS_ENABLED` default off; staging campaign `enabled: false` until config complete |
| Docs | `docs/rewards/SOUND_SPIN.md` |

### Delivered

| Area | Paths |
| --- | --- |
| Flag | `src/lib/rewards/flag.ts` |
| Campaign / weights / periods | `campaign-config.ts`, `weights.ts`, `period.ts`, `access-windows.ts` |
| Store + service | `store.ts`, `service.ts`, `fulfilment.ts`, `audience.ts` |
| Server fns | `server-fns.ts` |
| Schema | `drizzle/migrations/0004_reward_claims.sql` + `src/lib/db/schema.ts` |
| UI | `/rewards` + `SoundSpinWheel.tsx` (Garage link when flag on) |
| Tests | `src/lib/rewards/*.test.ts` |

### Policy

- One free claim per verified account per UTC calendar month
- Server records outcome before animation; no client prize selection; no reroll
- Free vs paid pools; declared inventory fallback or disable claiming
- Staging illustrative odds only — not production business facts
- No reward pop-ups during active Drive

### Gaps

- Postgres claim repository still uses in-memory mirror until wired like other stores

## Prompt 13 — Stripe discount fulfilment

| Field | Value |
| --- | --- |
| Status | **implemented** (flagged off; test-mode coupons required) |
| Flag | `ELCAMOSO_REWARD_DISCOUNTS_ENABLED` default off |
| Docs | `docs/rewards/STRIPE_DISCOUNT_FULFILMENT.md` |

### Delivered

| Area | Paths |
| --- | --- |
| Policy / config | `src/lib/rewards/discount/policy.ts`, `config.ts`, `flag.ts` |
| Apply / checkout | `service.ts` + `checkout-service.ts` reservation attach |
| Webhook consume | `reconcile.ts` via `subscription-sync` invoice handlers |
| Stripe ops | `stripe-ops.ts` (mockable); API pinned `2026-08-26.dahlia` |
| Schema | `0005_reward_discount_fulfilment.sql` |
| UI | `RewardDiscountPanel` on `/rewards` (terms before redeem) |
| Tests | `discount.integration.test.ts` |

### Gaps

- Live Stripe Test Clock E2E optional (not required for Prompt 13 unit suite)
- Operator must create test-mode coupons manually before enabling the flag

## Prompt 14 — Integration and staged release

| Field | Value |
| --- | --- |
| Status | **implemented** (integration fixes + docs); listening/device **pending** |
| Deploy | **not** automatic |
| Checklist | `docs/DRIVE_COCKPIT_V2_RELEASE_CHECKLIST.md` |
| Device script | `docs/device/DRIVE_COCKPIT_V2_DEVICE_TEST_SCRIPT.md` |

### Integration fixes

- Free-trio authority: `resolveProfileAccess` ignores invented `access:"free"`
- Experience Drive gate: `canDriveProfileWithAccess` + live-hold grant merge
- Mid-drive `fade_to_free` applied immediately in `EntitlementEnforcer`
- Docs: ENTITLEMENTS persistence / gating accuracy

### Checks (this environment)

- `tsc --noEmit` pass; `npm run build` pass
- Focused vitest 291 + catalog/finite 33 pass
- Catalog **57/57**; listening **not** promoted from metrics
- Tesla moving / live email / live discounts: **not claimed**

## Evidence class legend (for later prompts)

| Class | Meaning |
| --- | --- |
| implemented | Code/docs landed in repo |
| automatically verified | Automated tests/commands passed in this environment |
| listening-verified | Human audition signed off |
| device-verified | Real device / Tesla cabin check |
| production-configured | Live env vars, Console URIs, Stripe, DB migrations applied in prod |
