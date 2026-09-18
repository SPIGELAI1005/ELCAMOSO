# Drive diagnostics (developer-only)

Product-grade live diagnostics for motion → fusion → powertrain → audio → network. Gated behind an explicit debug mode — never shown in normal Drive.

## Enable debug mode

1. **Settings → Advanced → Diagnostics panel** — turn on `Diagnostics panel` (`devPanel`)
2. **Drive debug diagnostics** — turn on `debugDriveDiagnostics`, **or**
3. Open **`/drive?debug=1`** while the diagnostics panel is enabled

During an active drive, the overlay appears below the cockpit controls (with pipeline timings when debug is active).

In local dev builds:

- **`/debug/diagnostics`** — standalone diagnostics page
- **`/debug`** — sound harness (unchanged)

## Live sections

| Section        | Fields                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| **Motion**     | Browser GPS, phone GPS (speed, accuracy, age), acceleration raw/filtered, Tesla telemetry |
| **Fusion**     | Chosen speed/acceleration, confidence, primary source, fallback tier                      |
| **Powertrain** | Throttle, load, gear, RPM, shift state                                                    |
| **Audio**      | Active layers, transients (gain, playback rate, Hz), master output                        |
| **Network**    | Phone/vehicle latency, packet rates, packet loss, reconnect count                         |
| **Pipeline**   | Stage latencies (sensor → audio), fusion/audio Hz                                         |

## JSON export

- **Export JSON** in the debug panel downloads a short session (~30 s, 2 Hz, max 60 frames)
- Envelope: `elcamoso.diagnostics.session` with `meta` (profile, synthesis mode — **no coordinates**)
- Location keys stripped: `latitude`, `longitude`, `lat`, `lng`, `heading`, `altitude`, `coordinates`

## Key files

| File                                       | Role                  |
| ------------------------------------------ | --------------------- |
| `src/lib/diagnostics/types.ts`             | Frame + export types  |
| `src/lib/diagnostics/collect.ts`           | Snapshot collector    |
| `src/lib/diagnostics/export.ts`            | Sanitize + download   |
| `src/lib/diagnostics/recorder.ts`          | 2 Hz ring buffer      |
| `src/lib/diagnostics/debug-mode.ts`        | Explicit debug gate   |
| `src/components/DriveDiagnosticsPanel.tsx` | Live UI               |
| `src/lib/drive/session.ts`                 | Recorder + export API |

## Tests

```bash
npm test -- src/lib/diagnostics/
```
