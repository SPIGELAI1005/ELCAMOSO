# Dynamic Drive — Architecture Audit

**Date:** 2026-08-29  
**Status:** Historical baseline. **Canonical reference:** `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`  
**Scope:** Read-only audit from pre-rollout planning. Production behavior documented in the architecture guide.

**Related:** `docs/TESLA_BROWSER_SMOKE_TEST.md`, `docs/drive-relay-sessions.md`.

---

## How to read this document

ELCAMOSO has **two layers**:

| Layer | What it means |
|-------|----------------|
| **Production default** | What most users get today: `dynamicDrive: false`, browser GPS/IMU, legacy `computeDriveState`, **ImprovedSynth** audio |
| **Codebase capability** | Additive modules already present behind flags and cockpit routes — **not the default path** |

This audit describes **both**, then recommends the **smallest-risk way to enable** phone sessions, fusion, virtual powertrain, dynamic sound, and Fleet Telemetry **without rewriting** the working Drive spine.

---

## 1. Drive page

**Route:** `src/routes/drive.tsx`  
**Hook:** `useDriveSession({ demoMotion })` → `getSession().startDrive()` / `stop()`  
**Settings sync:** `SessionBridge` (not the hook) pushes profile, volume, tuning, **`dynamicDrive`**, telemetry flag into the session.

### Production flow (default)

1. **Idle** — profile name, O ))) mark, Start Drive, safety/intense modals on first use.
2. **Starting** — `BrandLoader`.
3. **Driving** — speed readout, O ))) intensity (`motion-energy.ts`), optional secondary RPM/gear text for virtual-transmission profiles, product status label, Stop.
4. **Safety mode** — above ~5 km/h (`isDrivingSafetySpeed`): minimal chrome, nav hidden.

### Cockpit mode (`?cockpit=1`)

- `DriveSessionPanel` — QR + 6-digit code for phone pairing; collapses when linked.
- `DynamicDriveInstrument` — gear hero, rev arc (only when `dynamicDrive && supportsDynamicDrive(profile)`).
- `DrivePipelineMetrics` / `DriveDiagnosticsPanel` — only when Drive debug enabled.

### Data sources (UI)

| Element | Source |
|---------|--------|
| Speed | `DriveState.speed` → `formatSpeed` |
| O ))) intensity | `MotionState.motionEnergy` |
| RPM / gear (text) | `driveSecondaryReadout()` when `drivetrainMode === "virtual-transmission"` |
| Product status | `driveProductLabel(DriveProductStatus)` — Sound Active, GPS Only, Weak Signal, Vehicle linked, etc. |
| Pairing | `DriveSessionPanel` + relay client state |

### Gaps vs target UX

- No persistent “Drive Signal” 3-dot tier on default Drive (labels exist in `drive-connection.ts`; cockpit uses them sparingly).
- Full virtual powertrain UI only when **Motion-matched sound** is on and profile supports it.

---

## 2. Audio system

**Orchestrator:** `src/lib/sound/engine.ts` (`SoundEngine`, ~1,800 lines)  
**Session wiring:** `DriveSession.tickAudio()` → `engine.update(state)` each RAF tick.

### Production path (default)

```
DriveSession.loop (rAF ~60 Hz)
  → tickSensorFusion → computeDriveState (legacy)
  → SoundEngine.update(state)
      → ImprovedSynth → profile strategy (strategies.ts / strategies-extra.ts)
      → body / accents / beds → environment reverb → master bus → limiter
```

- **Synthesis mode:** `"improved"` (session never sets `"original"` except `/debug`).
- **Dynamic Drive synth:** **not used** when `dynamicDrive: false` (default).

### Alternate paths (flag / debug gated)

| Path | Gate | Module |
|------|------|--------|
| **Dynamic Drive** | `dynamicDrive && supportsDynamicDrive(profile)` | `src/lib/sound/dynamic-drive/synth.ts` |
| **Original** | `/debug` A/B | Inline oscillators in `engine.ts` |

### Bus structure (shared)

