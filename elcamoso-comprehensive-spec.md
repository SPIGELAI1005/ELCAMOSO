# ELCAMOSO — Comprehensive Product Specification

> Document for AI code assistants (Cursor, etc.) and human contributors. Describes the app as a product, its architecture, features, UX, and implementation conventions. This is a living document: update it when the codebase or product direction changes.

---

## 1. Product Identity

**Name:** ELCAMOSO (ELectric CAr MOtion SOund) — do not display the acronym breakdown in the UI; it may appear only on an About page or documentation.

**Tagline:** "Your EV. Your Sound. More Emotion."

**Brand Positioning:** A premium digital automotive product that gives electric vehicles a configurable sound personality. It is not a fake-engine website, a racing soundboard, or a generic EV utility. The emotional core is the perceived synchronization between movement and sound. Position around the phrase: **"Sound in motion."**

**Visual Identity:**

- Approved mark: **O )))** — the "O" represents the source/vehicle; three curved lines represent sound propagating outward. The shape communicates motion and sound.
- **Forbidden motifs:** lightning bolts, cars, wheels, exhaust pipes, speakers, racing flags.
- **Wordmark style:** `E L C A M O S O`. Uppercase, thin-to-medium weight, wide tracking, geometric, futuristic but understated. Prefer a sophisticated geometric sans-serif (Outfit is the current font choice). Use Latin **A** (not Greek Λ) for reliable rendering across browsers.
- **App icon:** O ))) derivation, black background, white symbol, recognizable at 16px–512px.
- **Color system:** Monochrome. Primary background near-black (#000000 / #0A0A0A). Foreground white/off-white (#F5F5F7). Accent is extremely restrained.
- **Design philosophy:** Apple product page meets premium automotive HMI. Calm, expensive, precise, spacious, tactile. Avoid dashboard clutter and gaming-style gauges.

---

## 2. Core Value Proposition

Electric vehicles are silent. ELCAMOSO restores the emotional, tactile feedback of motion by generating a configurable soundscape that responds to real-time driving dynamics: speed, throttle, acceleration, regen, and (where available) RPM/gear. The sound is not just an overlay; it is a real-time reflection of the driver's input and the vehicle's state.

The product prioritizes:

1. **Synchronization:** Sound must feel tightly coupled to motion.
2. **Personalization:** Every driver can craft a unique sound personality.
3. **Safety:** Audio levels are controlled, predictable, and never startling.
4. **Privacy:** Motion data is processed locally. "Your drive stays yours."
5. **Premium feel:** Minimal, calm, expensive UI.

---

## 3. Primary User Flows

### 3.1 First-Time Launch

1. Splash/loader with radiating O ))) animation (600–1200ms).
2. Onboarding flow:
   - Step 1: Welcome + motion/audio permission request.
   - Step 2: How sound follows your drive (visual explanation).
   - Step 3: Safety acknowledgement + [Start Drive] entry.
3. Redirect to `/drive` or `/demo` depending on permissions.

### 3.2 Returning Launch

1. Loader restores settings.
2. If onboarding complete, go directly to last-used primary screen (Drive, Sounds, Studio, etc.).
3. If settings corrupted, run validation/recovery and show a fallback banner.

### 3.3 Start Drive

1. User taps [Start Drive] from hero or onboarding.
2. Plays a subtle original startup tone (0.5–1.5s): rising sine harmonics, not a starter motor.
3. Fades the selected sound profile into idle.
4. Transitions to the Drive screen.

### 3.4 Audition / Demo

- Users can preview profiles without leaving the app or needing real vehicle motion.
- Demo mode provides manual sliders for throttle, acceleration, and regen.
- Audition mode uses a motion simulator.

### 3.5 Studio / Garage

- **Studio:** Shape sounds, adjust layers, mix, apply environments, record snippets.
- **Garage:** Manage the collection, organize favorites, playlists, and global snippets.

---

## 4. Feature Catalogue

### 4.1 Audio Engine

