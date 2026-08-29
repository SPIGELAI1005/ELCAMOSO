# Tesla browser performance audit — Dynamic Drive

Audit target: **Tesla in-car Chromium** (`/drive?cockpit=1`, Dynamic Drive enabled).  
Scope: motion fusion, virtual powertrain, layered Web Audio, relay ingest, React cockpit UI.

## Executive summary

Dynamic Drive intentionally runs **high-frequency simulation on the main thread** (~60 Hz RAF) for fusion, powertrain, and audio. React is **not** wired 1:1 to that loop: session UI emits are throttled to **80 ms** (`UI_MS`) and now **skip entirely** when quantized UI fields are unchanged.

After optimization, the typical cockpit path targets **~4–8 React commits/s** during steady cruise (gear/RPM quantized), versus **~12.5/s** before deduplication, while audio and fusion remain at display rate.

---

## Architecture: three clocks

| Layer                                  | Rate                  | Thread                 | React?                        |
| -------------------------------------- | --------------------- | ---------------------- | ----------------------------- |
| RAF loop (fusion → powertrain → audio) | ~60 Hz                | Main                   | No                            |
| Session UI emit (`tryEmitUi`)          | ≤12.5 Hz (80 ms gate) | Main                   | Yes, when fingerprint changes |
| Phone relay motion WebSocket           | 15 Hz                 | Main (message handler) | Indirect (fusion only)        |
| Drive diagnostics panel                | 2 Hz                  | Main                   | Yes (debug only)              |
| Relay heartbeat                        | 0.067 Hz (15 s)       | Main                   | No                            |

**Rule:** High-frequency simulation must not trigger equivalent React rendering. Audio and fusion stay on RAF; React reads throttled + deduplicated snapshots.

---

## Main-thread usage

### Hot path (every RAF frame, ~16 ms budget)

1. `tickSensorFusion()` — GPS/phone/telemetry blend, fallback tiers
2. `PowertrainSimulator.tick()` — gear logic, RPM tracking, shift transients
3. `SoundEngine.update()` → `DynamicDriveSynth.update()` — `setTargetAtTime` on ~40+ params
4. `deriveMotionState()` — motion energy smoothing (~120 ms tau)

### Warm path (throttled)

- `tryEmitUi()` — fingerprint compare + optional `read()` snapshot
- `pipeline.snapshot()` — only when cockpit flag set or emit fires
- `getMeter()` — analyser read when snapshot built

### Cold path (avoid on Tesla drive)

- `collectDriveDiagnostics()` — full fusion/audio scan; **2 Hz max** when debug mode on
- `DriveDiagnosticsPanel` — **500 ms interval only** (removed duplicate session subscribe)

---

## React render frequency

### Before audit

| Source                                           | Approx. re-renders/s             |
| ------------------------------------------------ | -------------------------------- |
| Session emit (all `useSessionStore` subscribers) | ~12.5                            |
| Global chrome (nav, mini player, root layout)    | ~12.5 each emit                  |
| `drive.tsx`                                      | ~12.5 (double subscription)      |
| Debug diagnostics                                | ~12.5 + 2 (subscribe + interval) |

### After audit (latest)

| Change                                        | Effect                                                 |
| --------------------------------------------- | ------------------------------------------------------ |
| `computeUiFingerprint()` + `tryEmitUi()`      | Skip emit when RPM/gear/speed/motion buckets unchanged |
| **Core/aux fingerprint split**                | Skip analyser + pipeline reads when core stable (non-cockpit) |
| **Cockpit aux throttle**                      | Pipeline/meter refresh ~320 ms during steady cruise    |
| `useSessionSelector()` on chrome              | Nav/layout ignore RPM-only emits                       |
| Single subscription in `useDriveSession`      | Removes redundant store read                           |
| `memo(DynamicDriveInstrument)`                | Skips SVG/text work when quantized props match         |
| `memo(ElcamosoMark)` + quantized motion props | Fewer inline style + animation restarts                |
| Diagnostics: interval-only                    | No 12.5 Hz diagnostic collection from subscribe        |
| **Relay motion callback ingest**              | Phone motion at 15 Hz → fusion only; **no React re-render** |
| **`RelayRemoteControlBridge` selector**       | Ignores RPM ticks; syncs on kind/status changes only   |
| **`DriveSessionPanel` pipeline selector**     | Dev pipeline panel ignores unrelated session fields    |

**Quantization buckets (UI fingerprint):**

- Speed: 2 km/h
- RPM: 20 rpm
- Motion energy: 1/16
- Throttle/regen: 1/8
- Meter peak/RMS: 1/16

---

## AudioNode count (Dynamic Drive)

Per active `DynamicDriveSynth` instance (typical GT V8 profile):