- Per-profile **StrategyBuses:** `body`, `accents`, `beds`.
- **Environment** reverb send (`environments.ts`).
- **Master bus:** saturation → EQ → compressor → cabin shelves → **limiter (max 0.85)**.
- **Profile crossfade ~180 ms**; `listenProfile()` swaps in-place (Tesla crash guard).
- **Snippets**, auto-rules, profile rules mutate mix/environment during drive.

### Reuse vs refactor (audio)

| Module | Verdict |
|--------|---------|
| `SoundEngine` lifecycle (start/stop/suspend/crossfade/listenProfile) | **Reuse** — do not fork |
| Master bus, limiter, cabin EQ, ducking | **Reuse** |
| `ImprovedSynth` + strategy registry | **Reuse** — default production path |
| `DynamicDriveSynth` | **Reuse when enabling** — already built; add sample loader later |
| Monolithic `engine.update` | **Do not refactor** — extend via backend selection |
| Original oscillator path | **Keep** — Legacy / debug only |

---

## 3. Web Audio implementation

### Nodes in use

`AudioContext`, `GainNode`, `OscillatorNode`, `BiquadFilterNode`, `DynamicsCompressorNode`, `ConvolverNode`, `AnalyserNode`, `StereoPannerNode`, `AudioBufferSourceNode` (noise buffers, snippets).

### Pitch / RPM coupling (production default)

**Virtual-transmission (Improved path):**

- `motionFromDrive()` derives `engineFundamentalHz`, `shiftDip`, dual-smoothed throttle/accel.
- Layers receive `MotionFrame`; gear change reduces gain via **shiftDip** — not discrete shift one-shots.

**Legacy inline model (`computeDriveState`):**

```ts
targetRpm = idle + kmh × ratio[gear-1] + throttle × 900
```

Gear picked by highest ratio keeping RPM < 85% redline — **instant**, no hysteresis, no shift progress.

### Dynamic Drive path (when enabled)

- Six RPM **harmonic bands** crossfaded by normalized RPM + load (`layer-weights.ts`).
- Eight **transient** noise layers scheduled with cooldowns (`transient-scheduler.ts`).
- Requires `DriveState.powertrain` (`VirtualPowertrainState`).

### Smoothing

`src/lib/sound/dsp/smoother.ts` — `smoothToward`, `targetParam`, `rampParam` (τ ~0.05–0.55 s).

### Background / interrupt

- `SessionBridge`: silent looping `<audio>` to reduce suspension.
- Visibility: **2.8 s hide grace** (`DRIVE_HIDE_GRACE_MS`) then fade/suspend; `pagehide` suspends immediately.
- Media Session API for in-car controls.

### Reuse vs refactor (Web Audio)

| Module | Verdict |
|--------|---------|
| `smoother.ts`, `master-bus.ts` | **Reuse** |
| `motion.ts` / `MotionFrame` | **Extend** — already feeds ImprovedSynth; maps powertrain when Dynamic on |
| `layers.ts` factory pattern | **Reuse** for non-Dynamic profiles |
| Single-loop playbackRate as primary RPM model | **Bypass** when Dynamic Drive enabled — bands already implemented |

---

## 4. Current speed / GPS input

### Production pipeline (display / Tesla tab)

```
navigator.geolocation.watchPosition
  → resolveGpsSpeed (reported | delta | none)
  → browserGpsMotionSample → pushMotionSample
  → tickSensorFusion
  → session.speed, acceleration
  → computeDriveState (when dynamicDrive off)
```

**GPS:** `src/lib/drive/gps-speed.ts`

- Prefer `coords.speed`; else haversine delta (dt 0.35–6 s, accuracy ≤ 45 m).
- Clamp max **70 m/s**.
- **`none` source:** fusion keeps last good speed (Tesla null-speed fix).

**IMU:** `session.attachSensors()` — `devicemotion`, primarily **`accelerationIncludingGravity.y`**.

- iOS: best-effort `DeviceMotionEvent.requestPermission()`.
- Options: `{ enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }`.

**Fusion:** `src/lib/motion/sensor-fusion.ts` (replaces older two-source `drive/fusion` concept).