- Built on the Web Audio API.
- Synthesizes sound profiles in real time from oscillators, noise generators, and sampled snippets.
- **Hybrid realism path (default):** multi-layer procedural strategies in `src/lib/sound/realism/` composed from reusable DSP primitives (`src/lib/sound/dsp/`). Each profile maps speed, throttle, accel, regen, RPM, gear, jerk and shifts through nonlinear curves with separate FAST/SLOW smoothers.
- **Three technical families** (not one shared engine model):
  - `physical` — cars, boats, ships, aircraft, train, tractor, tracks, hydromechanics: excitation + resonance + mechanical + environment.
  - `designed` — Cyber Pulse, Space Ship, UFO, Neon, hypercar/FE, dragon/beast: mostly procedural signatures.
  - `environmental` — carriages, wind, storm, rain, ocean, zen, horse, playful characters: event sequencing; no combustion RPM.
  - `musical` — arcade, synthwave, deep bass, heartbeat: constrained harmonic/rhythmic response.
- **Built-in catalogue:** 47 Sound Profiles (22 original + 25 expansion). Garage customs remain separate.
- **Turbine Jet:** NASA-style stack (low jet broadband, fan broadband, blade-passing tone + harmonics, HF compressor/turbine, discrete tones). Roar dominates; tones stay embedded.
- **Speed Boat water:** regime-based (displacement → incipient/developed cavitation → planing), not speed→louder.
- **Oide Wiesn Tractor:** Lanz-style hot-bulb (~280–650 RPM), individual two-stroke fires + flywheel inertia; throttle loads stroke before cadence rises.
- **Original path:** legacy harmonic-core + texture/rhythm engine kept for development A/B comparison (`synthesisMode: "original" | "improved"`).
- Supports layered textures: engine/transmission, water, wind, gravel, hooves, rotors, turbo, etc.
- **Master bus:** soft saturation → EQ → compressor → cabin shelves → limiter (max gain 0.85).
- **Drivetrain modes:**
  - `virtual-transmission` — discrete gears with rev-match feel (e.g., GT V8, Racing V10).
  - `continuous` — RPM/speed rise without gear shifts (e.g., Cyber Pulse).
- **Spatialization:** Stereo panning and dynamic reverb based on environment and driving state.
- **Crossfade:** 180ms ramps when switching profiles.
- **Startup signature:** A short rising-tone intro before the profile fades in.
- **Debug harness:** `/debug` (dev-only) with repeatable motion scenarios, Original/Improved A/B, and layer mute/solo.

### 4.2 Sound Profiles

A "Sound Profile" is a complete sound personality selectable by the user. Profiles include categories such as:

| Category            | Examples                                        |
| ------------------- | ----------------------------------------------- |
| Combustion-inspired | GT V8, Racing V10                               |
| Futuristic EV       | Cyber Pulse                                     |
| Cinematic           | Space Ship, UFO                                 |
| Nautical            | Speed Boat, Cruise Ship, Submarine              |
| Motorsport          | Race Car, Rally Car, Drift Car                  |
| Playful             | Farting Car, Laughing Machine                   |
| Historical / Rural  | Wild West Carriage, Romanian '85 Horse Carriage |
| Aircraft            | Helicopter, Private Jet                         |
| Industrial          | Oide Wiesen Tractor                             |
| Nature              | Wind, Rain Road                                 |

Each profile has:

- A base drivetrain mode.
- Layer definitions (engine, texture, atmosphere).
- Per-profile gain, throttle response, acceleration response, regen response.
- Intensity estimate (gentle, moderate, intense) for headroom warnings.
- Curated presets plus user-created custom profiles.

### 4.3 Drive Telemetry

- **Speed (km/h):** Primary display.
- **RPM:** Simulated or derived.
- **Gear:** For virtual-transmission profiles.
- **Throttle, acceleration, regen:** Input to the audio engine and the O ))) animation.
- **Sources:**
  - GPS (geolocation) for speed.
  - DeviceMotion (accelerometer) for acceleration and regen feel.
  - Manual sliders in demo mode.

### 4.4 O ))) Animation

