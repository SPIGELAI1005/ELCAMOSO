# ELCAMOSO — Memory Bank & Changelog

Living document for product context, recent architecture decisions, and a dated changelog.
Canonical product rules still live in `elcamoso-comprehensive-spec.md`. Update **both** when direction or architecture changes.

**Last updated:** 2026-09-18

---

## Memory bank

### Product identity (do not drift)

| Item                    | Value                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| Consumer name           | **ELCAMOSO** (do not spell out the acronym in UI; About/docs only)               |
| Expansion               | ELectric CAr MOtion SOund                                                        |
| Tagline                 | Your EV. Your Sound. More Emotion.                                               |
| Landing supporting line | Feel the e-motion in your electrical motion.                                     |
| Mark                    | **O )))** only (no cars, lightning, exhaust, speakers, racing flags, OEM brands) |
| Wordmark                | `E L C A M O S O` (Outfit, wide tracking; Latin A for cross-browser consistency) |
| UI language             | Sound Profile, Drive Mode, Motion (never oscillator / LFO / VST in UI)           |
| Privacy                 | Motion data on-device unless user explicitly opts into cloud                     |

**Product positioning:** ELCAMOSO is both a live motion-sound experience and a silence-first creative journey recorder. Core language: **“Hear it now. Or hear it later.”** Live sound is optional; a quiet drive can become Engine, Symphony, World, Fusion, or a condensed Drive Song after arrival.

### Stack

- TanStack Start + React 19 + Vite
- Router: `@tanstack/react-router` (not `react-router-dom`)
- Tailwind v4 via `src/styles.css` `@theme`
- Web Audio API only for sound
- Settings: localStorage + versioned `sanitizeSettings`
- Cloud (if any): ELCAMOSO Cloud — never say “Supabase” in user-facing copy

### Routes

`/`, `/onboarding`, `/drive`, `/explore`, `/demo`, `/sounds`, `/symphony`, `/worlds`, `/fusion`, `/studio`, `/garage`, `/journeys`, `/journeys/$journeyId` (Replay/Remix + separate Drive Song), `/calibrate`, `/settings`, `/about`, `/pricing`, `/legal` (+ impressum, privacy, cookies, terms, accessibility), `/auth/account/callback` (magic link), `/auth/account/google/callback` (Google OAuth, server GET), `/upgrade/$token`, `/pair`, `/pair/$token` (Tesla↔phone QR claim), `/connect/$sessionId` (legacy join), `/share/drive/$shareId` (Drive Song share, noindex + OG), `/api/og` + `/api/og/drive-song/$shareId` (social cards), `/debug` (dev-only; includes `/debug/og` social card preview, `/debug/calibration` road-test lab, `/debug` Realism V2 A/B)

### SEO / Social cards

- Central SEO: `src/lib/seo/*` — canonical always `https://www.elcamoso.com`
- Social cards: `src/lib/og/*` via Satori + resvg-wasm. Docs: `docs/SOCIAL_CARD_SYSTEM.md`, `docs/SEO.md`
- **Motion Signature:** `src/lib/motion-signature/` + `MotionSignature` component — deterministic energy-derived visual fingerprint for Drive Song / Journey / future Garage & Reel
- **Silent Capture:** `driveOutputMode` + `src/lib/journey-trace/` — record motion without audio; replay/reinterpret later. Docs: `docs/SILENT_CAPTURE.md`, `docs/JOURNEY_TRACE.md`
- **Native Companion:** Capacitor 8.5.2 iOS/Android shells + `src/lib/motion-capture/` provider boundary. Native capture persists coordinate-free chunks across lock/background and imports/deduplicates into JourneyTrace. Docs: `docs/NATIVE_COMPANION.md`.
- Static fallbacks: `public/og/*.png` · fonts: `assets/fonts/Outfit-*.ttf`

### Account / auth (current)

- **Magic link** + **Google OAuth** (Authorization Code + PKCE + state/nonce + ID token validation).
- Session: HttpOnly cookie `elcamoso_account_session` (Secure in production, SameSite=Lax). Profile UX in localStorage is `{ userId, email, expiresAt }` only — no session token, no Google tokens.
- Server-only env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (never `VITE_*`). Docs: `docs/account-google-oauth.md`.
- **Continue with Google** only when all three Google env vars are set; partial config fails startup validation in `src/server.ts`.
- Tesla vehicle OAuth remains separate (`docs/dynamic-drive/tesla-oauth-env.md`).

### Sound architecture (current)

- Web Audio only. Improved strategies + Dynamic Drive layered synth for virtual-transmission profiles.
- **Realism V2.1 (default for combustion):** continuous worklet combustion excitation → formants/body resonance; Powertrain-authored RPM/load/shift phases. A/B vs Current on `/debug`. See `docs/AUDIO_REALISM_V2.md`.
- Road Feel V3 master gain / perceptual volume remains authoritative for cabin loudness.

- **Built-in Sound Profiles:** **47** (22 original + 25 expansion in `src/lib/sound/profiles-expansion.ts`)
- Default synthesis path: **improved** (`src/lib/sound/realism/`); original kept for A/B on `/debug`
- **UI categories** (`PROFILE_CATEGORIES`): Classic, Motorsport, Future, Nautical, Aviation, Machines, Nature, Heritage, Musical, Festive, Playful, Garage
- **Technical families** (engine, not UI chips): `physical` | `designed` | `environmental` | `musical` — see `src/lib/sound/realism/families.ts`
- Optional profile metadata: `motionModel`, `sourceMode`
- DSP primitives: `src/lib/sound/dsp/` (+ `layers-extra.ts` for expansion)
- Strategies: `strategies.ts` + `strategies-extra.ts`
- Loudness balance: `src/lib/sound/realism/loudness.ts`
- Subjective review notes: `docs/SOUND_PROFILE_REVIEW.md`
- Noise / environments / fidelity: `docs/SOUND_NOISE_AND_FIDELITY.md`
- Environments: `src/lib/sound/environments.ts` (`textureScale`; **Showroom** mutes beds/hiss)

### Powertrain / Dynamic Drive calibration