- Multi-source priority, hold/decay, confidence, inferred throttle.
- **Always runs** in Drive loop; output drives legacy or powertrain path depending on flag.

### Phone path (optional, separate tab)

- Route: `/connect/{sessionId}` — `usePhoneSensorClient` ~**15 Hz**.
- WebSocket relay → `session.ingestPhoneRelayMotion()` → fusion source **`phone`**.
- Payload: **no lat/lon** on wire (`relay-sample.ts`).

### Demo / bypass

- `/demo`: synthetic physics, no GPS.
- `settings.demoMotion`: skips `attachSensors()`.

### Reuse vs refactor (inputs)

| Module | Verdict |
|--------|---------|
| `gps-speed.ts` | **Reuse verbatim** |
| `sensor-fusion.ts` | **Reuse** — already multi-source; extend for telemetry priority |
| `session.attachSensors` / `ingestGpsPosition` | **Reuse** — extract to provider interface only if testing demands it |
| Single-axis display IMU | **Extend** on phone client — orientation/mount calibration still partial |

---

## 5. State management

### Layers

| Layer | Mechanism | Rate |
|-------|-----------|------|
| **Drive runtime** | Singleton `DriveSession` | rAF ~60 Hz |
| **React UI** | `useSyncExternalStore` + fingerprint dedupe | ~**80 ms** throttle |
| **Settings** | `useSettings` + `localStorage` + `sanitizeSettings` | On write |
| **Config → session** | `SessionBridge.syncConfig()` content fingerprint | On settings change |

### Key types

- **`DriveState`** (`model.ts`) — speed, accel, throttle, regen, rpm, gear, load, jerk, isShifting; optional **`powertrain`** overlay.
- **`VehicleMotionState`** (`motion/types.ts`) — fusion output.
- **`VirtualPowertrainState`** (`powertrain/types.ts`) — simulator output when Dynamic Drive on.
- **`SessionSnapshot`** — throttled UI: kind, status, state, motion, perf, product status, etc.

### TanStack Query

Initialized in router; **not** used for drive loop or realtime motion.

### Reuse vs refactor (state)

| Module | Verdict |
|--------|---------|
| `DriveSession` singleton + rAF loop | **Reuse** — inject steps, do not split without milestone |
| `session-store.ts` 80 ms throttle | **Reuse** |
| `SessionBridge` fingerprint sync | **Reuse** |
| `DriveState` shape | **Reuse** as audio + UI contract |
| High-frequency state in React | **Avoid** — current pattern is correct |

---

## 6. Sound profile schema

**Sources:** `src/lib/sound/profiles.ts` + `profiles-expansion.ts` — **47 built-in** profiles.

```ts
interface SoundProfile {
  id, name, category, traits, description;
  drivetrainMode: "virtual-transmission" | "continuous";
  drivetrainPersonalityId?: string;   // 8 personalities
  motionModel?: "virtual-transmission" | "continuous" | "cadence" | ...
  sourceMode?: "procedural" | "sample" | "hybrid";
  voice: ProfileVoice;
  transmission?: { gearRatios, idleRpm, redlineRpm, shiftSmoothing };
  // Garage: custom, baseId, environmentId, mix, rules...
}
```

**Personalities** (transmission + shift + overrun + transients): `src/lib/drive/drivetrain-personalities.ts` — flat-six-sport, american-v8, turbo-inline-6, gt-v8, synthetic-ev, motorcycle-inline-4, v-twin-cruiser, single-cylinder-ag.

**Per-profile tuning (settings):** `ProfileTuning`, global `ShiftFeel`, layer mix, snippets, auto-rules.

### Gaps vs sample-based DynamicSoundProfile spec

- No `soundLayers` / `transients` WAV URLs in profile JSON.
- Transients are **procedural** with personality variant IDs (sample filenames documented in `docs/audio-asset-requirements.md`).

### Reuse vs refactor (profiles)

