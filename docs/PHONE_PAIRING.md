# Phone pairing (Tesla ↔ phone)

Secure QR / short-code pairing so a phone can stream motion sensors into an ELCAMOSO drive session running in the Tesla browser. The car remains the UI and sound playback device.

## Architecture map

| Layer | Status |
| ----- | ------ |
| In-memory drive-relay sessions + WebSocket hub | **Exists** (`src/lib/drive-relay/`) |
| QR generation (`qrcode`) on Tesla panel | **Exists** — now points at `/pair/{claimToken}` |
| Sensor fusion (phone preferred over browser GPS) | **Exists** (`SPEED_SOURCE_PRIORITY`) |
| Smooth phone dropout / reconnect | **Exists** (`onPhoneRelayPeerLost`, motion fallback) |
| Free entitlement for basic pairing | **Was missing** — Free now includes `phone_sensor` |
| Discoverable Drive UI (no `?cockpit=1`) | **Was missing** — panel always on `/drive` |
| Opaque short-lived claim tokens | **New** — 3 minute TTL, single-use |
| Manual `/pair` code entry | **New** |
| Phone confirm + sensor status UI | **New** (`PhonePairSession`) |

## Sequence

1. **Tesla** on `/drive` → **Connect phone** → server creates session (`joinSecret`, `pairingCode`, `claimToken`).
2. Tesla shows high-contrast QR → `https://{host}/pair/{claimToken}` plus formatted code `482 193`.
3. **Phone** scans QR (or opens `/pair` and enters code).
4. Phone confirms → **claim** (QR) or **join-by-code** → receives `sessionId` + `joinSecret` (not the QR token forever).
5. Phone opens WebSocket `/api/drive-relay/ws?role=phone&token={joinSecret}`.
6. Tesla display peer already connected with the same session; status shows **Phone connected**.
7. Phone streams normalized motion (~15 Hz). Fusion prefers phone when healthy.
8. If phone drops: drive continues; browser/Tesla sensors take over smoothly. Reconnect with stored `joinSecret` (sessionStorage) or the short code while the session lives.

## Security model

| Token | Lifetime | Use |
| ----- | -------- | --- |
| `claimToken` | ~3 minutes, **single-use** | QR URL only |
| `pairingCode` | Session TTL (30 min, heartbeat extend) | Manual entry / reconnect after disconnect |
| `joinSecret` | Session TTL | WebSocket auth — never put in QR |

- Cryptographically random ids/secrets (`crypto.randomBytes`).
- Rate limits on claim / code attempts (12 / minute / key).
- Second live phone peer is rejected (no silent hijack).
- Message schema validated in hub/protocol; size/rate limits on the WS path.
- Never put API keys, Stripe, Google, or DB credentials in QR or client storage.
- Phone may keep `joinSecret` in **sessionStorage** for the tab lifetime only (reconnect), not permanent localStorage.

## Relay transport

- WebSocket: `/api/drive-relay/ws`
- Local/dev/preview: Vite `driveRelayWsPlugin`
- **Production (Vercel):** serverless HTTP does not keep long-lived WS; relay may require a dedicated WS host. See `docs/drive-relay-sessions.md`.

## Sensor priority & fallback

Priority (speed baseline): `vehicle-telemetry` → `phone` → `tesla-browser` → `simulator`.

On phone loss: no fake accel/brake/RPM spike — fusion and motion fallback blend to the next healthy source. On reconnect: phone becomes preferred again when packets are fresh.

## Free vs Drive+

| Capability | Free | Drive+ |
| ---------- | ---- | ------ |
| QR / code pairing | Yes | Yes |
| Phone sensor relay | Yes | Yes |
| One drive session + one phone | Yes | Yes |
| Reconnect in-session | Yes | Yes |
| Premium profiles / Dynamic Drive / advanced audio | No | Yes |

Pairing is **optional**. Free users can drive with Tesla/browser sensors only.

## Routes

| Route | Role |
| ----- | ---- |
| `/drive` | Tesla UI — Connect phone + QR |
| `/pair/{token}` | Phone QR claim |
| `/pair` | Phone manual code |
| `/connect/{sessionId}` | Legacy join (code / optional token query) |

## Diagnostics

With Drive debug: relay status, latency probe, pipeline metrics (packet rate, latency, GPS/IMU health via existing diagnostics panels).

## Road-test procedure

1. Park. Open `https://www.elcamoso.com/drive` in the Tesla browser (no special query required).
2. Tap **Connect phone**. Confirm large QR + code.
3. Phone camera → open link → **Connect** → allow motion/location.
4. Tesla shows **Phone connected**. Start Drive. Confirm sound on car, motion from phone.
5. Kill phone browser briefly: drive continues without RPM spike; status shows disconnect/reconnect.
6. Reopen phone with same tab (sessionStorage) or re-enter code.
7. Confirm Free account can pair without Drive+.