- Powertrain Calibration V2: demand bands, dual speed filters, kickdown queue — `docs/POWERTRAIN_CALIBRATION_V2.md`
- **Road Feel V3 (Tesla cabin):** earlier light/normal shift maps for mainstream combustion; phase-aware shift load in Dynamic Drive synth; perceptual volume + coherent master gain staging; Tesla Road Test HUD (`?roadTest=1` or Drive debug diagnostics)
- Regen calibration tables: `npx tsx scripts/generate-powertrain-calibration-v2.ts`
- Road-test calibration lab: `/debug/calibration` — capture/replay traces without GPS routes — `docs/ROAD_TEST_CALIBRATION.md`, `src/lib/calibration/`

### Session / audition pitfalls (fixed)

- `getTuning()` always returns a **new object**. Never put its result (or other fresh object identities) in a `useEffect` dependency array that calls `syncConfig` → `emit`.
- `DriveSession.syncConfig` must **fingerprint** config content and skip `emit` when unchanged.
- `useAudition` gates sync on a **serialized config key**, not object identity of `tuning` / `mix` / `snippets`.

### Landing page (`/`) conventions

- **Breakpoints:** Stacked centered hero on phone + tablet (&lt; `lg` / 1024px). Two-column hero only at **`lg+`** to avoid wordmark / **Start Drive** overlap on iPad.
- Hero: brand block stacks **O )))** mark → **ELCAMOSO** → **Electric Car Motion Sound** (flex word row, width locked to wordmark — no Safari `text-justify`). Mark + **MOSO** letters share phased hero animation (`useHeroWavePhase`: intro → hold → idle `wave-radiate` matching header mark).
- **Read About:** under **Hear it** on phone/tablet; at **`lg+`** aligns with expansion row beside **Electric Car Motion Sound** (**About** in red `#e53935`).
- CTA column (`lg+`): tagline + supporting line + **Start Drive** + **Hear it**; no duplicate bottom tagline block.
- Below fold: curated sound previews + **Plans** (`LandingPlansSection`: monthly/yearly toggle, early-adopter strikethrough pricing, red billing notice when checkout disabled) + privacy blurb (no duplicate legal links — footer only).
- `/about`: founder story, **Motion becomes sound.** visual + Tesla cabin clips, field-capture clips in `public/about/` (user-controlled `<video>`, no autoplay).

### Header nav (`BrandNav`)

- **Breakpoints:** Inline primary nav + full logo lockup at **`lg+` only**. Tablet uses mark + hamburger sheet (same as phone) — prevents link overlap at ~768–1023px.
- **Pricing** → `/pricing`; **Drive** and **About** accent red (`#e53935`).
- i18n keys: `nav.pricing`, `nav.about`, `nav.drive`, etc.

### Pricing (`/pricing`)

- Monthly / yearly toggle; **14% early adopter** discount (list prices struck through in red; charged amounts in `plan-display.ts`).
- Billing-disabled copy in red; primary secondary CTA **Open Drive** → `/drive` with footer spacing preserved.

### Mini player / headroom

- Sticky MiniPlayer shows while session is live (hidden on `/`).
- Compact **Headroom** meter is always visible; full loudness copy remains in Audition.
- Mobile: wave-inspired hamburger (`WaveMenuIcon`) opens a right sheet until **`lg`**; inline nav at **`lg+`**.
- Files: `src/components/MiniPlayer.tsx`, `src/components/HeadroomMeter.tsx`, `src/components/BrandNav.tsx`, `src/components/WaveMenuIcon.tsx`

### Branding assets

- Favicon / PWA icons: `public/icon.svg` (O ))) mark) → `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`
- User-facing cloud name: **ELCAMOSO Cloud** (not third-party brand names)

### Session / Drive (phone path)

- GPS: prefer `coords.speed`; if null, derive m/s from lat/lon deltas (`src/lib/drive/gps-speed.ts`) then fuse via `src/lib/motion/sensor-fusion.ts`.
- Phone relay: `/drive` Connect phone → QR `/pair/{token}` → WebSocket `motion` → `DriveSession.ingestPhoneRelayMotion()`. Free includes `phone_sensor`. Docs: `docs/PHONE_PAIRING.md`.
- **Drive Symphony V1:** `src/lib/symphony/` — Drive Energy, fixed-BPM clock, quantized stems; profiles `symphony-cinematic-rock`, `symphony-motion-orchestra`, `symphony-neon-run`. Docs: `docs/DRIVE_SYMPHONY.md`.
- **Fusion V1:** `src/lib/fusion/` — Machine + Music mixer, harmonic resonance; presets Road Anthem / Mechanical Symphony / Midnight Boost / Future Pulse. Docs: `docs/FUSION_AUDIO.md`.
- **Worlds V1:** `src/lib/worlds/` — Space Drive, Cyber City, Storm Run reactive soundscapes. Docs: `docs/WORLDS_ENGINE.md`.
- **Journey Composer V1:** `src/lib/journey/` — Drive DNA, condensed Drive Song, local journeys + privacy-first share. Docs: `docs/JOURNEY_COMPOSER.md`.
- Dynamic Drive: `PowertrainSimulator` + `DynamicDriveSynth` when `settings.dynamicDrive` and profile support it. See `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`.
- Wake lock: requested for **all** live Drive (not only Cockpit); re-acquired on visibility resume / pageshow / wake `release`.
- Visibility: Drive uses ~2.8 s hide grace before audio suspend (notification shade); pagehide still suspends immediately.
- Tesla / in-car browser: field checklist `docs/TESLA_BROWSER_SMOKE_TEST.md`. Phone pairing always on `/drive` (Free). Cockpit `?cockpit=1` still enables safety / upgrade layout extras.

### Key files