| Module | Verdict |
|--------|---------|
| Catalogue, categories, Garage customs | **Reuse** |
| `drivetrainPersonalityId` + personality registry | **Reuse** — source of truth for virtual transmission |
| `SoundProfile` type | **Extend** with optional asset fields — no breaking change |
| Hard-coded strategy maps | **Extend** — do not rewrite |

---

## 7. Backend

### What exists

- **TanStack Start** + **Nitro** on **Vercel** (`vite.config.ts` preset `vercel`).
- **No database** — server state in **in-memory `Map`** stores.

| Store | File | Contents |
|-------|------|----------|
| Cloud sync | `cloud/store.ts` | Settings partials by `accountId` |
| Drive relay | `drive-relay/store.ts` | Ephemeral sessions, peers, TTL 30 min |
| Telemetry ingest | `telemetry/store.ts` | ~80 analytics batch ring buffer |
| Share codes | `telemetry/store.ts` | Studio personality by 6-char code |
| Tesla link tokens | `tesla/link-store.ts` | Encrypted refresh tokens (in-memory) |

**Server restart wipes** ephemeral server state (relay sessions, tokens, cloud docs).

### Reuse vs refactor (backend)

| Module | Verdict |
|--------|---------|
| `createServerFn` pattern | **Reuse** for any new REST endpoints |
| In-memory relay store | **Reuse for dev/staging** — **extend** with Redis/KV before production scale |
| `cloud/store.ts` | **Do not use** for drive relay motion |
| `server.ts` error wrapper | **Reuse** |

---

## 8. APIs

### Server functions

| Module | Key functions |
|--------|----------------|
| `cloud/server-fns.ts` | sync/load garage, findSound, promptToSound, driveCoach, ingestTelemetry, share |
| `drive-relay/server-fns.ts` | create/join/get relay session |
| `tesla/server-fns.ts` | OAuth start/callback, link status |
| `tesla/telemetry-ingest.ts` | Forward Fleet records to display session |

### External

- **OpenAI** (optional, server-only): find-sound, Studio, coach.
- **Tesla Fleet OAuth + API** (optional, server-only).
- **Browser geolocation / DeviceMotion only** for motion — no third-party geo API.

### Reuse vs refactor (APIs)

| Module | Verdict |
|--------|---------|
| `ingestTelemetryFn` | **Extend** — add drive/relay event names |
| Relay server fns | **Reuse** |
| New endpoints for motion | **Avoid** — use WebSocket relay, not REST polling |

---

## 9. WebSocket / realtime capabilities

### Current state: **implemented**

| Piece | Path |
|-------|------|
| WebSocket endpoint | `/api/drive-relay/ws` via `crossws` + `drive-relay/ws-node.ts` |
| Dev plugin | `drive-relay/vite-ws-plugin.ts` |
| Protocol | `drive-relay/protocol.ts` — motion, heartbeat, remote control, latency |
| Client hook | `drive-relay/client.ts` — `useDriveRelay` |
| Session store | `drive-relay/store.ts` — TTL, pairing code, join secret, peer attach |
| Rate limits | Motion ~22/s, telemetry ~12/s (`hub.ts`) |

**Roles:** `display` (Tesla), `phone` (sensor), `telemetry` (Fleet bridge).

**Production when unpaired:** relay idle — **zero WS traffic** unless user opens pairing UI.

### Reuse vs refactor (realtime)

| Module | Verdict |
|--------|---------|
| Entire `drive-relay/` package | **Reuse** — validate Tesla WS in smoke test only |
| SSE fallback | **Add only if** smoke test proves WS blocked — not default |
| Raw sensor persistence | **Do not add** |

---

## 10. Authentication

**No user accounts** for Drive.

| Mechanism | Purpose |
|-----------|---------|
| Relay pairing | 6-digit code + `joinSecret` in QR (`/connect/{id}?token=…`) |
| Anonymous cloud | Client `cloudAccountId` (`local-{timestamp}`) |
| Analytics | `elcamoso.installId` in localStorage |
| Tesla Fleet | OAuth (server-side tokens, AES-256-GCM) |
| CSRF | `createCsrfMiddleware` on server functions (`start.ts`) |

### Reuse vs refactor (auth)

