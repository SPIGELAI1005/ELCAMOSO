# Drive Cockpit V2 + Raw Mechanical Audio — Implementation Plan

**Status:** Prompt 00 audit complete (2026-10-11)  
**Source pack:** `cursor-prompts/ELCAMOSO_DRIVE_AUDIO_UPGRADE.md`  
**Progress tracker:** `docs/DRIVE_COCKPIT_V2_PROGRESS.md`  
**Catalog matrix:** `docs/audio/profile-upgrade-matrix.md` (57 real IDs)

This plan is evidence-backed from the repository at commit `38beb9b` worktree. It does **not** claim listening-verified realism, Tesla cabin verification, or production configuration.

---

## 1. Document inventory (Prompt 00 checklist)

| Document | Status |
| --- | --- |
| `elcamoso-comprehensive-spec.md` | Present |
| `docs/MEMORY_BANK_AND_CHANGELOG.md` | Present |
| `docs/AUDIO_REALISM_V2.md` | Present |
| `docs/SOUND_CHARACTER_SPEC.md` | Present |
| `docs/sound-profiles/INDEX.md` | Present |
| `docs/SOUND_PROFILE_IMPLEMENTATION_AUDIT.md` | Present (partly stale vs 2026-10-10 AcousticProfileSpec) |
| `docs/audio/profile-upgrade-matrix.md` | Present (57 rows; generated 2026-09-26, listening notes through 2026-10-10) |
| `cursor-prompts/CURSOR_PROMPTS.md` | Present (prior Sound Profile pack) |
| `cursor-prompts/ELCAMOSO_DRIVE_AUDIO_UPGRADE.md` | Present (copied from `Prompt Updates/` during Prompt 00) |
| `docs/FAMILY_CLASSIFICATION_MISMATCHES.md` | Present |
| `docs/DRIVE_COCKPIT_V2_PLAN.md` | This file (created Prompt 00) |
| `docs/DRIVE_COCKPIT_V2_PROGRESS.md` | Created Prompt 00 |

**Missing / not found (Prompt 00 baseline):** none of the required checklist paths. Prompt 10 later added `@supabase/supabase-js` and `SUPABASE_*` env names for email OTP.

---

## 2. Current architecture map (concrete paths)

### 2.1 Drive UI and branding

| Concern | Path |
| --- | --- |
| Drive route | `src/routes/drive.tsx` (`cockpit`, `debug`, `roadTest`, `start`, …) |
| Tesla / safety cockpit CSS | `src/styles.css` (`.drive-tesla-cockpit`, instrument rules) |
| Instruments | `src/components/DynamicDriveInstrument.tsx`, `DriveSessionPanel.tsx`, `drive/DriveModePicker.tsx` |
| Volume | Settings `ElcamosoSettings.volume` → `SessionBridge` → `SoundEngine.setVolume` (`src/lib/drive/settings.ts`, `session.ts`) |
| Favourites | `settings.favourites`; UI on Sounds/Garage; `QuickJump.tsx` |
| Logo / tokens | `src/components/ElcamosoLogo.tsx`, `BrandNav.tsx`, `src/styles.css` `@theme` |

**Gap vs product intent (Prompt 09 closed):** `/drive` active audio sessions now render `DriveCockpit` (logo, speed, RPM arc / regime, favourites, volume, shared profile selection). Tesla-safety CSS (`drive-tesla-cockpit`) and Dynamic Drive instruments remain available for debug / distance modes; purchases and pairing stay on idle Drive.

### 2.2 Sound catalog and factories

| Bucket | Count | Definitions |
| --- | ---: | --- |
| Core Sound Profiles | **47** | 22 in `src/lib/sound/profiles.ts` + 25 in `profiles-expansion.ts` |
| Symphony | 3 | `src/lib/symphony/symphony-profiles.ts` |
| World | 3 | `src/lib/worlds/world-profiles.ts` |
| Fusion | 4 | `src/lib/fusion/fusion-profiles.ts` |
| **Assembled total** | **57** | `SOUND_PROFILES` in `profiles.ts` |

Core ID list: `CORE_SOUND_PROFILE_IDS` / `PUBLIC_PROFILE_IDS.slice(0, 47)` in `src/lib/sound/profile-specs/core-ids.ts` and `profile-experience-config.ts`.

**Do not invent IDs to reach 47 — the repository already has exactly 47 core + 10 composed.**

### 2.3 AcousticProfileSpec (CURSOR_PROMPTS Prompt 2 + Drive Audio Prompt 02)