| Area                         | Path                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Spec                         | `elcamoso-comprehensive-spec.md`                                                    |
| Profiles                     | `src/lib/sound/profiles.ts`, `profiles-expansion.ts`                                |
| Realism                      | `src/lib/sound/realism/*`                                                           |
| Realism V2                   | `src/lib/sound/realism/v2/`, `docs/AUDIO_REALISM_V2.md`                             |
| Calibration lab              | `src/lib/calibration/`, `docs/ROAD_TEST_CALIBRATION.md`                             |
| Powertrain V2 notes          | `docs/POWERTRAIN_CALIBRATION_V2.md`                                                 |
| Account / Google OAuth       | `src/lib/account/*`, `docs/account-google-oauth.md`                                 |
| Session                      | `src/lib/drive/session.ts`                                                          |
| GPS speed                    | `src/lib/drive/gps-speed.ts`                                                        |
| Sensor fusion                | `src/lib/motion/sensor-fusion.ts`                                                   |
| Dynamic Drive architecture   | `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`                                                |
| Sound character + engagement | `docs/SOUND_CHARACTER_SPEC.md`                                                      |
| Audio sample requirements    | `docs/audio-asset-requirements.md`                                                  |
| Audition hook                | `src/lib/drive/useAudition.ts`                                                      |
| Landing                      | `src/routes/index.tsx`, `src/components/LandingHero.tsx`, `LandingPlansSection.tsx` |
| Pricing                      | `src/routes/pricing.tsx`, `src/lib/billing/plan-display.ts`                         |
| About                        | `src/routes/about.tsx`, `public/about/field-capture-*.mp4`                          |
| Sounds UI                    | `src/routes/sounds.tsx`                                                             |
| Legal operator               | `src/lib/legal/operator.ts`                                                         |
| Tesla smoke test             | `docs/TESLA_BROWSER_SMOKE_TEST.md`                                                  |
| Agent notes                  | `AGENTS.md`                                                                         |

### Open / known follow-ups

- Subjective tuning pass done for Dragon / Thunder Beast / Formula Electric / Superbike / Neon — see `docs/SOUND_PROFILE_REVIEW.md`
- Second pass done for Retro Arcade / Construction Monster / Flat-Six / Tank / American Muscle V8
- Third pass done for Synthwave / Turbo Inline-6 / Horse Gallop / Jet Ski / GT V8
- Fourth pass done for Maglev / High-Speed Train / Snowmobile / Electric Hypercar / Rain Drive
- Fifth pass done for Submarine (manual sonar) / Ocean / Deep Bass / Zen / Big Twin + Arcade phone polish
- **Noise / Showroom pass:** `textureScale` on environments; Showroom = no texture hiss; global voice.noise + wind cuts; Horse Gallop transverse gait rewrite — `docs/SOUND_NOISE_AND_FIDELITY.md`
- Sticky chrome fix: BrandNav + Sounds/Studio listen bars; Cabin EQ presets (Phone speakers / Cabin / Headphones)
- Demo Drive: PRND + pedals; guided tour; `useDemoDrive` syncs profile; `DemoSoundPicker` for full catalog
- Find a sound on `/sounds` (local matcher + optional `findSoundFn`)
- Card Preview / Listen on `/sounds` updates settings and calls `listenProfile` (in-place switch when already playing)
- Title-fidelity pass: Playful (laugh/fart/kazoo) + Neon Drive + Construction Monster
- Phone Drive harden: GPS `coords.speed` null → lat/lon delta fallback; wake lock for all live Drive; visibility hide grace; Tesla browser smoke checklist in `docs/TESLA_BROWSER_SMOKE_TEST.md`
- Playwright e2e: `e2e/` + `playwright.config.ts`; scripts `npm run test:e2e` / `test:e2e:ui` (chromium + mobile-chrome)
- Mid-play Sound Profile switch: `listenProfile` reuses the live engine (no AudioContext rebuild); awaited `stopSoft`; safer Media Session / meter / `setProfile`
- **Premium UX refactor (P0–P3):** `MotionEnergy` + Drive instrument / safety mode; mobile bottom nav; Home storytelling + hold-to-accel; Sounds mood IA; Studio Basic/Advanced; Garage/Settings/Onboarding simplified
- **Durable account store:** Google + magic-link sessions are still in-memory on the server until Postgres-backed account storage ships
- **Realism V2:** sample-assisted combustion bank ready in schema; ship licensed/self-recorded WAVs when available
- **Road-test loop:** collect Tesla traces via `/debug/calibration`, tune powertrain/audio offline against fixtures

---

## Changelog

### 2026-09-18 (Release hardening and traceability)

- Relay credentials are bound to display/phone/telemetry roles; duplicate or unauthenticated peers
  close before attachment and cannot relay messages. Actor throttling covers rotating pairing codes.
- Typecheck and lint are clean. Full Vitest gate: 692 passed, 6 skipped. SEO and production build
  gates pass locally.
- Packaging is capability-based and additive: legacy Free grants remain, while the Free creative
  loop and Drive+ full capabilities have explicit entitlement IDs and selection gates.
- Studio preset sharing now uses a versioned, bounded, allowlisted UTF-8 payload. Invalid links fail
  closed and Symphony instruments always retain a viable arrangement.
- Added a Web Audio lifecycle harness with node/source counts and fixed World layer disposal.
- Added enforceable per-stem Symphony manifests. Current development synthesis is blocked from
  production until approved original, commissioned, or licensed stems are supplied.
- Added `docs/REQUIREMENTS_TRACEABILITY.md` with implementation, automated, manual, and external
  mappings. Live deployment remains blocked by Vercel login/project linkage; the existing public
  deployment is stale and relay DNS is absent.
- Start Drive is again a semantic navigation link with synchronous audio priming. Browser tests
  now wait for an explicit client hydration marker before interacting, and the Demo engine-category
  switch passes on desktop as well as mobile.

### 2026-09-18 (Live or later product positioning)

- Homepage message now states: **“Hear your drive live, or turn the journey into sound when you arrive.”**
- Added a live-versus-Silent-Capture explanation and clarified full Journey Replay versus condensed Drive Song.
- About story now positions ELCAMOSO for EV enthusiasts, quiet-cabin drivers, commuters, road-trippers, music lovers, and creators, including the Munich-to-Garmisch journey scenario.
- Removed the em dash character from application and native-shell source text; use ordinary punctuation instead.

### 2026-09-18 (Native Companion foundation)

- Added Capacitor 8.5.2 core/CLI/iOS/Android projects without replacing TanStack Start or changing the Vercel build.
- Central `MotionCaptureProvider` boundary: web foreground best-effort vs native background-capable capture; no scattered platform checks.
- iOS Core Location automotive background capture with explicit Always permission, visible indicator, location-only background mode, chunked app-private storage, and interrupted-journey recovery.
- Android location foreground service with Android 12+ visible-start compliance, Android 14+ service-type permission, persistent **“ELCAMOSO is capturing this drive”** notification, Stop action, chunked storage, and recovery.
- Drive consent/quality/status UX, idempotent native JourneyTrace import, exact “Journey recovered.” feedback, and native privacy/deduplication tests.
- Setup, store considerations, limitations, and physical-device matrices documented in `docs/NATIVE_COMPANION.md` plus platform guides.