| Module | Verdict |
|--------|---------|
| Anonymous session philosophy | **Reuse** |
| Join secret + TTL | **Reuse** — optional one-time tokens later |
| User login for pairing | **Not required** for v1 |

---

## 11. Tesla browser accommodations

Documented: `docs/TESLA_BROWSER_SMOKE_TEST.md`. **No Tesla UA sniffing.**

| Concern | Implementation |
|---------|----------------|
| Null `coords.speed` | Delta haversine in `gps-speed.ts` |
| GPS lag / drops | Fusion hold/decay; skip `"none"` fixes |
| Tab hide | 2.8 s grace before audio suspend |
| Profile switch crash | In-place `listenProfile` + tests |
| Safety UX | Nav hidden > ~5 km/h |
| Background audio | Silent loop + Media Session |
| Service worker | Prod only; dev unregistered |
| WebSocket relay | Supported; phone recommended for Enhanced motion |

**Audio authority:** display tab plays sound; phone tab is sensor-only by product design.

### Reuse vs refactor (Tesla)

| Module | Verdict |
|--------|---------|
| GPS delta, suspend grace, wake lock, listenProfile | **Reuse** — critical; do not regress |
| Tesla-specific code branches | **Avoid** unless smoke test proves divergence |
| Cockpit pairing UX | **Reuse** `DriveSessionPanel` |

---

## 12. Mobile browser accommodations

| Concern | Implementation |
|---------|----------------|
| Mobile-first layout | Tailwind portrait, bottom nav |
| iOS motion permission | Onboarding, calibrate, `/connect` |
| Phone sensor app | **`/connect/{sessionId}`** — minimal UI |
| Haptics | Optional `useHaptics` |
| Reduced motion | `useReducedMotion` |
| PWA install | `InstallPrompt` |
| Calibration | `/calibrate` — sensitivity + noise floor |

**Gap:** full mount-orientation calibration on phone vs spec.

### Reuse vs refactor (mobile)

| Module | Verdict |
|--------|---------|
| `/calibrate` patterns | **Reuse** on connect flow |
| `/connect` route | **Reuse** — extend calibration copy only |
| Full app on phone for Drive audio | **Avoid** — keep sensor role |

---

## 13. PWA / service worker

| Asset | Role |
|-------|------|
| `public/manifest.webmanifest` | Standalone, black theme |
| `public/sw.js` | Shell cache `elcamoso-shell-v6` |
| `SessionBridge` | Registers SW **production only**; unregisters in dev |

**SW:** network-first HTML; cache-first static shell. Skips Vite dev paths.

**Risk:** stale bundles after deploy — mitigated by network-first HTML.

### Reuse vs refactor (PWA)

| Module | Verdict |
|--------|---------|
| SW + manifest | **Reuse unchanged** |
| Dev SW disable | **Keep** — required for HMR stability |

---

## 14. Deployment

| Item | Detail |
|------|--------|
| Host | **Vercel** |
| Build | `npm run build` → `.vercel/output/` |
| Config | `vercel.json` — `framework: "tanstack-start"` |
| SSR | `src/server.ts` |
| Local dev | Port **5173**, WS plugin for relay |
| Env | `.env.example` — OpenAI, Tesla OAuth, encryption key |

### Reuse vs refactor (deploy)

| Module | Verdict |
|--------|---------|
| TanStack Start + Vercel | **Reuse** |
| WS on Vercel | **Validate** in preview — architecture assumes it works |
| Persistent relay | **Extend** infra when leaving in-memory store |

---

## 15. Persistence

### Client

| Store | Key | Contents | Motion/GPS? |
|-------|-----|----------|-------------|
| localStorage | settings blob | `ElcamosoSettings` | No |
| localStorage | `elcamoso.installId` | Anonymous id | No |
| localStorage | `elcamoso.telemetry.queue` | Analytics (opt-in) | No |
| localStorage | `elcamoso.crashes` | Truncated errors | No |
| IndexedDB | `elcamoso-traces` | DriveState samples, aggregates | **No lat/lon** |

