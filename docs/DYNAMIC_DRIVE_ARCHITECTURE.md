# Dynamic Drive — Architecture Guide

**Audience:** engineers onboarding to ELCAMOSO motion, relay, powertrain, and audio.  
**Last updated:** 2026-08-29

This is the **canonical** reference for the Dynamic Drive pipeline. For field validation in Tesla browser, see `docs/TESLA_BROWSER_SMOKE_TEST.md`. For performance constraints, see `docs/TESLA_BROWSER_PERFORMANCE_AUDIT.md`. Historical planning notes: `docs/dynamic-drive-audit.md`.

---

## New engineer walkthrough

Read this section top to bottom once. Each step names the module you open in the repo.

### 1. Phone → relay

A phone tab at `/connect/{sessionId}` is a **sensor relay only** — it never runs the audio engine.

```
Phone tab
  usePhoneSensorClient  (~15 Hz GPS + IMU)
       │
       ▼
  toRelayMotionPayload  (strips lat/lng)
       │
       ▼
  useDriveRelay(role: phone)  →  WebSocket  →  server hub
```

| File | Role |
| ---- | ---- |
| `src/routes/connect.$sessionId.tsx` | Phone UI, pairing code, remote controls |
| `src/lib/motion/phone-sensor-client.ts` | GPS watch, DeviceMotion, ~15 Hz tick |
| `src/lib/drive/gps-speed.ts` | Reported speed or haversine delta |
| `src/lib/drive-relay/client.ts` | One WebSocket per tab; heartbeat, reconnect |
| `src/lib/drive-relay/hub.ts` | In-memory relay; rate limits 22 motion/s |

**Rule:** one WebSocket per role per tab. Never open a second relay client on the Tesla display.

### 2. Session → RAF spine

Everything live runs in a **singleton** `DriveSession` (`getSession()`). React never owns the simulation loop.

```
getSession().startDrive()
       │
       ▼
requestAnimationFrame loop (~60 Hz)
  ├── tickSensorFusion()        (drive mode)
  ├── computeNextDriveState()   (legacy OR PowertrainSimulator)
  ├── SoundEngine.update()
  └── tryEmitUi()               (≤12.5 Hz, fingerprint dedupe)
```

| File | Role |
| ---- | ---- |
| `src/lib/drive/session.ts` | Lifecycle, RAF loop, ingest, audio, UI emit |
| `src/lib/store/session-store.ts` | `useSyncExternalStore` bridge |
| `src/lib/drive/useDriveSession.ts` | Thin start/stop hook for routes |
| `src/components/SessionBridge.tsx` | Settings → `syncConfig()` (profile, volume, flags) |

**Rule:** high-frequency work stays in the RAF loop. React reads **deduplicated snapshots** only.

### 3. Sensors → normalized samples

All sources become `MotionSample` before fusion (`src/lib/motion/types.ts`).

| Source | Ingress | Where |
| ------ | ------- | ----- |
| Phone relay | `ingestPhoneRelayMotion()` | WebSocket callback → fusion push |
| Browser GPS | `ingestGpsPosition()` | `watchPosition` in session |
| Browser IMU | `devicemotion` handler | session.attachSensors |
| Vehicle telemetry | `ingestVehicleTelemetry()` | Fleet API poll / stream bridge |
| Demo | `tickDemoSpeed()` | `src/lib/drive/demo-physics.ts` |
| Replay | IndexedDB trace | bypasses live fusion |

Phone and Tesla browser each have their own sensor client (different tabs). They share the same `MotionSample` shape — not duplicated fusion logic.

### 4. Fusion → VehicleMotionState

**Module:** `src/lib/motion/sensor-fusion.ts`

Fusion merges layers each RAF tick and emits `VehicleMotionState` (speed, filtered accel, inferred throttle, confidence, fallback tier).

**Priority (speed anchor):**

1. `vehicle-telemetry` — Fleet Telemetry when fresh (~1.2 s)
2. `phone` — relay IMU + GPS (~15 Hz)
3. `tesla-browser` — local GPS/IMU on display device
4. `hold` — last good values (~2.2 s)
5. `decay` — gentle coast-down

Phone IMU leads transients; telemetry provides the slow baseline. Corrections are rate-limited (`sensor-fusion-correction.ts`) so reconnects and conflicts never jump RPM.

**Also on ingest:** `ingestPhoneRelayMotion()` ticks fusion immediately so sound responds before the next animation frame.

Fallback tiers: `src/lib/motion/motion-fallback.ts` (type defined once in `motion/types.ts`).

### 5. Powertrain → VirtualPowertrainState