### 2026-09-18 (Journey Replay & Remix — Hear This Drive)

- `/journeys/$journeyId` now presents real-time **REPLAY DRIVE** separately from the condensed **DRIVE SONG** product.
- Premium Journey Player: Motion Signature playhead, speed / virtual gear / RPM, seek/restart/stop, optional parked position, Engine / Symphony / World / Fusion switching.
- Engine choices rerun their own PowertrainSimulator from immutable JourneyTrace motion; no cross-profile gear/RPM reuse.
- **REMIX DRIVE** persists `JourneyInterpretationV1` with a deterministic seed and never creates a second Journey.
- Silent Capture can feed the existing Journey Composer directly; the Drive Song summary retains the JourneyTrace id.
- Stable seed now reaches Symphony, World, and Fusion audio construction. Dev **A/B SAME DRIVE** advances both personalities at the same trace index.
- Regression coverage: engine RPM/gear divergence, deterministic seek/restart/peek, same-seed Symphony arrangement, and audio graph cleanup diagnostics.

### 2026-09-17 (Silent Capture & Journey Trace V1)

- Drive modes: LIVE SOUND / SILENT CAPTURE / LIVE + CAPTURE (`driveOutputMode`).
- `JourneyTraceV1` + adaptive sampler + IndexedDB `JourneyRepository`; no lat/lon.
- Silent Capture skips SoundEngine; post-drive “YOUR DRIVE IS READY” + Motion Signature.
- `JourneyReplaySource` for reinterpretation (Engine powertrain re-sim against raw motion).
- Docs: `docs/SILENT_CAPTURE.md`, `docs/JOURNEY_TRACE.md`.

### 2026-09-17 (Social card / Open Graph visual system)

- Central `src/lib/og/*` templates (brand, engine, symphony, world, fusion, drive-song, journey, pricing).
- Dynamic PNG via Satori + resvg-wasm: `/api/og`, `/api/og/drive-song/$shareId`; static fallbacks in `public/og/`.
- Privacy: `PublicDriveShareMetadata` only; Outfit fonts in `assets/fonts/`; DEV preview `/debug/og`.
- Docs: `docs/SOCIAL_CARD_SYSTEM.md`. SEO `og:image` resolves to absolute dynamic URLs with static fallback.
- **Motion Signature** (`src/lib/motion-signature/`): deterministic ribbon fingerprint from seed + energy samples; Drive Song card hero visual; reusable UI component.

### 2026-09-17 (Professional SEO platform)

- Central `src/lib/seo/` — metadata builder, route index policy, JSON-LD, OG images, sitemap.
- `public/robots.txt` + `/sitemap.xml`; preview `noindex`; apex→www in `vercel.json`.
- Docs: `docs/SEO.md`. Script: `npm run seo:check`.

### 2026-09-17 (Production readiness gate — relay + assets + safety)

- Prod probe: `www.elcamoso.com/api/drive-relay/ws` → **404** (Vercel cannot host long-lived WS).
- `DriveRelayTransport` + `VITE_DRIVE_RELAY_PUBLIC_ORIGIN`; dedicated `services/drive-relay` + remote session proxy.
- Symphony `pack-loader` (lazy/preload/progress/cache); “Music couldn't load.” UI; Studio/Explore driving gate.
- Docs: `PRODUCTION_RELEASE_CHECKLIST.md`, `DRIVE_RELAY_DEPLOYMENT.md`, `BROWSER_SUPPORT_MATRIX.md`, `PRODUCTION_ROAD_TEST.md`.

### 2026-09-17 (Studio 2.0 — Sound / Symphony / Fusion)

- Studio modes Sound · Symphony · Fusion; six arrangement dials; instrument focus; demo traces + A/B.
- Experience Presets saved to Garage; describe→params (no telemetry). Dev `/debug/symphony-assets`.
- Docs: `docs/STUDIO_SYMPHONY.md`, `docs/MUSIC_ASSET_GOVERNANCE.md`.

### 2026-09-17 (Journey Composer — Drive DNA + Drive Song)

- Privacy-first `JourneySummary` (no GPS/route) in IndexedDB; post-drive “YOUR DRIVE HAS A SOUND.”
- Drive DNA (Energy / Flow / Rhythm / Variation / Regen) + JourneyComposer (~2–3 min WAV via OfflineAudioContext).
- Routes: `/journeys`, `/journeys/$journeyId`, `/share/drive/$shareId`. Flags `DRIVE_SONG_ENABLED` / `DRIVE_REEL_ENABLED` default on.
- Docs: `docs/JOURNEY_COMPOSER.md`, `docs/DRIVE_DNA.md`, `docs/DRIVE_SHARING_PRIVACY.md`.

### 2026-09-17 (Fusion + Worlds Experience Engine V1)

- Fusion: `FusionSynth` + perceptual Machine/Music mixer + optional Harmonic Resonance; four presets; Garage-saved blends.
- Worlds: reactive World State Engine for Space Drive, Cyber City, Storm Run (procedural layers; soft thunder cooldown).
- Neon Run Symphony pack (128 BPM) for Fusion Midnight Boost / Future Pulse.
- Flags `FUSION_ENABLED` / `WORLDS_ENGINE_ENABLED` default on. Docs: `docs/FUSION_AUDIO.md`, `docs/WORLDS_ENGINE.md`.

### 2026-09-17 (Drive Symphony Engine V1)

- Musical pipeline: Drive Energy → semantic events → quantized arrangement → stem mixer → master bus.
- Packs: Cinematic Rock (112 BPM), Motion Orchestra (96 BPM); procedural placeholder stems.
- Wired via `SymphonySynth` in `SoundEngine` (single AudioContext). `/symphony` Listen demo + `/debug/symphony`.
- Docs: `docs/DRIVE_SYMPHONY.md`, `docs/SYMPHONY_AUDIO_ASSETS.md`. Flag `SYMPHONY_ENABLED` default on.

### 2026-09-17 (Motion Experiences platform foundation)