Settings migration: **`sanitizeSettings`** in `settings.ts`.

### Server

In-memory only (see Backend). Relay sessions lost on deploy/restart.

### Reuse vs refactor (persistence)

| Module | Verdict |
|--------|---------|
| Settings + sanitize | **Reuse** |
| Trace recorder | **Reuse** — never log raw phone streams |
| Relay session store | **Extend** to Redis/KV for production durability |

---

## 16. Analytics

**Client:** `src/lib/telemetry/analytics.ts`  
**Gate:** `settings.analyticsEnabled` (default **false**)

**Events today:** `garage_open`, `studio_listen`, `studio_preset_save`, `share_create`, `calibrate_complete`, `audio_error`.

**Pipeline:** `trackEvent` → custom event → `TelemetryBridge` queue → flush 20 s → `ingestTelemetryFn`.

**No GPS, DriveState, or location** in payloads.

### Gaps

No events for: drive session start, phone paired/disconnected, dynamic drive enabled, shift count, relay latency tier.

### Reuse vs refactor (analytics)

| Module | Verdict |
|--------|---------|
| `trackEvent` + opt-in queue | **Reuse** |
| `ingestTelemetryFn` | **Extend** event name union |
| Location in analytics | **Do not add** |

---

## Recommended smallest-risk architecture

**Principle:** Additive modules behind flags; **Legacy default untouched** until explicitly enabled and validated.

```text
                    ┌─────────────────────────────────────┐
                    │  settings.dynamicDrive (default off) │
                    │  settings.teslaFleetTelemetry        │
                    └─────────────────────────────────────┘
                                      │
┌──────────── PRODUCTION DEFAULT ─────────────────────────────┐
│ Browser GPS/IMU → tickSensorFusion → computeDriveState     │
│ SoundEngine → ImprovedSynth                                  │
└─────────────────────────────────────────────────────────────┘
                                      │
┌──────────── WHEN dynamicDrive ON ───────────────────────────┐
│ Browser + phone WS + telemetry → tickSensorFusion            │
│ PowertrainSimulator → driveStateFromPowertrain               │
│ SoundEngine → DynamicDriveSynth (fallback ImprovedSynth)     │
└─────────────────────────────────────────────────────────────┘
```

**Do not:** wire GPS directly to audio; add second AudioContext; block v1 on Fleet API; persist raw sensor traces.

---

## Adding each capability — smallest-risk plan

### Phone ↔ Tesla shared sessions

| Status | **Implemented** — `drive-relay/` + `DriveSessionPanel` + `/connect/$sessionId` |
|--------|---|
| **Reuse** | `store.ts`, `protocol.ts`, `client.ts`, `server-fns.ts`, QR + pairing code UX |
| **Refactor** | None required for v1 |
| **Extend** | Redis/KV session store for deploy survival; explicit `audioRole` in types (policy today is implicit) |

### Phone sensors

| Status | **Implemented** — `phone-sensor-client.ts`, relay motion @ ~15 Hz, no coords on wire |
|--------|---|
| **Reuse** | `/connect` route, permission patterns from onboarding/calibrate, `PhoneSensorStatus` |
| **Refactor** | None |
| **Extend** | Mount-orientation / longitudinal accel projection; richer calibration copy |

### Sensor fusion

| Status | **Implemented** — `sensor-fusion.ts` always runs in Drive loop |
|--------|---|
| **Reuse** | Priority stack (telemetry → phone → browser → hold → decay), `sensor-fusion-correction.ts`, `motion-fallback.ts`, reconnect blend |
| **Refactor** | **Do not** replace — extend sources only |
| **Extend** | Tune confidence thresholds from Tesla field data |

### Virtual RPM / gears

| Status | **Implemented** — `PowertrainSimulator` when `dynamicDrive && supportsDynamicDrive` |
|--------|---|
| **Reuse** | `simulator.ts`, `shift-controller.ts`, `rpm-model.ts`, `drivetrain-personalities.ts`, `driveStateFromPowertrain` adapter |
| **Refactor** | **Do not extend** `computeDriveState` gear logic — keep as Legacy |
| **Extend** | Per-profile tuning from field tests; default rollout plan only after smoke pass |