- Living indicator of sound intensity.
- States:
  - Idle: minimal ripple.
  - Low throttle: `O ))`
  - Moderate: `O )))`
  - Strong: `O )))` with larger/faster radiating waves.
- Responds to regen with a subtle negative-direction pulse.
- Respects `prefers-reduced-motion`.

### 4.5 Calibration

- Measures accelerometer noise floor and sensitivity.
- Live test view before saving.
- Tunes how strongly acceleration/regen affect the audio state.

### 4.6 Demo Drive

- Available when sensors are unavailable or the user is not in a vehicle.
- Simulated throttle, acceleration, and regen sliders.
- Lets users preview the full sound behavior safely.

### 4.7 Haptics

- Optional vibration feedback synchronized with throttle and regen intensity.
- Uses the Vibration API.
- Does not change the primary display.
- Respects reduced-motion and device capabilities.

### 4.8 Volume & Headroom

- Master volume control.
- Per-profile gain.
- Real-time loudness headroom meter with warning when switching to an intense profile.
- Limiter prevents clipping.

### 4.9 Studio

- Sound shaping environment:
  - Per-layer mixer: volume, EQ, wet/dry.
  - Environment presets: city street, countryside gravel, rain road, old town.
  - Reverb/spatial controls.
- **Sound Snippet Studio:** Record or upload custom audio snippets (≤700KB) and map them to driving states.
- **AI Prompt-to-Sound:** Natural language sound design (e.g., "warm 60s rally car on gravel").
- **Environment presets:** Automatically rebalance layers based on driving state.
- **A/B comparison:** Toggle between two versions of a profile on Sounds, and Store-as-B / Flip in Studio while simulated speed stays shared.
- Undo/redo history for Studio changes.
- Real-time audio monitor while Listen is active: latency, output latency, processing load, and buffer stalls. No DSP jargon in the UI.
- One-tap **Share link** encodes the current Studio personality (name, base Sound Profile, tweaks, environment, mix; never snippets or motion) into `/share?p=...`. Recipients can Listen immediately and optionally save to their Garage.
- **Trigger rules:** per-profile IF / THEN (speed, throttle, regen, Motion context → layer level, snippet, or environment). Edited in Studio; summarised on Garage cards.
- **Takes:** save multiple labelled variations of one personality (`familyId` + `takeLabel`) without duplicating the whole Garage row.

### 4.10 Garage

- Collection management:
  - Favorites.
  - Curated playlists with optional timed segments (minutes per Sound Profile) for road-trip crossfades.
  - Quick jump between profiles during audition and demo drive.
  - Takes grouped under one personality.
- Global snippet library.
- Import/export settings and profiles.
- Share a saved Studio personality from each Garage card (same `/share` payload as Studio).

### 4.11 Favorites & Playlists

- Mark profiles as favorites.
- Create playlists of profiles.
- Timed playlist mode: Drive advances segments by the trip clock with the normal 180 ms crossfade. Hold / next-prev still win.
- Quick access in Audition, Demo Drive, and Drive screens.
- Favorites used by AI curation.

### 4.11b Smart switching and Motion context

- On-device classifier maps DriveState windows to city / cruise / spirited / regen (no GPS trail).
- Settings mode: Off, Suggest (quiet pill on Drive), or Auto.
- **Hold** on Drive freezes auto and timed playlist advances until cleared or the drive ends.
- Auto rules may use speed band, hour, drive minutes, or Motion context.
- **Match sound to motion:** optional 0–250 ms Motion lookahead for Bluetooth latency (Settings).

### 4.12 Export / Import / Migration

- Export all saved profiles, settings, snippets, and playlists as JSON.
- Import merges cleanly with current setup using versioned backup data (schema v6).
- Backward compatibility handling for older export formats.
- Validation and recovery for corrupted stored settings.

### 4.13 Onboarding

- 3-step flow with clear progress indicator (Step 1/2/3).
- Requests motion/audio permissions.
- Explains how sound follows drive.
- Safety acknowledgement.
- "Skip setup" escape hatch.
- Option to reset onboarding state in Settings.
- Safe fallback to Drive screen if settings fail to load.