- Product taxonomy: Experience = Engine / Symphony / World / Fusion (`src/lib/experiences/`).
- Nav: Drive · Explore · Studio · Garage; `/sounds` preserved.
- Routes: `/explore`, `/symphony`, `/worlds`, `/fusion`; landing repositioned to “Turn motion into sound.”
- Drive parked picker; Garage tabs Sounds / Experiences / Songs / Journeys.
- Flags: `SYMPHONY_ENABLED`, `FUSION_ENABLED`, `DRIVE_SONG_ENABLED`, `DRIVE_REEL_ENABLED` (default off).
- Docs: `docs/MOTION_EXPERIENCES_ARCHITECTURE.md`.

### 2026-09-17 (Tesla ↔ phone QR pairing — Free)

- Free includes `phone_sensor` for basic Tesla↔phone QR pairing (Drive+ still gates premium audio/profiles).
- `/drive` always shows **Phone sensor / Connect phone** (no `?cockpit=1` / Drive+ gate).
- Short-lived single-use claim tokens → `/pair/{token}`; manual `/pair` code entry; existing drive-relay WebSocket reused.
- Docs: `docs/PHONE_PAIRING.md`.

### 2026-09-17 (Combustion Realism V2.1)

- Continuous worklet combustion (architecture/sharpness/load); body resonances; load→timbre tilt.
- Shift audio follows Powertrain `shiftPhase` + `shiftLoadMultiplier` (not noise swooshes).
- Realism V2 default for eligible combustion profiles; Current Engine remains A/B on `/debug`.
- Sample dual-player crossfade ready when buffers injected; docs `docs/AUDIO_REALISM_V2.md`.

### 2026-09-17 (Tesla Road Feel V3 — shift frequency, audibility, cabin gain)

- Recalibrated light/normal shift maps so Flat-Six / Turbo I6 1→2 is ~26–30 km/h (was ~43–52).
- Shift audibility: synth uses controller `shiftLoadMultiplier` / phases; deeper duck + reengage thump (no fake swoosh).
- Gain staging: perceptual volume curve, higher MasterBus (0.90), load floor ~0.82, removed source-like 0.55 soft-start cut; profile loudness on all backends.
- Developer Tesla Road Test HUD + expanded powertrain runtime diagnostics (gear / phase / demand / backend).
- Deterministic road-feel scenarios + tests; audio regression snapshots **not** auto-updated (still green).

### 2026-09-17 (Google account OAuth + HttpOnly sessions)

- Google Authorization Code flow with **PKCE**, **state**, **nonce**, and ID token validation (issuer / audience / exp / nonce).
- Code exchange on server route `GET /auth/account/google/callback` only; `GOOGLE_CLIENT_SECRET` never leaves server env.
- Account session cookie `elcamoso_account_session`: HttpOnly, Secure in production, SameSite=Lax; no Google tokens or session secrets in localStorage.
- Header account UI: user icon + sign-in dialog; **Continue with Google** only when Google env is fully configured.
- Startup validation for partial/misconfigured `GOOGLE_*`; production redirect URI must be `https://www.elcamoso.com/auth/account/google/callback`.
- Docs: `docs/account-google-oauth.md`. Tests: `src/lib/account/google-oauth.test.ts`.
- `.gitignore`: explicit `.env` / `.env.*` (keep `.env.example`).

### 2026-09-17 (Realism V2 + powertrain calibration + road-test lab)

- **Audio Realism V2:** hybrid combustion synth + AudioWorklet excitation; Current vs V2 A/B on `/debug` — `docs/AUDIO_REALISM_V2.md`.
- **Powertrain Calibration V2:** dual speed filters, demand bands, kickdown queue, personality tables — `docs/POWERTRAIN_CALIBRATION_V2.md`.
- Versioned calibration traces (`elcamoso.calibration.trace` v1): motion + powertrain time-series without GPS routes; JSON export/import.
- Deterministic scenario library + replay/metrics/compare; sanitized Vitest fixtures under `src/lib/calibration/fixtures/`.
- Dev route `/debug/calibration`: lab playback (Current vs Realism V2, Dynamic vs Legacy, scrub/rate), Tesla road-test recording mode, local subjective notes.
- Docs: `docs/ROAD_TEST_CALIBRATION.md`.
- Brand mark polish: **O )))** wave geometry / animation on header and landing.

### 2026-08-30 (Responsive hero, nav, and wordmark expansion)

- **Wordmark expansion:** Replaced Safari-broken `text-justify: inter-character` with flex `space-between` word spans; width synced to **ELCAMOSO** lockup; clamped gaps for iPhone/iPad.
- **Tablet / iPad:** Hero two-column layout deferred to **`lg` (1024px)** — stacked layout below that prevents **Start Drive** overlapping wordmark and **Read About** colliding with expansion text.
- **Header:** Full logo + inline nav also at **`lg+`**; tablet shows mark + hamburger to fix nav link overlap.
- **Read About (mobile):** CTA stack places link under **Hear it** (not floating in brand column).
- **About:** Tesla cabin clips under **Motion becomes sound.** (`public/about/tesla-motion-*.mp4`).

### 2026-08-30 (Landing, About, pricing UX)

- **Hero:** Supporting line → _Feel the e-motion in your electrical motion._; phased mark/MOSO animation aligned with header idle pulse; **Read About** link row-aligned with **Electric Car Motion Sound** (**About** in red).
- **Home:** Removed duplicate bottom tagline + **Start Drive** block; removed redundant legal links under privacy section; **Plans** section with monthly/yearly toggle, early-adopter strikethrough (Free ~~€1.14~~ → €0; Drive+ 14% off), red “Special offer for early adopters” + red billing-disabled notice.
- **About (`/about`):** Founder story (EV + petrol rental contrast, field recording); **Motion becomes sound.** section moved from home; two field clips (`public/about/field-capture-1.mp4`, `field-capture-2.mp4`).
- **Pricing (`/pricing`):** Same plan toggle/discount math; red billing notice; **Open Drive** CTA with consistent footer offset.
- **Nav:** **Pricing** in header; **Drive** + **About** accent red.
- **Demo fix:** `EntitlementEnforcer` no longer resets preview profile on Demo/Sounds; `SessionBridge` + `DemoSoundPicker` sync regression in `e2e/demo.spec.ts`.