When `settings.dynamicDrive` is on **and** the Sound Profile supports it (`supportsDynamicDrive`):

```
VehicleMotionState
       │
       ▼
PowertrainSimulator.tick()
       │
       ▼
VirtualPowertrainState  →  attached to DriveState.powertrain
```

| File | Role |
| ---- | ---- |
| `src/lib/powertrain/simulator.ts` | Gear selection, RPM, load, shifts |
| `src/lib/drive/drivetrain-resolve.ts` | Profile → transmission constants |
| `src/lib/drive/drivetrain-personalities.ts` | Shift feel, transient tuning |
| `src/lib/drive/model.ts` | **Legacy** `computeDriveState` when Dynamic Drive off |

**Dual path (intentional):** legacy speed→gear table vs full simulator. Gated at `session.ts` `computeNextDriveState`. Do not merge without a dedicated milestone.

### 6. Audio → speakers

**Engine:** `src/lib/sound/engine.ts` — one `AudioContext` per session, master limiter max gain **0.85**, profile crossfade ~**180 ms**.

| Path | When | Module |
| ---- | ---- | ------ |
| Dynamic Drive synth | `dynamicDrive` + profile support | `src/lib/sound/dynamic-drive/synth.ts` |
| Improved synth | default / legacy profiles | `src/lib/sound/realism/` |

Dynamic Drive: RPM harmonic bands + transient scheduler (`transient-scheduler.ts`). `DynamicDriveSynth.dispose()` stops oscillators **and** disconnects nodes.

Session calls `engine.update(state)` every RAF tick. Profile switch crossfades on the same context — never stack a second `AudioContext`.

### 7. Tesla cockpit → React UI

**Route:** `/drive?cockpit=1` — `src/routes/drive.tsx`

```
session-store snapshot (≤12.5 Hz)
       │
       ├── DynamicDriveInstrument   (gear, rev arc)
       ├── DriveSessionPanel          (QR pairing, phone link)
       ├── VehicleTelemetryBridge     (Fleet poll → ingest)
       └── DriveDiagnosticsPanel      (dev only)
```

Components **read** `DriveState` / `VehicleMotionState`. They do not run powertrain math.

Product language: **Rev**, **character**, **linked** — not fusion, oscillator, session, or Dynamic Drive in primary UI.

| Surface | Default | Hidden until needed |
| ------- | ------- | ------------------- |
| Tesla Drive | Speed, O ))) mark, gear arc, profile name | Connection hint, phone QR |
| Phone connect | "Phone linked" + one line | Sensor grid, remote controls |
| Settings | Sound Profile, volume | Motion-matched sound, Drive debug |

Dev diagnostics: Settings → Advanced → Drive debug, or `/drive?debug=1`. See `docs/drive-diagnostics.md`.

---

## End-to-end diagram

```
Phone (/connect)          Tesla browser (/drive?cockpit=1)
      │                              │
      │  GPS + IMU @ ~15 Hz          │  GPS + IMU (local) + relay ingest
      ▼                              ▼
 usePhoneSensorClient          DriveSession.attachSensors()
      │                              │
      └──────── WebSocket ───────────┤  useDriveRelay (display role)
              drive-relay hub         │
                                      ▼
                            ingestPhoneRelayMotion()
                            ingestVehicleTelemetry()
                                      │
                                      ▼
                         sensor-fusion.ts (tickSensorFusion)
                                      │
                                      ▼
                    PowertrainSimulator OR computeDriveState (legacy)
                                      │
                                      ▼
              SoundEngine → DynamicDriveSynth OR improved synth path
                                      │
                                      ▼
                     Drive UI (React, throttled ~80 ms)
```

---

## Three clocks (performance contract)

| Clock | Rate | What runs |
| ----- | ---- | --------- |
| **RAF simulation** | ~60 Hz | Fusion, powertrain, audio update |
| **UI emit** | ≤12.5 Hz | Fingerprint-deduped React snapshot |
| **Phone relay** | ~15 Hz | Normalized motion over WebSocket |

See `docs/TESLA_BROWSER_PERFORMANCE_AUDIT.md` for Tesla browser validation.

---

## Module map