### 4.14 Accessibility

- Reduced-motion setting for O ))) animation and onboarding.
- Haptic feedback optional.
- Large, high-contrast monochrome UI.
- Clear labels; avoid technical jargon (oscillator, gain routing) in user-facing UI.
- Preferred terminology: Sound Profile, Drive Mode, Motion.

### 4.15 Privacy & Safety

- Motion/speed data processed locally.
- Minimal navigation (Drive, Sounds, Settings).
- Safety banner before entering Drive.
- Volume ramping and limiter to prevent sudden loudness.
- No vehicle-specific branding (no Tesla/BMW, etc.).
- **Usage insights** (Settings) is off by default. When on, the app may send anonymous feature counts (Garage open, Studio preset save, Listen, calibration complete, share create, audio errors) plus recent crash messages. Never GPS, DriveState, audio buffers, or Sound Profile PCM. An anonymous install id lives in localStorage.
- Unhandled errors and audio-start failures are stored on-device (last 12). Optional host preview crash hooks may still fire when running inside an embedded editor.

### 4.16 Dev/Debug

- Hidden diagnostics panel (dev-only) accessible via a secret gesture or route.
- Shows current audio state, sensor values, settings version, and profile metadata.
- Does not appear in production or is disabled by a flag.

### 4.17 Audio regression

- Vitest harness in `src/lib/sound/regression/` fingerprints a Node-safe core-voice render for key drive states (idle, cruise, throttle, regen) and Studio edits (pitch, grit, darker).
- Seeded RNG (`src/lib/sound/rng.ts`) keeps renders repeatable.
- `npm test` compares against `references.json`. Refresh golden samples with `npm run test:update-audio`.

---

## 5. Audio Architecture

### 5.1 Signal Chain

```
[Sound Source] → [Layer Mixer] → [EQ] → [Reverb] → [Spatial Panning] → [Dynamics Limiter] → [Master Gain] → [Destination]
```

### 5.2 Key Nodes

- **OscillatorBank:** Base engine tones.
- **NoiseEngine:** Pink/white/brown noise textures for water, wind, gravel, etc.
- **RhythmScheduler:** Periodic events (hooves, tractor putt-putt, helicopter rotor chops).
- **Reverb:** Algorithmic reverb with environment-specific parameters.
- **Panner:** Stereo position based on motion state.
- **AnalyserNode:** Real-time loudness metering.
- **Compressor/Limiter:** Soft-knee dynamics control.

### 5.3 Layer Types

Each profile contains a set of layers. Examples:

- `engine` — fundamental tone.
- `transmission` — gear whine/whistle.
- `water` — water spray/hull sound.
- `gravel` — rolling surface texture.
- `hooves` — rhythmic clopping.
- `wind` — aerodynamic noise.
- `rotor` — blade/rotor pulse.
- `snippets` — user-recorded or uploaded samples.

### 5.4 Environments

Environments apply a reverb preset, rebalance layer volumes from driving state, and scale texture/hiss via `textureScale` (0 = mute beds and voice noise):

- **Showroom:** dry, quiet floor; `textureScale: 0` so the core voice is heard without road spray or white-noise beds.
- **Open road:** dry, direct; reduced beds relative to legacy.
- **City street:** short reverb, accents forward, less wind hiss.
- **Countryside gravel:** longer reverb, more gravel and wind (still intentional texture).
- **Rain road:** boosted water/wind layer, damped engine top end.
- **Old town:** narrow, reflective reverb, more echo.

Noise / fidelity notes: `docs/SOUND_NOISE_AND_FIDELITY.md`.

### 5.5 Snippets

- User-recorded via MediaRecorder or uploaded from device.
- Mapped to driving states: idle, low throttle, moderate throttle, strong throttle, regen, high speed, etc.
- Edge-triggered to avoid machine-gunning.
- Max size: 700KB.

### 5.6 AI Sound Design

- User enters a natural language description.
- AI generates a profile recipe: layer list, EQ, drivetrain mode, environment, reverb params.
- Recipe is previewed in Audition before saving.
- AI can also curate playlists based on driving style and favorites.