### 2026-08-23 (Sound character + engagement spec)

- Added `docs/SOUND_CHARACTER_SPEC.md` — driving-scenario matrix, per-profile character specs, 30-min engagement ratings, variation architecture.
- Added `docs/audio-asset-requirements.md` — recorded asset gaps (no samples shipped); procedural fallbacks documented; filename conventions per personality.

### 2026-08-29 (Monetization audit — read-only)

- Added `docs/monetization-audit.md`: FREE vs DRIVE+ model, current-state audit (no Stripe/accounts/entitlements today), recommended ACCOUNT → Billing → Entitlements → Gates → Drive architecture, phased plan, security rules. **No production code changes.**

### 2026-08-29 (Sound character engagement review)

- Rewrote `docs/SOUND_CHARACTER_SPEC.md`: 15-scenario matrix, all 47 profiles, 8 personalities, 30-min engagement tiers.
- Updated `docs/audio-asset-requirements.md`: bike/twin/tractor personalities implemented; procedural fallbacks documented.
- Confirmed: no WAV assets shipped; variation from deterministic powertrain + contextual transients + synthetic load (continuous).

### 2026-08-29 (Dynamic Drive product polish)

- Tesla pairing: "Link your phone" / "Start link"; probe + latency UI dev-only.
- Cockpit instrument: profile + gear + rev only; no "Motion matched" / "Good" chrome.
- Phone after link: one quiet line or attention message — no GPS/Motion/Calibration grid.
- Phone remote: product labels (Motion character, Shift feel) — no "Dynamic Drive" jargon.
- Settings Drive debug hint softened for progressive disclosure.

### 2026-08-29 (Dynamic Drive final architecture cleanup)

- Canonical onboarding guide rewritten: `docs/DYNAMIC_DRIVE_ARCHITECTURE.md` (Phone → Session → Sensors → Fusion → Powertrain → Audio → Tesla cockpit).
- Unified `MotionFallbackTier` — single definition in `src/lib/motion/types.ts`.
- Extracted demo physics: `src/lib/drive/demo-physics.ts` (+ tests); `DemoControls` moved there; session re-exports.
- Technical debt audit documented in architecture guide (WebSockets, timers, audio dispose, React boundaries).
- Updated: `sensor-fusion.md`, `motion-pipeline.md`, `motion-resilience.md`, `dynamic-drive-audit.md` header.

### 2026-08-23 (Sound engagement P0/P1/P2)

- **P0:** Added drivetrain personalities `motorcycle-inline-4`, `v-twin-cruiser`, `single-cylinder-ag`; mapped **Motorcycle Superbike**, **Big Twin**, **Wiesn Tractor**; per-personality transient variant pools in `transient-scheduler.ts` (`resolveVariantPools`).
- **P1 (procedural):** Expanded american-v8 overrun (3 variants), turbo-i6 flutter/wastegate (3 each) — sample filenames in `docs/audio-asset-requirements.md`; no WAV files added.
- **P2:** `computeSyntheticLoad()` + `MotionFrame.syntheticLoad` in improved motion path so continuous profiles differ at cruise vs WOT at the same speed.
- Docs: `SOUND_CHARACTER_SPEC.md`, `drivetrain-personalities.md`; tests: personalities (8), transient pools, `motion.test.ts`.

### 2026-08-23 (Dynamic Drive product polish)

- Drive instrument: gear-first; rev only in cockpit; status only when link needs attention; removed "Dynamic Drive" / "Drive Signal" chrome.
- Phone link collapses to "Linked to your car" after pairing; sensor grid hidden when healthy.
- Tesla pairing panel collapses to "Phone linked"; latency/pipeline metrics behind Drive debug mode.
- Settings Advanced: "Motion-matched sound" replaces synth jargon; phone remote uses product language.

### 2026-08-23 (Dynamic Drive architecture cleanup)

- Shipped architecture guide: `docs/DYNAMIC_DRIVE_ARCHITECTURE.md` (Phone → Session → Sensors → Fusion → Powertrain → Audio → Tesla cockpit).
- Removed deprecated `src/lib/drive/fusion.ts`; fusion lives in `src/lib/motion/sensor-fusion.ts`.
- Trimmed `useDriveSession` to lifecycle only; settings sync stays in `SessionBridge`.
- Relay client validates inbound messages with `parseRelayMessage`; `DynamicDriveSynth.dispose()` disconnects audio nodes.
- Removed unused session fields (`gpsSpeed`, `accY`, `imuAt`); updated spec, audit header, smoke test, and memory bank.

### 2026-08-22 (premium product UX refactor)

- **P0:** `motion-energy.ts` on session snapshot; Drive instrument UI (profile-aware secondary readout, product status, safety mode &gt;5 km/h); mark `direction`; hide nav/MiniPlayer in safety mode; mobile bottom nav (Drive/Sounds/Studio/Garage); Demo demoted to menu.
- **P1:** Home hero hierarchy (no acronym); Feel the motion (real demo session); curated four; how-it-works + privacy + final CTA; Sounds moods/sections/detail sheet; Advanced accordion for A/B/packs/audition.
- **P2:** Studio “Make it yours” Basic sliders + Advanced; Garage Favorites/Recent/My Sounds; Settings Sound/Driving/Sensors/Privacy/About; onboarding 3 screens.
- **P3:** Branded empty/error copy; e2e + Tesla checklist updates; docs.

### 2026-08-21 (Tesla mid-play sound switch crash)

- Field report: `/sounds` showed “This page didn’t load” when switching Sound Profiles while audio was already playing (reproduced 3× in Tesla browser).
- Root cause: Preview / Listen called `startAudition` → `begin` → non-awaited `stopSoft`, stacking a new `AudioContext` on a still-closing one; profile rebuild also raced the rAF tick.
- Fix: `DriveSession.listenProfile` switches in place when a session is live; `stopSoft` awaits engine close before `begin`; `SoundEngine.setProfile` guards swap + catches build failures; Media Session / meter hardened for incomplete in-car stubs.
- Regression: `engine-profile-switch.test.ts`; Tesla checklist rows for mid-play switch.

### 2026-08-21 (Playwright e2e)