| Layer | Primary files |
| ----- | ------------- |
| Phone UI | `src/routes/connect.$sessionId.tsx`, `phone-sensor-client.ts` |
| Relay | `src/lib/drive-relay/{protocol,client,hub,store,server-fns}.ts` |
| Session spine | `src/lib/drive/session.ts`, `session-store.ts`, `demo-physics.ts` |
| Fusion | `sensor-fusion.ts`, `sensor-fusion-correction.ts`, `motion-fallback.ts` |
| Powertrain | `powertrain/simulator.ts`, `drivetrain-resolve.ts`, `drivetrain-personalities.ts` |
| Drive state | `model.ts`, `powertrain/adapters/drive-state.ts` |
| Audio | `sound/engine.ts`, `sound/dynamic-drive/*` |
| Tesla UI | `routes/drive.tsx`, `DynamicDriveInstrument.tsx`, `DriveSessionPanel.tsx` |
| Diagnostics | `src/lib/diagnostics/*`, `DriveDiagnosticsPanel.tsx` |
| Tests | `sensor-fusion.test.ts`, `driving-scenarios.ts`, `sound/regression/` |

---

## Technical debt review (2026-08-29)

Audit criteria: duplicate models, giant hooks, drivetrain logic in React, hard-coded profiles, duplicate WebSockets, unsafe `any`, timer leaks, audio node leaks, race conditions, stale closures, duplicated sensor processing.

### Clean — no action needed

| Area | Finding |
| ---- | ------- |
| WebSockets | One per role per tab; hub rate-limits; reconnect + cleanup in `client.ts` |
| `any` types | None in drive/motion/powertrain/sound paths; wire parsing uses `unknown` |
| Timers | All browser timers cleared on unmount/stop (relay, sensors, diagnostics, session hide grace) |
| Audio nodes | `teardownVoices()` + `DynamicDriveSynth.dispose()` on profile change and stop |
| React / powertrain | Cockpit components display-only; demo controls call `session.setDemo()` |
| Sensor processing | Single fusion module; phone client normalizes only, does not fuse |

### Tightened in this cleanup

| Change | Why |
| ------ | --- |
| Removed duplicate `MotionFallbackTier` | Canonical type in `motion/types.ts`; re-export from `motion-fallback.ts` |
| Extracted `demo-physics.ts` | Demo speed + PRND overrides out of RAF loop body in `session.ts` |
| Moved `DemoControls` to `demo-physics.ts` | Breaks circular import; session re-exports for API stability |
| Deleted legacy `src/lib/drive/fusion.ts` | Fusion lives only in `sensor-fusion.ts` (prior pass) |
| Relay ingest without React state | Phone motion → callback → fusion (no ~15 Hz panel re-renders) |

### Intentionally kept (behavior-sensitive)

| Item | Rationale |
| ---- | --------- |
| Large `session.ts` (~1,400 lines) | Single RAF owner; splitting needs dedicated milestone + regression suite |
| Dual sensor ingress (phone tab vs session) | Different tabs; same `MotionSample` contract |
| Dual drivetrain paths | Legacy default; simulator behind `dynamicDrive` flag |
| Per-profile audio branches | `strategies.ts`, `motion.ts`, `drivetrain-personalities.ts` — product tuning, not duplication |
| `useDriveRelay` / `usePhoneSensorClient` (~260 lines each) | Self-contained; extract pure modules when adding a third client |

### When adding features

1. Push new motion sources through `pushMotionSample` / fusion — do not bypass priority rules.
2. Keep drivetrain logic out of React; components read `sessionSnap` only.
3. Do not add a second WebSocket or second `AudioContext` on the display tab.
4. Preserve UI throttle + fingerprint pattern when exposing new cockpit fields.
5. Add driving scenarios (A–G+) when changing fusion or powertrain behavior.

---

## Related docs

| Doc | Topic |
| --- | ----- |
| `elcamoso-comprehensive-spec.md` §9 | Product + stack summary |
| `docs/drive-relay-sessions.md` | Pairing protocol, remote controls |
| `docs/sensor-fusion.md` | Fusion hierarchy and correction |
| `docs/motion-pipeline.md` | Latency path phone → audio |
| `docs/motion-resilience.md` | Fallback tiers, reconnect |
| `docs/driving-scenarios.md` | Automated scenarios A–G |
| `docs/drive-diagnostics.md` | Dev-only debug export |
| `docs/dynamic-drive/tesla-telemetry.md` | Fleet Telemetry onboarding |
| `docs/TESLA_BROWSER_PERFORMANCE_AUDIT.md` | Tesla browser profiling |
| `docs/MEMORY_BANK_AND_CHANGELOG.md` | Dated changelog |
| `docs/AUDIO_REALISM_V2.md` | Hybrid combustion Realism V2 path |
| `docs/POWERTRAIN_CALIBRATION_V2.md` | Virtual transmission calibration tables |
| `docs/ROAD_TEST_CALIBRATION.md` | Tesla/phone road-test capture + replay lab |
| `docs/account-google-oauth.md` | ELCAMOSO account Google OAuth (not Tesla) |