| Item | Path / status |
| --- | --- |
| Types | `src/lib/sound/profile-specs/types.ts` — includes additive `recipe: AcousticRecipe` |
| Family foundations | `family-defaults.ts` |
| Recipe builder | `recipe-build.ts` (`buildAcousticRecipe`) |
| Spec builder | `build.ts` |
| Validation | `validate.ts` (clamps recipe + gearless accent safety) |
| Lookup | `getAcousticProfileSpec(id)` / `allCatalogAcousticProfileSpecs()` in `index.ts` |
| Tests | `getAcousticProfileSpec.test.ts` (47 core + 57 catalog + gearless/comedy VT) |

**Verdict (Prompt 02):** Contract **extended** (not replaced). Distinct recipes for all 57 catalog IDs; family defaults are foundations only; listening stays under `recipe.listening`. Audible output unchanged until a later renderer flag.

### 2.4 Web Audio graph

| Stage | Path |
| --- | --- |
| Engine / MAX_GAIN 0.85 / limiter | `src/lib/sound/engine.ts` |
| Backend select (V2 / Dynamic Drive / Improved / legacy) | `engine.ts` (~1004–1074) |
| Improved strategies | `realism/strategies.ts`, `strategies-extra.ts` |
| Improved runtime | `realism/improved-synth.ts` |
| Motion frame | `realism/motion.ts` (`motionFromDrive`) |
| Realism V2 hybrid | `realism/v2/hybrid-combustion-synth.ts`, `combustion-excitation.ts`, `acoustic-engine.ts` |
| Worklet | `public/audio/combustion-processor.js` |
| Dynamic Drive | `src/lib/sound/dynamic-drive/synth.ts` |
| Layer factories | `dsp/layers.ts`, `dsp/layers-extra.ts` |

**Default:** `realismEngine: "v2"` and improved synthesis. V2 combustion eligibility: **9** profiles in `ACOUSTIC_ENGINE_BY_PROFILE` (`gt-v8`, `american-muscle-v8`, `flat-six-sport`, `turbo-inline-6`, `racing-v10`, `race-car`, `rally-car`, `motorcycle-superbike`, `big-twin`).

### 2.5 Telemetry → RPM / load

| Source | Path |
| --- | --- |
| Browser GPS / IMU | `src/lib/motion-capture/web-provider.ts`, `gps-speed.ts` |
| Phone relay | `src/lib/drive-relay/*`, `/pair` routes |
| Tesla Fleet | `src/lib/motion/vehicle-telemetry/tesla-fleet-provider.ts` |
| Fusion priority | `sensor-fusion.ts`: vehicle-telemetry → phone → tesla-browser → simulator |
| Session loop | `src/lib/drive/session.ts` → `engine.update(state)` |
| PowertrainSimulator | `src/lib/powertrain/simulator.ts` |
| RPM from gear/speed | `powertrain/rpm-model.ts` |
| Shift maps | `powertrain/shift-map.ts` (demand breakpoints; Road Feel V3 earlier maps) |
| Legacy slope gearbox | `drive/model.ts` `computeDriveState` when simulator inactive |

**Duplicate RPM paths (code-confirmed):** live `PowertrainSimulator` vs legacy `computeDriveState` slopes. Both can be correct in their gates, but Prompt 03 must make one authoritative state for UI + audio when the new drivetrain flag is on.

### 2.6 Auth, entitlements, Stripe (preserve)

| Area | Reality |
| --- | --- |
| Auth | Google OAuth + email magic link + **Supabase email OTP** (Prompt 10; `signInWithOtp` / `verifyOtp` type `email`). ELCAMOSO HttpOnly cookie remains the app session. |
| Session | Signed HttpOnly cookie `elcamoso_account_session`; in-memory maps + HMAC tickets |
| Plans | `"FREE" \| "DRIVE_PLUS"` only (`entitlements/types.ts`) |
| Free Sound Profiles (Prompt 11) | `american-muscle-v8`, `flat-six-sport`, `cyber-pulse` — `profile-access-config.ts` + `access-resolver.ts` |
| Sound Spin (Prompt 12) | `src/lib/rewards/*`, `/rewards`; docs `docs/rewards/SOUND_SPIN.md` |
| Stripe products | `drive_plus_monthly` / `drive_plus_yearly` |
| Monetization flag | `MONETIZATION_ENABLED` (default off) |
| Rewards flag | `ELCAMOSO_REWARDS_ENABLED` (default off; campaign also `enabled: false` until config complete) |
| DB | Drizzle: `users`, `subscriptions`, Dynamic Drive trial, Stripe webhook ledger, entitlement grants, reward claims (`0000`–`0004`) |

**Before any OTP work (Prompts 08+):** preserve cookie contracts, Google OAuth, entitlement resolution by `userId`, Stripe checkout/portal/webhook, and unify identity with `users.email`. Sessions/magic-link pending state are not fully Postgres-backed — document migrations, do not apply them in these prompts.

