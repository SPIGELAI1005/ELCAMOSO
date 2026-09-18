# Silent Capture

**Drive first. Hear it later.**

## Modes

| Mode               | User label     | Audio                             | Trace                           |
| ------------------ | -------------- | --------------------------------- | ------------------------------- |
| `live`             | LIVE SOUND     | Yes                               | Optional legacy DriveTrace only |
| `capture`          | SILENT CAPTURE | **No** AudioContext / SoundEngine | JourneyTraceV1                  |
| `live-and-capture` | LIVE + CAPTURE | Yes                               | JourneyTraceV1 + legacy         |

Stored in settings as `driveOutputMode`.

## Silent Capture behavior

- Motion acquisition + sensor fusion continue
- Adaptive JourneyTrace sampler (~8–15 Hz)
- Powertrain may run computationally for live UI if needed later — **raw trace stays personality-independent**
- No synthesis, analyzers, or audible nodes in `capture` mode
- Coordinates used only transiently for speed (browser GPS) and **never persisted** in JourneyTrace

Privacy line shown in UI:

> ELCAMOSO records how the drive moved, not where you went.

## Web background limits

`visibilitychange` / `pagehide` / `pageshow`:

- Capture marks a **gap** (`capture_paused` / `capture_resumed`)
- UI discloses: “Capture was paused by the browser for part of this drive.”
- Missing sections are **never fabricated**
- Web apps cannot promise reliable background recording

## Native background capture

Capacitor iOS/Android builds use the `MotionCaptureProvider` boundary. A capture explicitly started in the foreground continues through screen lock using Core Location background mode on iOS or a user-visible location foreground service on Android. Native storage persists privacy-safe chunks and imports the final/partial `JourneyTraceV1` into IndexedDB on return. See `docs/NATIVE_COMPANION.md`.

## End drive

YOUR DRIVE IS READY → Motion Signature → Hear this drive (Engine / Symphony / World / Fusion) → Create Drive Song → Save / Delete

Optional: after ~3 minutes stationary → “Still driving?” (Continue / Finish). Never auto-stops at speed 0.

## Crash recovery

Active journey id in IndexedDB. On next launch: Recover or Discard incomplete journey.

## Battery

Silent Capture skips audio graph work. Prefer calm HUD (no heavy viz). Target: meaningfully lower CPU than live Engine/Symphony.

## Architecture

See `docs/JOURNEY_TRACE.md`.
