# Shared Drive sessions (Tesla + phone)

See **[PHONE_PAIRING.md](./PHONE_PAIRING.md)** for the product pairing flow (QR, Free entitlement, claim tokens, fallback).

Temporary real-time pairing for display ↔ phone relay and motion sensors.

## Flow

1. **Tesla** — open `/drive`, tap **Connect phone** (no `?cockpit=1` required).
2. Scan the **QR** (`/pair/{claimToken}`) or note the **6-digit pairing code**.
3. **Phone** — confirm on `/pair/{token}`, or open `/pair` and enter the code.
4. Both sides show connection status. Sound stays on the car; phone streams motion.
5. Use **Latency test** on either side when both are connected (dev/debug).

Motion samples are **on** when `RELAY_MOTION_STREAM_ENABLED` is true in `src/lib/drive-relay/config.ts` (default). Phone sends ~15 Hz normalized frames; no latitude/longitude on the wire.

## Protocol

WebSocket messages are JSON:

- `heartbeat` — keep-alive + session TTL extension
- `status` — `{ display, phone, telemetry }` connected flags
- `action` — UI tap relay and remote controls
- `motion` — normalized phone sample at ~15 Hz
- `latency-ping` / `latency-pong` — round-trip measurement

### Phone remote (optional)

When paired, the phone can act as a **sensor + remote controller**. Sound still plays on the Tesla browser.

Implementation: `PhoneRemoteController` (phone), `RelayRemoteControlBridge` (Tesla, inside `DriveSessionPanel`).

The server **relays** in memory only; it does not persist raw location or samples.

## UI

| Surface | Component |
| ------- | --------- |
| Tesla display | `DriveSessionPanel` + `RelayRemoteControlBridge` |
| Phone | `/pair`, `/pair/$token`, `PhonePairSession` |
| Legacy | `/connect/$sessionId` |

## Server

| Piece | Path |
| ----- | ---- |
| Motion gate | `src/lib/drive-relay/config.ts` |
| Session store (TTL, claim) | `src/lib/drive-relay/store.ts` |
| WebSocket hub | `src/lib/drive-relay/hub.ts` |
| REST create/join/claim | `src/lib/drive-relay/server-fns.ts` |
| Client hook | `src/lib/drive-relay/client.ts` |

WebSocket endpoint: `/api/drive-relay/ws?sessionId=…&role=display|phone&token=…`

Sessions expire after **30 minutes** (extended on heartbeat). Claim tokens expire after **3 minutes** (single-use).

## Local development

```bash
npm run dev
# Tesla: http://localhost:5173/drive
# Phone:  scan QR or http://localhost:5173/pair
```

## Production note

Vercel serverless does not keep long-lived WebSockets. For production Tesla↔phone relay, host the WS hub on a process that supports sticky connections (or a dedicated WS service). HTTP create/claim/join still work; live motion needs WS.