### 2.7 Feature flags (current + planned ownership)

| Flag / control | Kind | Owner / location | Notes |
| --- | --- | --- | --- |
| `SoundEngine.setRealismEngine("current"\|"v2"\|"v3")` | Runtime A/B | `engine.ts`, `/debug` | Default `"v2"` for eligible combustion; `"v3"` only with flag + pilots |
| `settings.dynamicDrive` | Client setting | `settings.ts` | Full DD extras still entitlement-gated |
| `virtual_transmission` | Entitlement | FREE | Simulator + core shift transients |
| `dynamic_drive` | Entitlement | Drive+ / trial / Demo | Rev-match, overrun, turbo, etc. |
| `MONETIZATION_ENABLED` | Env | billing | Checkout off by default |
| `ELCAMOSO_REWARDS_ENABLED` | Env (Prompt 12) | `rewards/flag.ts` | Sound Spin off until campaign config complete |
| `ELCAMOSO_REWARD_DISCOUNTS_ENABLED` | Env (Prompt 13) | `rewards/discount/flag.ts` | Stripe discount apply off until test coupons configured |
| Release pack (Prompt 14) | Docs | `DRIVE_COCKPIT_V2_RELEASE_CHECKLIST.md` | Staged rollout; no auto-deploy |
| `SYMPHONY_ENABLED` / `FUSION_ENABLED` / `WORLDS_ENGINE_ENABLED` | Env | experiences | Default on |
| `VITE_DRIVE_AUDIO_V3` / `ELCAMOSO_DRIVE_AUDIO_V3` | Env (Prompt 04) | `realism/v3/flag.ts` | **Opt-in** raw mechanical overlay for Muscle + Flat-Six; Current/V2 fallback |
| `settings.shiftMapPreset` + `VITE_CITY_SHIFT_PRESET` | Settings + env flag (Prompt 03) | `shift-presets.ts`, `settings.ts` | City/Touring/Sport/legacy; City **default** only when flag on |

---

## 3. Signal traces

### 3.1 Combustion (`american-muscle-v8` / `gt-v8`)

1. Motion sample → fusion → `DriveSession.computeNextDriveState`
2. If VT active: `PowertrainSimulator.tick` → RPM/load/gear/shift phase
3. Else: legacy `computeDriveState` (`drive/model.ts`)
4. `SoundEngine.update` → if V2 + eligible → `HybridCombustionSynth` (worklet or AM-brown fallback) → formants/orders/mechanical → buses → cabin EQ → MasterBus → limiter → destination
5. Ceiling: `MAX_GAIN = 0.85`

### 3.2 Non-combustion (`cyber-pulse`, `neon-drive`)

1. Continuous drivetrain → `rpm: 0`, `gear: 0` in legacy continuous path
2. `motionFromDrive` uses **designed** family taus / energy pitch (neon-drive runtime family is `designed`, not package `musical`)
3. `ImprovedSynth` + strategy layers (sine/triangle/saw/square meshes, band-passes in 1.8–3.2 kHz region for neon/cyber)
4. Same cabin → master → limiter chain

---

## 4. Catalog reconciliation and family mismatches

- **Expected 47 core:** verified (22 + 25).
- **Total selectable:** 57.
- **Mismatches (documented, not renamed):**

| ID | Runtime `familyForProfile` | Package INDEX | Decision |
| --- | --- | --- | --- |
| `neon-drive` | `designed` | `musical` | Keep runtime; `packageFamily` on AcousticProfileSpec |
| `dragon` | `designed` | `environmental` | Keep runtime; see `docs/FAMILY_CLASSIFICATION_MISMATCHES.md` |
| `thunder-beast` | `designed` | `environmental` | Keep runtime |

Silent ID renames are forbidden.

---

## 5. Thin / high-pitched character — evidence

### Code-confirmed

1. **Sawtooth-dominant harmonic stacks** in Improved combustion layers (`dsp/layers.ts` `createHarmonicEngineLayer` defaults to sawtooth; filter opens with RPM/throttle).
2. **Legacy saw path** still present for A/B (`engine.ts`).
3. **Bright EV/neon layers:** square/saw + peaking ~1800 Hz / BP ~2200–3200 Hz (`layers-extra.ts`, `strategies-extra.ts`, `strategies.ts` cyber-pulse).
4. **Fallback excitation HPF @ 720 Hz** when worklet unavailable (`combustion-excitation.ts`) — thins AM-brown path.
5. **Cabin highshelf @ 3500 Hz** can emphasize brightness (`engine.ts`).
6. **Empty sample banks** → 100% procedural; stretch clamps exist but unused without assets.

### Hypotheses (need Prompt 01 measurement / listening)

