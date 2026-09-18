# Browser support matrix (ELCAMOSO)

| Surface                              | Tesla Chromium     | Chrome Android | Safari iPhone | Chrome iPhone | Desktop Chrome |
| ------------------------------------ | ------------------ | -------------- | ------------- | ------------- | -------------- |
| Drive + Engine audio                 | Primary            | Pair / remote  | Pair / remote | Pair / remote | Dev / Studio   |
| Phone sensors → relay                | N/A (display)      | Supported      | Supported*    | Supported*    | Dev only       |
| WebSocket relay                      | Required           | Required       | Required      | Required      | Required       |
| DeviceOrientation / Motion           | Limited            | Yes            | Yes*          | Yes*          | Limited        |
| Geolocation speed                    | Yes (when allowed) | Yes            | Yes           | Yes           | Yes            |
| Web Audio API                        | Yes                | Yes            | Yes           | Yes           | Yes            |
| OfflineAudioContext (Studio/Journey) | Partial            | Yes            | Yes           | Yes           | Yes            |
| Speech recognition (Studio)          | No                 | Optional       | No            | Optional      | Optional       |
| PWA / service worker                 | Shell only         | Shell only     | Limited       | Shell only    | Shell only     |
| Share sheet (`navigator.share`)      | Rare               | Yes            | Yes           | Yes           | Rare           |

\*iOS requires a user gesture for motion permission (`DeviceMotionEvent.requestPermission`).

## Unsupported / fallback

| API / capability                   | Fallback                                           |
| ---------------------------------- | -------------------------------------------------- |
| Long-lived WS on Vercel app origin | Dedicated relay (`VITE_DRIVE_RELAY_PUBLIC_ORIGIN`) |
| Phone relay disconnect             | Browser / Tesla sensors (`motion-fallback`)        |
| Symphony WAV decode failure        | Procedural stems + “Music couldn't load.”          |
| World layer start failure          | Silent degrade; Drive continues                    |
| AudioContext interrupted           | Resume on next gesture; limiter still caps gain    |
| Reduced motion                     | UI motion reduced; audio still ramps               |

## Tesla notes

- Portrait mobile-first UI; avoid complex Studio/Explore while moving (`DrivingInteractionGate`).
- One `AudioContext`; no React state at audio rate.
- Pair while parked or passenger connects — ELCAMOSO does not control the vehicle.

See also: `docs/TESLA_BROWSER_SMOKE_TEST.md`, `docs/TESLA_BROWSER_PERFORMANCE_AUDIT.md`.