| Group                                                        | Nodes   |
| ------------------------------------------------------------ | ------- |
| RPM bands (7 × filter + gain + 4 oscillators)                | 42      |
| Transient layers (8 × filter + gain + looping buffer source) | 24      |
| Accent bus                                                   | 1       |
| **Total synth nodes**                                        | **~67** |

Plus engine master chain (limiter, EQ, reverb send, analyser): ~10–15 nodes.

**Nodes are created once** at profile build; per-frame work is parameter automation only (`targetParam` / `setTargetAtTime`), not node allocation.

---

## Memory and audio buffer duplication

| Resource                         | Policy                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Noise buffers (white/pink/brown) | **One buffer per `AudioContext` per color** via `WeakMap` in `getNoiseBuffer()`   |
| Transient layers                 | Share same noise buffer; 8 looping `AudioBufferSourceNode`s, not 8 unique buffers |
| Oscillator buffers               | None (procedural oscillators)                                                     |
| Profile switch                   | `dispose()` stops sources; rebuild on next profile                                |

**No per-frame buffer allocation** in the Dynamic Drive update path.

---

## WebSocket volume (Drive relay)

| Message           | Direction              | Rate                                                |
| ----------------- | ---------------------- | --------------------------------------------------- |
| `motion`          | Phone → display        | **15 Hz** (`TARGET_HZ` in `phone-sensor-client.ts`) |
| `telemetry`       | Phone/server → display | Event-driven (Fleet Telemetry)                      |
| `heartbeat`       | Both                   | **every 15 s**                                      |
| Remote state sync | Phone ↔ display        | On user action / settings change                    |

Display ingest: `onPhoneMotion` callback → `ingestPhoneRelayMotion()` → fusion only; **no React state update** on the WebSocket handler path.

### Before relay callback fix

| Source                         | Approx. re-renders/s |
| ------------------------------ | -------------------- |
| `DriveSessionPanel` (motion)   | **~15** (via `lastMotion` state) |

### After relay callback fix

| Source                         | Approx. re-renders/s |
| ------------------------------ | -------------------- |
| `DriveSessionPanel` (motion)   | **0** (ingest only)  |

---

## Sensor update frequency

| Source                       | Into fusion                    | Notes                                       |
| ---------------------------- | ------------------------------ | ------------------------------------------- |
| Browser GPS                  | Event-driven                   | `maximumAge: 1000` on drive attach          |
| Tesla browser `devicemotion` | Event-driven (~60 Hz possible) | Pushes IMU samples immediately              |
| Phone relay                  | 15 Hz                          | Primary high-quality motion on paired drive |
| Fleet telemetry              | Variable                       | Baseline speed/accel when enabled           |

Fusion output consumed by powertrain at **RAF rate** (~60 Hz), regardless of sensor cadence.

---

## Animation cost

| Element                              | Driver                         | Cost profile                                                                |
| ------------------------------------ | ------------------------------ | --------------------------------------------------------------------------- |
| `ElcamosoMark` waves                 | CSS `@keyframes wave-radiate`  | GPU-friendly; **cycle duration quantized to 40 ms steps** to avoid restarts |
| Gear shift flash                     | CSS class `animate-gear-shift` | Triggered on gear change only                                               |
| Tach arc                             | SVG path `d` recalc            | Memoized instrument; updates on 20 rpm buckets                              |
| `animate-pulse` on Dynamic Drive dot | CSS                            | Low                                                                         |

**Reduced motion:** respects `prefers-reduced-motion` / settings; disables looping radiation.

---

## Timers

| Timer                | Period     | Purpose               |
| -------------------- | ---------- | --------------------- |
| `UI_MS`              | 80 ms      | UI emit gate          |
| Phone sensor tick    | 67 ms      | Sample + relay send   |
| Diagnostics panel    | 500 ms     | Debug overlay refresh |
| Diagnostics recorder | 500 ms min | Session ring buffer   |
| Relay heartbeat      | 15 s       | Keep-alive            |
| Haptics adaptive     | 220–480 ms | Pulses (optional)     |
| Shift flash timeout  | 320 ms     | One-shot UI           |

No `setInterval` on the core drive RAF path.

---

## Garbage collection pressure

### Removed / reduced allocations

- **Dynamic Drive debug array:** was rebuilt every audio frame (15 layer objects + `.find()`); now built **on demand** in `getDebugInfo()` only
- **Session emit dedup:** fewer snapshot objects + fewer React commit trees
- **Memoized components:** fewer transient VDOM objects on steady cruise

### Remaining acceptable pressure