- Added `@playwright/test` with `playwright.config.ts` (reuses local Vite on `localhost:5173`, Chromium + Pixel 7).
- Specs: landing, route smoke (16 paths), legal, demo, sounds/settings/drive, cookies, desktop + mobile nav.
- Helpers seed ready settings + cookie consent; soft-assert Demo/Drive when headless Web Audio is blocked.

### 2026-08-21 (landing hero alignment)

- Brand column: mark centered above **ELCAMOSO**; **Electric Car Motion Sound** under the wordmark; mark size +15% (`10.76rem` / `13.46rem`).
- Desktop: **Start Drive** shares the wordmark vertical band.

### 2026-08-21 (phone Drive harden)

- `resolveGpsSpeed`: prefer reported speed; else haversine delta when accuracy is usable (`gps-speed.ts` + tests).
- `DriveSession`: ingest GPS via resolver; do not treat null `coords.speed` as fresh zero.
- Drive always requests screen wake lock; re-requests on visibility/pageshow and wake `release`.
- Drive `visibilitychange` uses ~2.8 s grace before suspend (notification shade); `pageshow` resumes.
- Field checklist: `docs/TESLA_BROWSER_SMOKE_TEST.md` (Demo → permissions → parked Drive → passenger Drive → verdict).
- Spec Motion / roadmap bullets updated for delta speed + wake behavior.

### 2026-08-21 (Vercel deploy)

- Root cause of Vercel `404 NOT_FOUND`: Lovable Vite preset defaults Nitro to Cloudflare.
- Fix: `nitro: { preset: "vercel" }` in `vite.config.ts` → builds `.vercel/output`.
- Added `vercel.json` with `framework: "tanstack-start"`.
- “Imported from Lovable” on Vercel is metadata from the Lovable stack/package, not a takeover of the GitHub repo.

### 2026-08-21 (legal pages)

- Added `/legal` hub + Impressum, Privacy, Cookies, Terms, Accessibility.
- Site-wide `SiteFooter` and `CookieConsent` bar in root layout.
- Operator details in `src/lib/legal/operator.ts` (Impressum aligned with ONE4Team-style notice; contact `support@elcamoso.com`).

### 2026-08-21 (Deep Bass Pulse)

- Was a continuous soft sine (not a pulse). Rebuilt as discrete 808-style hits: sub drop + mid presence + click.
- BPM ~58–130 with throttle/accel; near-silence between hits so the boom reads; removed masking air bed.

### 2026-08-21 (UFO theremin rebuild)

- Classic UFO = theremin (Day the Earth Stood Still / cartoon saucer idiom), not a low saw engine.
- Pure high sine (~740 Hz register), 5–7 Hz vibrato, slow-fast-slow glissando phrases, volume breathing, stereo orbit.
- Removed ion haze / tractor-beam layers that masked the identity.

### 2026-08-21 (UFO + Neon Drive presence)

- Both were near-silent: thin oscillators + double softGate attenuation.
- UFO: saucer drone, theremin beat, whoop sweeps, louder beams, mid presence peak.
- Neon: gated bass/punch, bright squares, triad stabs, stronger chirps; idle still pulses.
- Loudness bumped to ~1.18 for both.

### 2026-08-21 (sprint: title fidelity + Demo tour + Find a sound)

- **Title fidelity:** Laughing Machine (prior), Farting Car cadence, Kazoo syllables, Neon square pulses + chirps, Construction Monster hydraulics/clunks/diesel lump.
- **Demo Guided Tour:** ~28s auto-throttle showcase (Laugh → Neon → Construction → Fart) on `/demo`.
- **Find a sound:** plain-language matcher on `/sounds` → Listen; `findSoundFn` optional cloud refine; local aliases + tests.
- Files: `find-sound.ts`, `FindSoundPanel.tsx`, `DemoGuidedTour.tsx`.

### 2026-08-21 (Laughing Machine)

- Laughs were nearly inaudible: one-shots started after a long settle-in and levels were too low.
- Added `createLaughCadenceLayer`: formant “ha” + breath, rate/power/pitch rise with throttle and accel.
- Improved laugh one-shot synthesis; shortened first-fire delay for frequent accents; bumped profile loudness.

### 2026-08-21 (noise, Showroom, Horse Gallop)

- Added Environment **Showroom** (`textureScale: 0`): dry core voice without road/wind white-noise beds.
- Environments gained `textureScale`; Open/City/etc. beds and hiss pulled back.
- Softened engine noise gain and wind HF band; remapped high `voice.noise` across built-ins; lowered loud wind/water textures.
- Horse Gallop: research-based walk/trot/canter/gallop + flight; single-horse hooves (brown grit + thud); quieter breath.
- Docs: `docs/SOUND_NOISE_AND_FIDELITY.md`; updated `docs/SOUND_PROFILE_REVIEW.md`.

### 2026-08-21 (Demo Drive cockpit)

- Demo: matte-black pedals, P R N D strip, Park (no rev) / Neutral (rev in place) / D / R physics.
- Full Sound Profile picker on Demo; `useDemoDrive` syncs `profileId` into the live session.

### 2026-08-21 (mobile + branding)

- Mobile-ready nav: logo-inspired wave hamburger + sheet menu; BrandNav on all routes including home.
- Favicons regenerated from O ))) `public/icon.svg`.
- Replaced user-facing “ELCAMOSO Cloud” with **ELCAMOSO Cloud**; runtime error reporting renamed; AGENTS/spec/rules updated.
- Fixed stale landing: service worker was **cache-first** on `/`, so HMR/UI updates never appeared. SW is now network-first for HTML (`elcamoso-shell-v2`).
- Restored large hero mark/wordmark sizes on the start page.

### 2026-08-21

#### Sound catalog

- Added **25** built-in Sound Profiles; built-ins total **47**.
- New categories: **Machines**, **Musical**.
- Wired expansion via `EXPANSION_PROFILES` into `SOUND_PROFILES`.
- Extended families, loudness table, DSP layers, and strategy registry for all new IDs.
- Sounds UI: category chips, intensity filter, search; profiles listed per category.
- Added `docs/SOUND_PROFILE_REVIEW.md` and profile registry tests (unique IDs, count, strategies).

#### Stability