---

## 6. Data Model

### 6.1 Settings Schema (v4+)

Stored in `localStorage`. Key entities:

```ts
interface ElcamosoSettings {
  version: number; // migration version
  onboardingComplete: boolean;
  lastRoute?: string;
  profileId: string; // selected profile
  volume: number; // 0.0–1.0
  masterGain: number;
  reducedMotion: boolean;
  hapticsEnabled: boolean;
  calibration: {
    accelSensitivity: number;
    regenSensitivity: number;
    noiseFloor: number;
  };
  favorites: string[]; // profile IDs
  playlists: Playlist[];
  environments: EnvironmentState;
  mixerOverrides: Record<string, LayerMixerState>;
  snippets: SnippetLibrary;
  customProfiles: SoundProfile[];
  hiddenDevPanel?: boolean;
}
```

### 6.2 Sound Profile Schema

```ts
interface SoundProfile {
  id: string;
  name: string;
  category: string;
  drivetrainMode: "virtual-transmission" | "continuous";
  basePitch: number;
  layers: SoundLayer[];
  tuning: {
    throttleMultiplier: number;
    responseMultiplier: number;
    regenMultiplier: number;
    gainOffset: number;
  };
  intensity: "gentle" | "moderate" | "intense";
  environmentDefault?: string;
}

interface SoundLayer {
  type: "oscillator" | "noise" | "rhythm" | "snippet";
  name: string;
  volume: number;
  eq: { low: number; mid: number; high: number };
  wet: number; // reverb amount
  pan: number; // -1 to 1
  params: Record<string, number>; // type-specific params
}
```

### 6.3 Migration Rules

- Read `version` on load.
- If version missing or lower than current, run `sanitizeSettings` to repair and merge defaults.
- Imports from older versions are merged rather than overwritten.

---

## 7. Routes & Navigation

Primary navigation is minimal. Main routes:

| Route                  | Purpose                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                    | Landing / hero with [Start Drive]                                                                         |
| `/onboarding`          | 3-step first-time setup                                                                                   |
| `/drive`               | Active driving interface                                                                                  |
| `/demo`                | Pedals + P R N D, guided character tour, no sensors                                                       |
| `/sounds`              | Browse, Find a sound → Listen, audition, select profiles                                                  |
| `/studio`              | Sound shaping, mixer, environments, snippets, AI prompt-to-sound, audio monitor, share link               |
| `/garage`              | Collection, favorites, playlists, snippets, share                                                         |
| `/share`               | Audition a shared Studio personality from a link                                                          |
| `/calibrate`           | Motion sensitivity calibration with live test                                                             |
| `/settings`            | Master volume, per-profile gain, haptics, reduced motion, usage insights, reset onboarding, export/import |
| `/pricing`             | FREE vs Drive+ plans, emotional positioning, Stripe Checkout entry                                        |
| `/upgrade/$token`      | Phone-side Tesla Drive+ checkout (QR destination); auth + Stripe, no card entry in car browser              |
| `/connect/$sessionId`  | Phone pairing relay for in-car display motion                                                               |
| `/about`               | Product about                                                                                             |
| `/legal`               | Legal hub                                                                                                 |
| `/legal/impressum`     | German Impressum (TMG)                                                                                    |
| `/legal/privacy`       | Privacy / Datenschutzerklärung (GDPR + US)                                                                |
| `/legal/cookies`       | Cookie notice + consent reset                                                                             |
| `/legal/terms`         | Terms of use                                                                                              |
| `/legal/accessibility` | Accessibility statement                                                                                   |
| `/debug` (dev-only)    | Diagnostics panel                                                                                         |

Site footer (`SiteFooter`) and cookie consent bar (`CookieConsent`) render from the root layout. Operator details live in `src/lib/legal/operator.ts` (replace PLACEHOLDERs before public DE/EU launch).

Root layout (`__root.tsx`) renders `<Outlet />` and global providers/Toaster. No `_app/index.tsx` or `_authenticated/index.tsx` should duplicate `/`.

---

