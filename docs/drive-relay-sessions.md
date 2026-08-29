# Shared Drive sessions (Tesla + phone)

Temporary real-time pairing for proving display ↔ phone relay before motion sensors are shared.

## Flow

1. **Tesla** — open `/drive?cockpit=1`, tap **Create Drive Session**.
2. Scan the **QR** or note the **6-digit pairing code**.
3. **Phone** — open the QR URL or `/connect/{sessionId}` and enter the code.
4. Both sides show connection status: Display, Phone, Vehicle (telemetry slot — future).
5. Use **Signal phone** / **Signal display** to verify UI actions cross the relay.
6. Use **Latency test** on either side when both are connected (measures round-trip ms).

Motion samples are **on** when `RELAY_MOTION_STREAM_ENABLED` is true in `src/lib/drive-relay/config.ts` (default). Phone sends ~15 Hz normalized frames; no latitude/longitude on the wire.

## Protocol (pairing phase)

WebSocket messages are JSON:

- `heartbeat` — keep-alive + session TTL extension
- `status` — `{ display, phone, telemetry }` connected flags
- `action` — UI tap relay (`tesla-ui-tap`, `phone-ui-tap`) and remote controls
- `motion` — normalized phone sample at ~15 Hz (**disabled in pairing phase**; no lat/lng on wire when enabled)
- `latency-ping` / `latency-pong` — round-trip measurement

### Phone remote (optional)

When paired, the phone can act as a **sensor + remote controller**. Sound still plays on the Tesla browser.

| Control | Action kind | Tesla setting |
| ------- | ----------- | ------------- |
| Sound Profile | `set-profile` | `profileId` |
| Sound intensity | `set-sound-intensity` | `tuning[profileId].response` |
| Transmission mode | `set-transmission-mode` | `dynamicDrive` |
| Exhaust / transients | `set-transient-intensity` | `shiftFeel.revMatch` |
| Master sound | `set-master-volume` | `volume` |
| Stop Drive | `stop-drive` | `getSession().stop()` |

Tesla broadcasts `drive-state-sync` after every change so the phone UI stays aligned. Controls are collapsed by default on `/connect/{sessionId}` — intended for parked setup, not use while moving.

Implementation: `PhoneRemoteController` (phone), `RelayRemoteControlBridge` (Tesla, inside `DriveSessionPanel`).

The server **relays** in memory only; it does not persist raw location or samples.

## UI

| Surface | Component |
| ------- | --------- |
| Tesla display | `DriveSessionPanel` + `RelayRemoteControlBridge` + `RelaySessionProbe` |
| Phone | `/connect/$sessionId` + `PhoneRemoteController` + `PhoneSensorStatus` |

## Server

| Piece                        | Path                                |
| ---------------------------- | ----------------------------------- |
| Motion gate                  | `src/lib/drive-relay/config.ts`     |
| Probe kinds                  | `src/lib/drive-relay/probe.ts`      |
| Session store (TTL, cleanup) | `src/lib/drive-relay/store.ts`      |
| WebSocket hub                | `src/lib/drive-relay/hub.ts`        |
| Node WS adapter              | `src/lib/drive-relay/ws-node.ts`    |
| REST create/join             | `src/lib/drive-relay/server-fns.ts` |
| Client hook                  | `src/lib/drive-relay/client.ts`     |

WebSocket endpoint: `/api/drive-relay/ws?sessionId=…&role=display|phone&token=…`

Sessions expire after **30 minutes** (extended on heartbeat). Stale sessions are purged every 60s.

## Local development

WebSocket is wired through a Vite plugin (`driveRelayWsPlugin`) on **dev** and **preview**:

```bash
npm run dev
# Tesla: http://localhost:5173/drive?cockpit=1
# Phone:  http://localhost:5173/connect/{sessionId}
```

Use the same machine with two browser windows, or phone on the same LAN pointing at your dev host.

## Production note

Vercel serverless deploy serves HTTP only today. Shared sessions require **dev**, **vite preview**, or a future dedicated WebSocket service / Redis-backed relay. The session REST APIs work on deploy; realtime relay does not until WS infrastructure is added.

## Add telemetry later

Set `role=telemetry` on the WebSocket URL and implement a third client. The store already tracks `telemetryConnected`.