- **`computeUiFingerprint()` on emit** — full snapshot built only when fingerprint changes (~4–8/s cruise)
- **Cockpit pipeline panel** — updates via throttled aux fingerprint (~3 Hz when core stable)
- **`{ ...pt }` copy in synth** — one object/frame for transient scheduler prev state

### Resolved in this pass

- ~~`DriveSessionPanel` re-renders at phone motion rate (~15/s)~~ → callback ingest
- ~~`RelayRemoteControlBridge` full store subscription~~ → kind/status slice
- ~~Analyser read every 80 ms during steady cruise~~ → skipped when core fingerprint stable

---

## Latency

| Segment                     | Typical target                | Measurement                        |
| --------------------------- | ----------------------------- | ---------------------------------- |
| Phone → server → display    | 200–900 ms                    | `MotionPipelineMetrics.endToEndMs` |
| Display → fusion            | <16 ms                        | Same RAF tick                      |
| Fusion → powertrain → audio | <16 ms                        | Same RAF tick                      |
| UI reflect speed/RPM        | 80–160 ms                     | `UI_MS` + fingerprint buckets      |
| Audio output                | `baseLatency + outputLatency` | `AudioPerf` in session             |

Session applies optional **latency compensation** (`latencyCompMs`, relay-suggested comp) on fused state before audio — behavior unchanged.

Underrun detection compares audio clock vs wall clock in `tickAudio()`; surfaced as `AudioPerf.underruns`.

---

## Optimizations applied (behavior-neutral)

1. **`tryEmitUi()`** — fingerprint-gated React notifications
2. **Core/aux UI fingerprint** — defer `safeMeter()` / `pipeline.snapshot()` when drive UI buckets unchanged
3. **`useSessionSelector()`** — chrome reads `safetyMode` / status slices only
4. **Single drive subscription** — `useDriveSession` returns `sessionSnap`
5. **`memo(DynamicDriveInstrument)`** — quantized prop equality
6. **`memo(ElcamosoMark)`** — quantized motion + stable animation period
7. **Diagnostics panel** — 500 ms interval only; no session subscribe
8. **Debug recorder** — 500 ms min interval (matches export ring buffer)
9. **Lazy `getDebugInfo()`** — no per-frame debug object construction
10. **Relay `onPhoneMotion` / `onTelemetry` callbacks** — WS ingest without `setState`
11. **`RelayRemoteControlBridge` session slice** — kind/status only for state sync
12. **`DriveSessionPanel` pipeline selector** — dev metrics isolated from RPM emits

---

## Tesla cockpit verification checklist

Run on vehicle or Tesla Browser devtools with `/drive?cockpit=1`:

1. **Performance panel:** Main thread should show RAF + audio; React commits well below 60/s.
2. **Memory:** Stable heap after 5 min drive; no climbing `AudioBuffer` count.
3. **WebSocket:** ~15 motion messages/s from phone relay; no duplicate connections.
4. **Audio:** No audible glitches when UI emit rate drops (dedup during steady cruise).
5. **Gear/RPM display:** Still updates smoothly (20 rpm / 2 km/h buckets imperceptible in car).

Optional dev flags: `?debug=1` + Settings → Drive debug diagnostics (keep off for production drives).

---

## Files touched in this audit

| File                                        | Change                                            |
| ------------------------------------------- | ------------------------------------------------- |
| `src/lib/drive/session.ts`                  | UI fingerprint, `tryEmitUi`, core/aux split, diagnostics throttle |
| `src/lib/store/session-store.ts`            | `useSessionSelector`                              |
| `src/lib/drive/useDriveSession.ts`          | Expose `sessionSnap`                              |
| `src/routes/drive.tsx`                      | Single subscription                               |
| `src/routes/__root.tsx`, nav components     | Selective selectors                               |
| `src/components/DynamicDriveInstrument.tsx` | `memo`                                            |
| `src/components/ElcamosoLogo.tsx`           | `memo` + quantization                             |
| `src/components/DriveDiagnosticsPanel.tsx`  | Interval-only updates                             |
| `src/lib/sound/dynamic-drive/synth.ts`      | Lazy debug info                                   |
| `src/lib/drive-relay/client.ts`             | Motion/telemetry callback ingest (no WS `setState`) |
| `src/components/DriveSessionPanel.tsx`      | Callback ingest + pipeline selector               |
| `src/components/RelayRemoteControlBridge.tsx` | Session kind/status selector                    |
| `src/lib/drive-relay/remote-control.ts`     | `buildDriveRemoteState` accepts session slice     |

---

## Related docs

- `docs/TESLA_BROWSER_SMOKE_TEST.md` — manual smoke checklist
- `src/lib/motion/pipeline-metrics.ts` — relay latency instrumentation
- `src/lib/diagnostics/` — exportable debug session (coordinates stripped)