- Fixed **Maximum update depth exceeded** in `<AuditionPanel>`:
  - Cause: `getTuning()` new object each render → `useAudition` → `syncConfig` → `emit` loop.
  - Fix: content fingerprint in `syncConfig`; content-keyed effect in `useAudition`.

#### Preview UX

- MiniPlayer headroom no longer hidden on narrow viewports; compact meter always shown during live preview/drive.
- `HeadroomMeter` supports `compact` mode for the sticky player.

### 2026-08-29 — Production billing readiness

- `MONETIZATION_ENABLED` feature flag — FREE ELCAMOSO unchanged when off.
- Checklist: `docs/billing/production-readiness.md`.
- Legal: Drive+ terms, privacy payment note.

### 2026-08-29 — Billing security audit

- Fixes: checkout origin allowlist, Stripe Price validation on webhook sync, subscription ownership checks, session token hashing, webhook claim races, trial heartbeat entitlement re-check, removed public trial-complete fn, redacted Tesla token resolve metadata.
- Docs: `docs/billing/security.md`.

### 2026-08-29 — Monetization UX review

- Humanized plan UI: Free / Drive+, sentence-case status, "Manage plan" not "Manage subscription".
- Removed in-drive trial upsell nudges; preview timer only while driving.
- Unified purchase copy: no Stripe/dev leaks, no shouty unlock states, tagline on `/pricing`.
- Consumer feature names in plan lists; softened upgrade prompts and trial-complete flow.

### 2026-08-29 — Tesla in-car purchase E2E

- Integration tests: `src/lib/tesla-upgrade/purchase-flow.integration.test.ts` (happy path + 6 failure states).
- Docs: `docs/billing/tesla-purchase-e2e.md` (full scenario + failure matrix).
- Playwright shell: `e2e/tesla-purchase.spec.ts`.
- Tesla smoke checklist §8 in `docs/TESLA_BROWSER_SMOKE_TEST.md`.

### 2026-08-29 — Dynamic Drive trial test suite

- Lifecycle tests: `src/lib/dynamic-drive-trial/lifecycle.test.ts` (16 scenarios).
- Paid subscribers auto-convert trial without consuming balance (`maybeConvertPaidSubscriber`).
- Time exhaustion revokes trial entitlements even when sessions remain.
- Docs: `docs/dynamic-drive-trial-test-suite.md`.

### 2026-08-29 — Stripe test suite

- Lifecycle tests: `src/lib/billing/stripe/lifecycle.test.ts` (14 scenarios, local entitlement asserts).
- Shared fixtures: `src/lib/billing/stripe/test-fixtures.ts`.
- Optional live Test Clock integration: `lifecycle.integration.test.ts` when `STRIPE_LIFECYCLE_TEST_CLOCK=1`.
- Docs: `docs/billing/stripe-test-suite.md`.

### 2026-08-29 — Billing admin diagnostics

- Dev-only `/debug/billing` + CLI (`npm run billing:diagnostics`) for internal user lookup.
- Guarded by `ELCAMOSO_BILLING_ADMIN_SECRET` — read-only snapshot + explicit Stripe re-sync only.
- Docs: `docs/billing/admin-diagnostics.md`.

### 2026-08-29 — Billing failure resilience

- Local-first entitlements: premium gates read `subscription-store` only — no live Stripe on every check.
- Webhooks provision memory entitlements async; Postgres upsert is best-effort (`persistAndProvisionSubscription`).
- Transient Stripe errors → `BillingServiceUnavailableError`; FREE Drive never blocked.
- Reconciliation: `getBillingHealthFn`, `reconcileBillingFn` (explicit Stripe pull only).
- Tests: `src/lib/billing/resilience/failure-resilience.test.ts`.
- Docs: `docs/billing/failure-resilience.md`.

### 2026-08-29 — Stripe Checkout tax readiness

- Configurable Checkout tax params (`STRIPE_CHECKOUT_*` env) — all off by default; no VAT rates in code.
- Docs: `docs/billing/tax-readiness.md` (business/tax owner must confirm DE/EU VAT before production).

### 2026-08-29 — Monetization funnel analytics

- Extended existing telemetry (`trackEvent` / `ingestTelemetryFn`) with 15 funnel events — no new vendor.
- Meta: `source`, `plan`, `interval`, `context`, `milestone`. No GPS, routes, or motion payloads.
- Docs: `docs/monetization-funnel-analytics.md`.

### 2026-08-29 — Dynamic Drive session licensing

- One account / one active Dynamic Drive session (phone + Tesla relay share one tab `driveSessionId` lease).
- Conflict UX: "Dynamic Drive is active on another device." — existing drive is never killed.
- Stale sessions expire after 45 s without heartbeat; basic Drive (non-Dynamic) is never blocked.
- Module: `src/lib/dynamic-drive-session/`; bridges: `DynamicDriveSessionBridge`, `DynamicDriveSessionConflictNotice`.

### 2026-08-29 — Premium sound asset protection

- Audit: no WAV/MP3 in repo; `public/` is PWA-only; all 47 profiles are procedural Web Audio; gating is entitlement on profile IDs.
- Added `docs/premium-sound-asset-protection.md` (limitations, Tesla prefetch guidance, no-DRM policy).
- Foundation: `src/lib/sound-assets/` (catalog, HMAC signing, manifest + delivery API routes). Catalog empty until samples ship.

#### Landing

- “Choose your sound” now mirrors Sounds **category grouping** (same families/categories).
- Supporting copy: **Electric motion. More e-motion.**
- **Electric Car Motion Sound** kept under **Start Drive** (CTA column).
- Large mark / wordmark sizing retained in the brand column.

#### Docs

- Added this memory bank + changelog (`docs/MEMORY_BANK_AND_CHANGELOG.md`).

### Earlier (same initiative)

- Master realism upgrade: improved synth path, DSP primitives, motion mapping, master bus, `/debug` A/B harness.
- Family-specific models (physical / designed / environmental / musical); notable rebuilds (e.g. Turbine Jet, Speed Boat cavitation, Oide Wiesn hot-bulb).

---

## How to maintain this file

1. After a meaningful product or architecture change, add a dated section under **Changelog**.
2. Update **Memory bank** if identity, routes, stack rules, or “do not drift” conventions change.
3. Keep `elcamoso-comprehensive-spec.md` as the full product source of truth; this file is the short working memory + history.