### Dynamic sound

| Status | **Implemented (procedural)** — `DynamicDriveSynth` + transient scheduler |
|--------|---|
| **Reuse** | `SoundEngine` backend switch, master bus, smoother, personality variant pools |
| **Refactor** | **Do not** merge into ImprovedSynth — parallel backend is correct |
| **Extend** | Optional WAV loader with procedural fallback (`audio-asset-requirements.md`) |

### Future Tesla Fleet Telemetry

| Status | **Adapter stub** — OAuth, ingest, `map-tesla-signals.ts`, relay `telemetry` role |
|--------|---|
| **Reuse** | `VehicleTelemetryProvider` interface, fusion ingress as `vehicle-telemetry` source |
| **Refactor** | None |
| **Extend** | Server-side polling/bridge; enable `teslaFleetTelemetry` flag after validation |
| **Do not** | Fake telemetry in browser; bypass fusion |

---

## Module reuse vs refactor matrix (summary)

| Module | Action | Risk if wrong |
|--------|--------|---------------|
| `session.ts` rAF loop | **Reuse** orchestrator | High — Tesla stability |
| `sensor-fusion.ts` | **Reuse / extend** | Medium |
| `gps-speed.ts` | **Reuse verbatim** | Low |
| `computeDriveState` | **Keep Legacy** — bypass when Dynamic on | Medium |
| `PowertrainSimulator` | **Reuse** when enabling | Low |
| `SoundEngine` shell | **Reuse** | High |
| `ImprovedSynth` | **Reuse** as default | Medium |
| `DynamicDriveSynth` | **Reuse** when enabling | Medium |
| `drive-relay/*` | **Reuse** | Medium — validate WS in-car |
| `profiles.ts` + personalities | **Extend** | Low |
| `settings.ts` | **Extend** flags | Low |
| `drive.tsx` + cockpit components | **Reuse** | Low |
| `cloud/store.ts` for relay | **Do not use** | — |
| Monolithic engine refactor | **Avoid** | High |
| Auth for pairing | **Not needed** | — |

---

## Suggested enablement order (no code in this audit)

1. **Validate** Tesla smoke test with `dynamicDrive: true` on virtual-transmission profiles.
2. **Extend** analytics (session/pairing/shifts) — no behavior change.
3. **Harden** relay store (Redis/KV) before marketing phone pairing.
4. **Add** sample loader + P1 assets (procedural fallback remains).
5. **Phone orientation** calibration on `/connect`.
6. **Fleet telemetry** Precision tier — optional, server-dependent.
7. **Gradual default** — flip `dynamicDrive` default or auto-enable per profile class after gates pass.

**Gate each step:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, Legacy `/drive` with `dynamicDrive: false` unchanged.

---

## Key file index

| Area | Path |
|------|------|
| Drive UI | `src/routes/drive.tsx`, `DynamicDriveInstrument.tsx`, `DriveSessionPanel.tsx` |
| Session | `src/lib/drive/session.ts` |
| Legacy drivetrain | `src/lib/drive/model.ts` (`computeDriveState`) |
| Fusion | `src/lib/motion/sensor-fusion.ts` |
| Powertrain | `src/lib/powertrain/simulator.ts` |
| Personalities | `src/lib/drive/drivetrain-personalities.ts` |
| Dynamic audio | `src/lib/sound/dynamic-drive/synth.ts` |
| Engine | `src/lib/sound/engine.ts` |
| Improved audio | `src/lib/sound/realism/improved-synth.ts` |
| Profiles | `src/lib/sound/profiles.ts` |
| Relay | `src/lib/drive-relay/` |
| Settings | `src/lib/drive/settings.ts` |
| Tesla | `src/lib/tesla/`, `src/lib/motion/vehicle-telemetry/` |
| PWA | `public/sw.js`, `SessionBridge.tsx` |
| Analytics | `src/lib/telemetry/analytics.ts` |

---

_Architecture audit complete. Production behavior unchanged._
