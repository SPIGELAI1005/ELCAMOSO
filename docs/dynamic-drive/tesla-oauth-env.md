# Tesla OAuth environment variables

Server-only configuration for the official Tesla **third-party** authorization flow. See also [`tesla-telemetry.md`](./tesla-telemetry.md) for Fleet Telemetry architecture.

**Never** prefix Tesla secrets with `VITE_` — they must not reach the browser bundle.

## Required for Connect Vehicle

| Variable                     | Description                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `TESLA_CLIENT_ID`            | OAuth client ID from [developer.tesla.com](https://developer.tesla.com)                        |
| `TESLA_CLIENT_SECRET`        | OAuth client secret (server only)                                                              |
| `TESLA_REDIRECT_URI`         | Must match a registered redirect URI exactly, e.g. `http://localhost:5173/auth/tesla/callback` |
| `TESLA_TOKEN_ENCRYPTION_KEY` | 64 hex characters (32 bytes) used to encrypt refresh tokens at rest                            |

## Environment separation

| Variable       | Description                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------- |
| `ELCAMOSO_ENV` | `development` (default), `staging`, or `production` — selects suffixed credentials when set |

When `ELCAMOSO_ENV=staging` or `production`, the server reads:

- `TESLA_CLIENT_ID_STAGING` / `TESLA_CLIENT_ID_PRODUCTION`
- `TESLA_CLIENT_SECRET_STAGING` / `TESLA_CLIENT_SECRET_PRODUCTION`
- `TESLA_REDIRECT_URI_STAGING` / `TESLA_REDIRECT_URI_PRODUCTION`

If a suffixed value is missing, the unsuffixed `TESLA_CLIENT_*` / `TESLA_REDIRECT_URI` is used.

Use **separate Tesla developer applications** per environment with distinct redirect URIs.

## Optional

| Variable                 | Default                                                     | Description                                                                 |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `TESLA_DEVELOPER_DOMAIN` | —                                                           | Domain for virtual key pairing URL: `https://tesla.com/_ak/<domain>`        |
| `TESLA_FLEET_REGION`     | `NA`                                                        | Initial Fleet API region: `NA`, `EU`, or `CN` until user region is resolved |
| `TESLA_AUTH_TOKEN_URL`   | `https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token` | Token exchange and refresh endpoint                                         |

## OAuth scopes requested (minimum)

ELCAMOSO requests only:

- `openid`
- `offline_access`
- `vehicle_device_data`

We do **not** request `vehicle_cmds`, `vehicle_charging_cmds`, or `vehicle_location` in the Connect Vehicle flow. No commands or vehicle state changes are sent.

Authorization uses `require_requested_scopes=true` so users must grant the minimum set before proceeding ([Third-party tokens](https://developer.tesla.com/docs/fleet-api/authentication/third-party-tokens)).

Users can modify or revoke scopes via Tesla’s consent page (`consentRevokeUrl` returned in connection status when configured).

## Local development

1. Copy `.env.example` to `.env.local`.
2. Fill Tesla credentials from a **development** Fleet API application.
3. Register redirect URI: `http://localhost:5173/auth/tesla/callback`
4. Generate encryption key: `openssl rand -hex 32`
5. Run `npm run dev` on port 5173.

## Production notes

- Token storage in this MVP uses an **encrypted in-memory store** (resets on cold start). Replace with durable storage (KV/Postgres) before production scale.
- **Disconnect** revokes the refresh token at Tesla (`auth.tesla.com/oauth2/v3/revoke`) and deletes the local link bucket.
- Register partner + host public key at `/.well-known/appspecific/com.tesla.3p.public-key.pem` before Fleet Telemetry (separate from OAuth).
- Token exchange must use `fleet-auth.prd.vn.cloud.tesla.com` ([Tesla announcement 2025-07-21](https://developer.tesla.com/docs/fleet-api/announcements)).

## Verify configuration

Settings → Sensors → **Connect Vehicle** shows whether the server is configured. If variables are missing, the UI stays disabled with a short explanation (no secrets logged).