- Limiter pumping elevating mid/high relative to sub.
- Designed-family motion envelopes for neon-drive vs musical package intent.
- Offline render without worklet sounding thinner than realtime worklet.
- Road Feel / master staging interaction with excitation loudness.

**Listening-verified:** 0 / 57 (matrix + `LISTENING_AND_ASSET_STATUS.md`). Do not claim diagnosis from code alone as cabin truth.

---

## 6. Implementation order (Prompts 00–09 scope)

| Order | Prompt | Goal | Depends on |
| --- | --- | --- | --- |
| 00 | Audit + plan | This document | — |
| 01 | Comparison lab | Deterministic fixtures, capture, metrics | 00 |
| 02 | Extend AcousticProfileSpec recipes | Schema/data only; no audible change | 00, reuse Prompt 2 |
| 03 | Shared virtual drivetrain + earlier city shifts | Authoritative RPM/gear for UI+audio | 00–02 |
| 04 | Raw mechanical combustion (flagged) | Pilot muscle + contrasting combustion | 01–03 |
| 05 | Sample layers / hybrid | **Done (code):** `realism/samples` + acquisition brief; catalog empty → awaiting-assets; granular deferred | 04 |
| 06 | Mechanical shift events | **Done (code):** sequenceId choreography + shiftIntensity + engagement presets | 03 |
| 07 | Loudness / Tesla calibration workflow | Measurement-driven trims | 01, 04–06 |
| 08+ | Cockpit UI, auth OTP, rewards | After sound quality path | Preserve auth/billing |

Prompts 00–07 address electronic/high-pitched character **before** cockpit/auth/rewards polish.

---

## 7. Configuration dependencies (do not invent)

| Need | Source |
| --- | --- |
| Google account OAuth | `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `ELCAMOSO_ACCOUNT_SESSION_SECRET` |
| Stripe Drive+ | `STRIPE_*`, `MONETIZATION_ENABLED` |
| Database | `DATABASE_URL` (PGlite or Postgres) — apply migrations only with explicit ops, not in these prompts |
| Tesla Fleet | Tesla OAuth + telemetry env (separate from account Google) |
| Phone relay | `DRIVE_RELAY_*` / `VITE_DRIVE_RELAY_PUBLIC_ORIGIN` |
| Experience toggles | `SYMPHONY_ENABLED`, `FUSION_ENABLED`, `WORLDS_ENGINE_ENABLED` |

**Missing credentials block only production activation** of that subsystem; local code/tests/fixtures must still ship.

---

## 8. Rollback strategy

| Change class | Rollback |
| --- | --- |
| Docs only (Prompt 00) | Revert doc commits; no runtime impact |
| Feature-flagged DSP (04+) | Default flag off → Current/V2 path unchanged |
| VT City map (03) | Keep prior Road Feel V3 maps when flag off |
| AcousticProfileSpec extensions (02) | Additive fields + validation clamps; ignore unknown persisted keys |
| Auth OTP (Prompt 10) | Additive Supabase email OTP; Google/magic-link preserved; ELCAMOSO cookie session |
| Billing | Never alter live Stripe products/prices from these prompts |

---

## 9. First three evidence-backed priorities (thin / electronic character)

1. **Pulse-driven / band-limited combustion excitation with real low-order body energy** for pilot V8 profiles behind an opt-in flag — reduce dependence on bright sawtooth harmonic stacks (`layers.ts` / Improved path) while keeping V2 worklet architecture where it already helps (`ACOUSTIC_ENGINE_BY_PROFILE`).
2. **Measurement lab (Prompt 01)** before broad tuning — band energy / centroid / crest on deterministic fixtures so “more bass” is not a blind global EQ; disclose OfflineAudioContext vs realtime worklet limits.
3. **Authoritative city VT thresholds + UI/audio single state (Prompt 03)** — **Done:** City/Touring/Sport presets + sequence IDs on `VirtualPowertrainState`; City default behind `VITE_CITY_SHIFT_PRESET`.

---

## 10. Test and script inventory (baseline)

| Script | Command |
| --- | --- |
| Unit / integration | `npm test` (vitest) |
| Typecheck | `npm run typecheck` |
| Audio regression | `npm run test:update-audio` |
| Compare renders | `npm run audio:compare` |
| Matrix regenerate | `npm run audio:profile-matrix` |
| Portfolio | `npm run audio:portfolio` |

Key tests: `profile-specs/getAcousticProfileSpec.test.ts`, `profiles.test.ts`, `realism/v2/hybrid-combustion.test.ts`, `regression/audio-regression.test.ts` (narrow: primarily `gt-v8` + `cyber-pulse`), `powertrain/simulator.test.ts`, `engine-profile-switch.test.ts`.

Regression coverage for full 57 IDs is **not** present; treat portfolio gaps as known, not invented failures.
