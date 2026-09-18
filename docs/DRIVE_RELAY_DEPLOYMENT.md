# Drive relay deployment (dedicated WebSocket host)

## Why

**Production probe (2026-09-17):** `https://www.elcamoso.com/api/drive-relay/ws` returns **HTTP 404**.
Vercel serverless (Nitro `vercel` preset) does not ship the Vite `driveRelayWsPlugin` upgrade handler and cannot keep sticky long-lived WebSockets for Tesla ↔ phone motion.

Local / `vite preview`: WS works via `src/lib/drive-relay/vite-ws-plugin.ts`.

## Architecture

```
Tesla browser (/drive)          Phone (/pair/$token)
        │                                 │
        │  HTTP create / claim / join     │
        ├──────────► Vercel app ──────────┤
        │                 │               │
        │                 │ DRIVE_RELAY_INTERNAL_URL
        │                 ▼               │
        │         Dedicated relay host    │
        │         (sessions Map + hub)    │
        │                 ▲               │
        │  wss://relay…/api/drive-relay/ws│
        └─────────────────┴───────────────┘
```

| Layer           | Responsibility                                                               |
| --------------- | ---------------------------------------------------------------------------- |
| Vercel app      | UI, OAuth, Stripe, entitlements, `createServerFn` entitlement gate           |
| Dedicated relay | Ephemeral sessions + WebSocket fanout only                                   |
| Client          | `VITE_DRIVE_RELAY_PUBLIC_ORIGIN` → `buildRelayWsUrl` / `DriveRelayTransport` |

**Do not** put Google, Stripe, or database secrets on the relay.

## Run locally

```bash
npm run relay:dev
# listens :8787 — health GET /health — WS /api/drive-relay/ws
```

Point the app:

```env
# Client (public — origin only, no secrets)
VITE_DRIVE_RELAY_PUBLIC_ORIGIN=http://localhost:8787

# Server (Vercel / local Node — never VITE_)
DRIVE_RELAY_INTERNAL_URL=http://localhost:8787
DRIVE_RELAY_INTERNAL_SECRET=dev-only-shared-bearer
DRIVE_RELAY_ALLOWED_ORIGINS=http://localhost:5173,https://www.elcamoso.com
```

## Production deploy (vendor-isolated)

Any host that supports long-lived Node HTTP + WebSocket upgrades (Fly.io, Railway, Render, a small VPS). Example:

1. Deploy `services/drive-relay/server.ts` (or `npm run relay:dev` entry) as a single sticky process.
2. TLS terminate at the edge (`wss://relay.elcamoso.com`).
3. Set `DRIVE_RELAY_ALLOWED_ORIGINS` to production app origins.
4. Set a strong `DRIVE_RELAY_INTERNAL_SECRET`; configure the same on Vercel as `DRIVE_RELAY_INTERNAL_SECRET`.
5. Set Vercel `DRIVE_RELAY_INTERNAL_URL=https://relay.elcamoso.com`.
6. Set build-time `VITE_DRIVE_RELAY_PUBLIC_ORIGIN=https://relay.elcamoso.com`.
7. Redeploy the app so clients dial the dedicated host.

## Session store rule

Create/claim/join **must** hit the same process as WebSocket peers. When `DRIVE_RELAY_INTERNAL_URL` is set, app server-fns proxy session APIs to the relay (`src/lib/drive-relay/remote-store.ts`). When unset, local in-memory store is used (dev Vite plugin).

## Security

- Join secret never in QR (claim token only).
- Message size cap: `RELAY_MAX_MESSAGE_BYTES` (8 KiB).
- Motion rate ≤ 22/s; telemetry ≤ 12/s; claim/code attempt limits in store.
- Internal HTTP requires Bearer when `DRIVE_RELAY_INTERNAL_SECRET` is set.

## Ops checklist

- [ ] `/health` returns 200 on relay
- [ ] WS upgrade succeeds from Tesla + phone origins
- [ ] Create session on app → claim on phone → both WS `connected`
- [ ] Kill phone WS → Tesla falls back to browser sensors within grace
- [ ] No Stripe/Google env vars present on relay process