## 8. UI/UX Conventions

### 8.1 Language

- Use "Sound Profile", "Drive Mode", "Motion".
- Avoid: oscillator, gain routing, LFO, patch, VST, amplitude.
- Replace em-dash (—) with hyphens or colons throughout the app.
- Tone: calm, premium, confident, minimal.

### 8.2 Typography

- Headings: Outfit (geometric sans), wide tracking.
- Body: Outfit or system sans.
- Wordmark: `E L C A M O S O` spaced with wide tracking.

### 8.3 Color

- Background: #000000 / #0A0A0A.
- Surface: #121212, #1A1A1A.
- Foreground: #F5F5F7.
- Muted: #8A8A8A.
- Accent: extremely restrained; use white or subtle opacity shifts.
- Error: soft red only when necessary.

### 8.4 Motion

- Loader: O ))) radiates outward on load.
- Drive indicator: subtle, never frantic.
- Respect `prefers-reduced-motion` and the user's reduced-motion setting.

### 8.5 Mobile-First

- Portrait orientation priority.
- Large touch targets.
- Bottom sheets for selectors and mixers.
- Swipeable cards for profile browsing.
- Persistent mini-player could be added for quick control.

---

## 9. Technical Stack

- **Framework:** TanStack Start v1 (React 19, Vite 7).
- **Routing:** `@tanstack/react-router`. No `react-router-dom`.
- **Styling:** Tailwind CSS v4 with native CSS `@theme` variables in `src/styles.css`.
- **State:** localStorage settings (schema v6) plus a Drive session singleton (`src/lib/drive/session.ts`) that owns the single `AudioContext`. UI reads snapshots via `useSyncExternalStore`. Switching Sound Profile while Listen / Demo / Drive is already live crossfades on the existing engine (`listenProfile`); do not stack a second `AudioContext`. Snapshot includes `motion` (`MotionEnergy` UI layer), `productStatus`, and `safetyMode` (above ~5 km/h on Drive/Demo).
- **Audio:** Web Audio API. Cabin EQ after layer mix; intensity-band gain ceiling on top of the limiter; idle fade-then-suspend; call ducking on `AudioContext` interrupt. Optional Motion lookahead for Bluetooth.
- **Chrome:** Mobile bottom nav Drive / Sounds / Studio / Garage; Demo and Settings via menu. Hide BrandNav, bottom nav, and MiniPlayer during Drive safety mode.
- Motion: multi-source fusion in `src/lib/motion/sensor-fusion.ts` (GPS, DeviceMotion, phone relay, vehicle telemetry). Delta GPS speed when `GeolocationCoordinates.speed` is null (`src/lib/drive/gps-speed.ts`). Drive context classifier is on-device (`src/lib/drive/context.ts`). Dynamic Drive adds `PowertrainSimulator` + `DynamicDriveSynth` when `settings.dynamicDrive` is on. Demo motion: `src/lib/drive/demo-physics.ts`. Architecture guide: `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`. Drive traces live in IndexedDB, not the service worker cache.
- **i18n:** EN / DE / RO dictionaries in `src/lib/i18n`, plus metric/imperial units.
- **Auth / Cloud:** Opt-in **ELCAMOSO Cloud** via thin `createServerFn` wrappers in `src/lib/cloud/server-fns.ts`. Keys stay on the server. User-facing name is ELCAMOSO Cloud, never Supabase.
- **Telemetry:** Opt-in usage insights and on-device crash log. Ingest via `ingestTelemetryFn`. Share codes via `createShareFn` / `loadShareFn` (payload URLs are the durable share path).
- **Tests:** Vitest (`npm test`). Audio regression lives under `src/lib/sound/regression/`.
- **PWA:** `public/manifest.webmanifest` plus `public/sw.js` (shell precache). Drive traces are not cached by the worker.

---

## 10. Implementation Rules

- Every `createServerFn` file must be a thin wrapper; runtime helpers go in imported modules or inside handlers.
- Do not import `*.server.ts` files from client components.
- Read `process.env` only inside server-function handlers.
- Protected server functions must be called from components via `useServerFn`, not from public loaders.
- Do not use Node-only packages in server functions (child_process, sharp, canvas, puppeteer, fs.watch).
- Do not set `ssr.external` in `vite.config.ts`.
- Keep all CSS `@import` rules at the top of `src/styles.css`.
- Head metadata: every content route gets its own `head()` with unique title, description, og:title, og:description, og:type, twitter:card.

---

## 11. Quality Checklist for New Features

Before considering a feature complete, verify:

- [ ] It works in portrait mobile viewport.
- [ ] It respects reduced-motion settings.
- [ ] It does not introduce sudden audio spikes (use crossfade/limiter).
- [ ] It does not require forbidden brand motifs.
- [ ] It uses approved terminology.
- [ ] It does not break existing navigation or onboarding flow.
- [ ] Settings are saved/restored correctly with version migration.
- [ ] Build passes and there are no runtime errors in the preview.

---

## 12. Open Opportunities / Roadmap

Shipped on the current app (session spine first):

1. Multi-source sensor fusion (GPS + DeviceMotion + phone relay + optional Tesla Fleet Telemetry). Architecture: `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`, Tesla onboarding: `docs/dynamic-drive/tesla-telemetry.md`.
2. Shared Drive sessions (Tesla display ↔ phone relay WebSocket).
3. Virtual powertrain (`PowertrainSimulator`) and Dynamic Drive synth when enabled.
4. Media Session; screen wake lock for live Drive (re-acquired on resume); Drive visibility hide grace (~2.8 s) before idle suspend; call ducking.
5. IndexedDB drive traces, replay, and 15 s render-to-audio clips.
6. Auto Sound Profile rules (speed band, hour, drive minutes).
7. Virtual-transmission gear-shift feel (legacy path) plus Dynamic Drive shift transients (scheduler: probability, cooldown, variant pools, aspiration gates — see `docs/dynamic-drive-transients.md`).
8. Persistent mini-player, Sounds search/cards/A/B/packs, Studio undo and presets.
9. EN/DE/RO, units, settings search, restore recommended, a11y focus and 44 px sliders.
10. Opt-in ELCAMOSO Cloud sync, prompt-to-sound recipes, and aggregate-only drive coach (confirm before switching while driving).
11. Audio regression harness, Studio latency/load monitor, opt-in usage insights, and one-tap Studio share links.
12. Motion context classifier, Suggest / Auto / Hold switching, per-profile trigger rules, timed playlists, Studio A/B, takes, and Bluetooth Motion lookahead.

Further polish (Phase 2+):

- Richer drive summaries, 30–60 s mastering WAV, hearing balance, /motion visualizer, passenger loudness lock.
- Push-to-talk voice, structured coach apply, day/night palettes, curated packs, opt-in familiar-route dim.
- Richer conflict resolution than last-write-wins for cloud fields.
- Stronger iOS background audio if Apple exposes it to PWAs.
- Optional inclusion of drive history in cloud, still never sent raw to the model unless the user enables it.

Parked (not PWA-native yet): Group Drive / WebRTC, wearables, live sound map, OBD-II, lock-screen widgets, marketplace, hardware puck.

---

## 13. AI Code Assistant Context

When editing this codebase, remember:

- **The app is a real-time audio synthesis app for EVs.** Every change must consider latency, audio graph lifecycle, and mobile performance.
- **Monochrome premium UI.** Do not add bright colors, gradients, or dashboard clutter unless explicitly requested.
- **Mobile-first.** Test in a narrow viewport.
- **Sound is the hero.** Visuals should support the sound, not distract from it.
- **Safety first.** Audio changes must ramp and limit. Motion permission flows must be clear and respectful.
- **Privacy.** Do not send telemetry or motion data to external services unless the user enables Usage insights. Motion and audio buffers stay on-device.
- **No Supabase references in user-facing copy.** If cloud is enabled, refer to it as ELCAMOSO Cloud.

---

_Last updated: 2026-08-20 (Motion context, trigger rules, timed playlists, Studio A/B, takes, latency match)_
