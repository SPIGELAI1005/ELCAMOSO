# Tesla Fleet Telemetry and ELCAMOSO Dynamic Drive

> Research snapshot from **official Tesla Fleet API documentation** ([developer.tesla.com](https://developer.tesla.com/docs/fleet-api/fleet-telemetry), fetched **August 29, 2026**). Verify against live docs before production onboarding — Tesla updates scopes, firmware gates, and pricing without notice.

## Purpose in ELCAMOSO

Tesla Fleet Telemetry is an **optional** motion source for Dynamic Drive. It feeds **Sensor Fusion** through the same `vehicle-telemetry` channel as phone and browser sensors. Dynamic Drive must remain fully usable when Fleet API or a telemetry server is unavailable.

Official docs: [Fleet Telemetry overview](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)

---

## VehicleTelemetryProvider adapter

ELCAMOSO uses a **pluggable provider** so Dynamic Drive never depends on Tesla API availability.

```typescript
interface VehicleTelemetryProvider {
  readonly id: string;
  readonly label: string;
  getStatus(): VehicleTelemetryStatusSnapshot;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(listener: (sample: MotionSample) => void): () => void;
}
```

| Implementation                 | File                                        | When active                        |
| ------------------------------ | ------------------------------------------- | ---------------------------------- |
| `NullVehicleTelemetryProvider` | `vehicle-telemetry/null-provider.ts`        | Default — flag off or unknown kind |
| `TeslaFleetTelemetryProvider`  | `vehicle-telemetry/tesla-fleet-provider.ts` | `teslaFleetTelemetry === true`     |

Factory: `createVehicleTelemetryProvider({ enabled, kind })` in `create-provider.ts`.

**Ingress rules:**

- Tesla adapter **never** opens a Fleet API socket from the browser.
- Samples enter only via `TeslaFleetTelemetryProvider.ingest(record)` from a **server bridge**.
- `mapTeslaFleetSignalsToMotionSample()` returns `null` when no mappable fields exist — no invented motion.
- `DriveSession.ingestVehicleTelemetry()` → provider → `pushMotionSample(source: vehicle-telemetry)` → same fusion path as phone/browser.

**Server bridge paths (implemented):**

1. `ingestFleetTelemetryFn({ sessionId, linkId?, fields })` — POST decoded Fleet Telemetry fields; caches for pull + relays to Drive session display
2. Drive relay WebSocket `role=telemetry` → `ingestVehicleTelemetryRelay()` on Tesla display
3. `pullVehicleTelemetryFn({ linkId })` — client bridge during Drive (800 ms); prefers stream cache, else read-only `vehicle_data` poll (`TESLA_VEHICLE_DATA_POLL`, max ~1 req / 2 s per link)

Client: `VehicleTelemetryBridge` → `session.ingestVehicleTelemetry()` → Sensor Fusion (`vehicle-telemetry` source).

---

## Architecture in this repo

```
Tesla vehicle (Fleet Telemetry client)
  → mTLS → Your Fleet Telemetry server (port 443, public)
  → Decode protobuf → ELCAMOSO server bridge (future)
  → Tesla browser session (ingestVehicleTelemetry)
  → pushMotionSample(source: vehicle-telemetry)
  → tickSensorFusion → VehicleMotionState → Powertrain → Audio
```

Browser-only path today: **phone relay** + **Tesla browser GPS/IMU**. Fleet Telemetry requires a **self-hosted server**; the in-car browser does not receive vehicle streams directly from Tesla.

Adapter code:

| Module                                                     | Role                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/motion/vehicle-telemetry/types.ts`                | `VehicleTelemetryProvider` interface                            |
| `src/lib/motion/vehicle-telemetry/tesla-fleet-provider.ts` | Tesla adapter (feature-flagged)                                 |
| `src/lib/motion/vehicle-telemetry/map-tesla-signals.ts`    | Maps official field names → `MotionSample` (no invented values) |
| `src/lib/drive/session.ts`                                 | `ingestVehicleTelemetry()`, provider lifecycle                  |
| Settings flag                                              | `teslaFleetTelemetry` (default **off**)                         |

---

## Current Fleet API authentication

All Fleet API calls require:

```http
Authorization: Bearer <token>
```

Token types (official [Authentication overview](https://developer.tesla.com/docs/fleet-api/authentication/overview)):

| Token                    | Use                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| **Third-party**          | App acts on behalf of a **customer** who completed OAuth                                 |
| **Third-party business** | App acts on behalf of a **business** (no user context; incompatible with user endpoints) |
| **Partner**              | Manage partner account / devices the partner owns (M2M)                                  |

OAuth metadata: `https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/thirdparty/.well-known/openid-configuration`

### OAuth requirements (third-party / customer apps)

1. Register application at [developer.tesla.com](https://developer.tesla.com) — legal entity, scopes, redirect URIs.
2. Host EC public key at:
   ```
   https://<developer-domain>/.well-known/appspecific/com.tesla.3p.public-key.pem
   ```
3. Call **register** partner endpoint **in each region** you operate ([What is Fleet API?](https://developer.tesla.com/docs/fleet-api/getting-started/what-is-fleet-api)).
4. User authorization — redirect to:
   ```
   https://auth.tesla.com/oauth2/v3/authorize
   ```
5. Exchange authorization code at (**required domain since 2025**):
   ```
   POST https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token
   ```
   - `grant_type=authorization_code`
   - `audience` = regional Fleet API base URL (see Regions below)
   - `client_id`, `client_secret`, `redirect_uri`, `code`
   - Optional `scope` (space-delimited)

Refresh tokens: include `offline_access` in scope ([Authentication overview](https://developer.tesla.com/docs/fleet-api/authentication/overview)).

**Rate limit (auth):** refresh/token exchange must stay **≤ 20 req/s** per app/account ([Best practices](https://developer.tesla.com/docs/fleet-api/getting-started/best-practices)).

**Migration note (2025-07-21):** Server-to-server token exchange must use `fleet-auth.prd.vn.cloud.tesla.com`, not `auth.tesla.com` ([Announcements](https://developer.tesla.com/docs/fleet-api/announcements)).

Authentication endpoints are **not billed**.

---

## OAuth scopes (official)

From [Authentication overview — Scopes](https://developer.tesla.com/docs/fleet-api/authentication/overview):

| Scope                                | Purpose                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `openid`                             | Sign in with Tesla                                                                                  |
| `offline_access`                     | Refresh tokens                                                                                      |
| `vehicle_device_data`                | Live vehicle data, service history, Superchargers nearby, etc.                                      |
| `vehicle_location`                   | **Separate** location scope (precise + coarse). Required for location telemetry fields (see below). |
| `vehicle_cmds`                       | Commands (unlock, wake, remote start, etc.)                                                         |
| `vehicle_charging_cmds`              | Charging history and charge commands                                                                |
| `vehicle_specs`                      | Specs (partner token only)                                                                          |
| `vehicle_pricing_info`               | Pricing (partner token only)                                                                        |
| `energy_device_data` / `energy_cmds` | Powerwall / solar                                                                                   |
| `enterprise_management`              | Enterprise fleet management                                                                         |

**ELCAMOSO-relevant minimum for motion (server-side onboarding):**

- `vehicle_device_data` — configure Fleet Telemetry and stream driving/powertrain fields
- `vehicle_location` — only if you configure `Location`, `GpsHeading`, `GpsState`, route fields, etc. ([Fleet Telemetry overview](https://developer.tesla.com/docs/fleet-api/fleet-telemetry))

**Scope migration (2024-11-26):** Location was split from `vehicle_device_data`. Authorizations without `vehicle_location` lose location functionality after the migration period ([Announcements](https://developer.tesla.com/docs/fleet-api/announcements)).

Request **only scopes you need** — required by Fleet API Agreement and best practices.

---

## Virtual key requirements

Fleet Telemetry configurations and vehicle commands must be **signed** with a private key whose public key is on the vehicle.

Official guides:

- [Virtual keys overview](https://developer.tesla.com/docs/fleet-api/virtual-keys/overview)
- [Virtual keys developer guide](https://developer.tesla.com/docs/fleet-api/virtual-keys/developer-guide)

### Requirements

1. Generate **secp256r1** public/private key pair.
2. Host **public** key at `.well-known/appspecific/com.tesla.3p.public-key.pem` on your registered domain.
3. Register app with Fleet API (partner register per region).
4. User must add key to vehicle (unless B2B auto-provision applies):
   ```
   https://tesla.com/_ak/<developer-domain>?vin=<optional-vin>
   ```
5. User must have granted `vehicle_device_data`, `vehicle_cmds`, or `vehicle_location` before pairing.

Virtual key is **in addition to** OAuth — vehicle verifies signed telemetry config and commands locally. User removes key on vehicle **Locks** screen or via account security.

Verify key presence via `fleet_status` endpoint (state may lag).

---

## Fleet Telemetry onboarding (official flow)

Source: [Fleet Telemetry overview](https://developer.tesla.com/docs/fleet-api/fleet-telemetry), [teslamotors/fleet-telemetry README](https://github.com/teslamotors/fleet-telemetry)

### Prerequisites

| Requirement            | Detail                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer app          | Approved at developer.tesla.com with correct scopes                                                                                                                  |
| Public key             | Hosted + partner register in **each region**                                                                                                                         |
| Virtual key            | Paired on target vehicle(s)                                                                                                                                          |
| Fleet Telemetry server | Public internet, **port 443**, mTLS                                                                                                                                  |
| Vehicle Command Proxy  | Recommended path to **sign** telemetry config ([Vehicle endpoints — fleet_telemetry_config](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints)) |
| Firmware               | **2024.26+** (2023.20.6+ for legacy CSR apps). Model S/X with Intel Atom: **2025.20+**                                                                               |
| Billing                | Payment method + billing limit configured ([Billing and limits](#billing-rate-limits))                                                                               |

CSR-based onboarding was deprecated for new setups (2025-01-09 announcement); use Vehicle Command Proxy on firmware **2024.26.4+**.

### Configure vehicle

1. Deploy and validate server (`check_server_cert.sh` from fleet-telemetry repo).
2. POST fleet telemetry config (via proxy):
   ```
   POST /api/1/vehicles/fleet_telemetry_config
   ```
3. Payload includes `hostname`, `port` (443), CA, and per-field `interval_seconds` (and optional `minimum_delta`, `resend_interval_seconds`, `include_fields` on supported firmware).

Example (from official overview):

```json
{
  "fields": {
    "VehicleSpeed": { "interval_seconds": 10 },
    "Location": { "interval_seconds": 10 },
    "Soc": { "interval_seconds": 60 }
  }
}
```

**Limits:**

- Up to **five** third-party streaming apps per vehicle ([Fleet Telemetry overview](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)).
- GET config reports `synced`, `limit_reached` ([Vehicle endpoints](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints)).
- If required OAuth scope is revoked, config is **removed** from vehicle.

**Same Tesla account:** User configuring telemetry must be logged into the same Tesla account that authorized the app (Fleet Telemetry overview troubleshooting).

---

## Telemetry server requirements

Official + reference implementation ([GitHub: teslamotors/fleet-telemetry](https://github.com/teslamotors/fleet-telemetry)):

| Requirement         | Detail                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Public host**     | FQDN reachable from internet                                                             |
| **Port**            | **443** (vehicle connects here)                                                          |
| **TLS**             | Server certificate + key                                                                 |
| **mTLS**            | Mutual TLS — vehicle presents client cert; terminate mTLS **on** fleet-telemetry service |
| **CA chain**        | Include in config; validate with `check_server_cert.sh`                                  |
| **Architecture**    | Recommended: Firewall/LB → Fleet Telemetry → Kafka (or Redis, Kinesis, Pub/Sub)          |
| **Ack mode**        | `reliable_ack` optional — vehicle retries if server does not acknowledge stored messages |
| **Reference image** | `tesla/fleet-telemetry` on Docker Hub                                                    |

ELCAMOSO does **not** embed the fleet-telemetry server in the web app. Production needs dedicated infrastructure (not Vercel serverless WebSockets alone).

---

## Supported data fields

Authoritative list: [Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data)

Protobuf: [vehicle_data.proto](https://github.com/teslamotors/fleet-telemetry) in the open-source repo.

### System behavior (latency-related)

Official [Fleet Telemetry overview — System Behavior](https://developer.tesla.com/docs/fleet-api/fleet-telemetry):

1. **Event collector** — gathers field updates in **500 ms** buckets, then delivers all fields that emitted values in that window to your server.
2. **Per-field gating** — a field is sent to the collector only when **`interval_seconds`** has elapsed **and** the value has changed since the last publish (change-based streaming reduces cost vs polling `vehicle_data`).
3. **`include_fields`** (client 1.3.0, firmware 2026.26.6+) — piggyback listed fields when a parent field publishes, even if unchanged.
4. **`minimum_delta`** (firmware 2024.44.32+) — numeric fields must change by at least delta (meters for location fields) before resend.
5. **`delivery_policy: latest`** (client 1.0.0+) — vehicle resends un-acked data; requires Fleet Telemetry **server ≥ 0.7.1**.

Vehicle data category is documented as sent every **500 ms** when actively streaming ([Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data)).

**Failure handling (official):**

- Loss of connectivity: vehicle buffers up to **5000 messages** (~2500+ seconds of data at minimum), then delivers on reconnect.
- Server disconnect: exponential backoff reconnect, **max 30 s** delay.
- Connectivity state: monitor via Fleet Telemetry connectivity events or `fleet_status`.

Signals may return `invalid: true` when not measurable ([Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data)).

### Location scope gate

These fields require **`vehicle_location`** scope ([Fleet Telemetry overview](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)):

`Location`, `OriginLocation`, `DestinationLocation`, `DestinationName`, `RouteLine`, `GpsState`, `GpsHeading`

### ELCAMOSO motion mapping (implemented)

Only fields present in the decoded record are mapped — **never synthesized**:

| Tesla field                     | Official unit         | ELCAMOSO `MotionSample`                                        |
| ------------------------------- | --------------------- | -------------------------------------------------------------- |
| `VehicleSpeed`                  | **mph**               | `speedKmh` (converted)                                         |
| `LongitudinalAcceleration`      | m/s²                  | `accelerationLongitudinal`                                     |
| `LateralAcceleration`           | m/s²                  | `accelerationLateral`                                          |
| `GpsHeading`                    | degrees               | `heading`                                                      |
| `PedalPosition`                 | real (0..100 typical) | `pedalPosition` (0..1)                                         |
| `DiAxleSpeedR` / `DiAxleSpeedF` | RPM at axle           | `motorAxleSpeedRpm` (max of available axles)                   |
| `Gear`                          | ShiftState enum       | `vehicleOperatingState`                                        |
| `DriveRail`                     | boolean               | `vehicleOperatingState` (`READY` / `STANDBY`) when Gear absent |

Other driving/powertrain fields (`DiTorquemotor`, `BrakePedal`, etc.) are documented by Tesla but **not** mapped in v1 unless listed above.

Server bridge paths:

- Drive relay `telemetry` role → display → `ingestVehicleTelemetryRelay()`
- HTTP `ingestFleetTelemetryFn({ sessionId, fields })` for a Fleet Telemetry worker

Configure only fields you need — each streamed signal is billable (see below).

Suggested starter config for Dynamic Drive (server-side; tune intervals for cost):

```json
{
  "fields": {
    "VehicleSpeed": { "interval_seconds": 1 },
    "LongitudinalAcceleration": { "interval_seconds": 1 },
    "GpsHeading": { "interval_seconds": 2 }
  }
}
```

---

## Expected latency

Official documentation does **not** publish a single end-to-end SLA in milliseconds. Use these **documented** bounds for design:

| Stage            | Expectation                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vehicle sampling | Up to **500 ms** internal vehicle data cadence when streaming ([Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data))                                               |
| Field config     | `interval_seconds` sets minimum spacing per field; changes can publish sooner                                                                                                                             |
| Transport        | Direct vehicle → your server (lower than polling Fleet API `vehicle_data`)                                                                                                                                |
| vs polling       | Billing docs: Fleet Telemetry = “high frequency with **low latency**” vs `vehicle_data` polling ([Billing and limits — Cost optimization](https://developer.tesla.com/docs/fleet-api/billing-and-limits)) |
| ELCAMOSO fusion  | `TELEMETRY_STALE_MS = 1200` in `sensor-fusion.ts` — treat samples older than ~1.2 s as stale                                                                                                              |
| Server bridge    | Add your decode + relay RTT on top; measure in pipeline metrics                                                                                                                                           |

Pre-2018 Model S/X **without** infotainment upgrade: **no Fleet Telemetry support** ([Billing and limits](https://developer.tesla.com/docs/fleet-api/billing-and-limits)).

---

## Regional restrictions

Source: [Regions and countries](https://developer.tesla.com/docs/fleet-api/getting-started/regions-countries)

| Region                                    | Fleet API base URL                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| North America, Asia-Pacific (excl. China) | `https://fleet-api.prd.na.vn.cloud.tesla.com`                                                                         |
| Europe, Middle East, Africa               | `https://fleet-api.prd.eu.vn.cloud.tesla.com`                                                                         |
| China                                     | `https://fleet-api.prd.cn.vn.cloud.tesla.cn` — separate [developer.tesla.cn](https://developer.tesla.cn), +86 account |

- OAuth `audience` must match the user’s region.
- Wrong region → HTTP **421** Incorrect region ([Conventions](https://developer.tesla.com/docs/fleet-api/getting-started/conventions)).
- **451** — legal/privacy block.
- Register partner account **per region** ([Best practices](https://developer.tesla.com/docs/fleet-api/getting-started/best-practices)).
- Resolve user region: `GET /api/1/users/region` ([User endpoints](https://developer.tesla.com/docs/fleet-api/endpoints/user-endpoints)).

Developers must comply with CCPA, GDPR, PIPL, etc. ([Best practices](https://developer.tesla.com/docs/fleet-api/getting-started/best-practices)).

**Payment and billing limit updates** are available only in countries listed on [Regions and countries](https://developer.tesla.com/docs/fleet-api/getting-started/regions-countries) (North America: US, CA, MX, PR; Europe: GB, NO, NL, DE, …; Asia-Pacific: JP, KR, AU, TW, NZ, HK, MO, MY, TH, PH). Developers outside those countries should optimize usage; Tesla notes limited usage may apply where payment is not yet supported ([Announcements — Pay-per-use pricing](https://developer.tesla.com/docs/fleet-api/announcements)).

---

## Billing, rate limits, and cost

Source: [Billing and limits](https://developer.tesla.com/docs/fleet-api/billing-and-limits)

### Pricing model

- **Pay per use** — categories: **Streaming Signals**, **Commands**, **Data** (poll), **Wakes**.
- Each endpoint shows **Pricing Category** in API docs.
- Status codes **&lt; 500** count as billable; 5xx not billed.
- Monthly billing cycle; invoice ~14 days after month end.
- **~$10/month discount** (USD; €10 in EU per regional marketing pages) for small apps.

Example list prices ([developer.tesla.com](https://developer.tesla.com/) homepage, verify in billing portal):

| Category          | Rate (USD)               |
| ----------------- | ------------------------ |
| Streaming signals | **150,000** signals / $1 |
| Commands          | **1,000** requests / $1  |
| Data (poll)       | **500** requests / $1    |
| Wakes             | **50** requests / $1     |

Official example config (~15 signals/min while driving): about **$0.006/hour** for a minimal field set ([Fleet Telemetry overview — Example Configuration Pricing Analysis](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)).

Fleet Telemetry migration case study (Tesla doc): ~**97%** cost reduction vs polling for a consumer app session ([Billing and limits — Cost optimization case studies](https://developer.tesla.com/docs/fleet-api/billing-and-limits)).

### Billing limit protection

- Default limit **$0** until payment method added.
- Exceeding limit → API **suspended**; **Fleet Telemetry configs removed from vehicles**.
- **Configs are not auto-restored** when limit raised — must reconfigure.
- Email at 80% and 100% of limit.

### Rate limits (per device, per account)

| Category             | Limit       |
| -------------------- | ----------- |
| Realtime Data (poll) | 60 / minute |
| Wakes                | 3 / minute  |
| Device Commands      | 30 / minute |

Shared across all apps on the account touching the same vehicle.

### Cost optimization (official)

- Prefer Fleet Telemetry over `vehicle_data` polling.
- Avoid frequent wakes; check connectivity via telemetry or vehicle state.
- Use `minimum_delta` for noisy numeric fields.
- Handle command errors before retry (e.g. missing virtual key).

---

## ELCAMOSO feature flag and fallback

| Setting               | Default  | Effect                                                             |
| --------------------- | -------- | ------------------------------------------------------------------ |
| `teslaFleetTelemetry` | `false`  | When off, `NullVehicleTelemetryProvider` — zero Tesla API coupling |
| `dynamicDrive`        | separate | Powertrain/audio path; works with browser + phone only             |

Sensor fusion priority (unchanged): `vehicle-telemetry` → `phone` → `tesla-browser` → hold → decay.

When telemetry stops, fusion falls back without RPM jumps (same as phone relay loss).

### Privacy alignment

- ELCAMOSO product rule: motion stays on-device unless user opts into cloud.
- Fleet Telemetry is **explicit server-side** infrastructure; location fields require `vehicle_location` and separate privacy review.
- Phone relay already strips lat/lng on the wire (`relay-sample.ts`).
- Tesla fleet mapping in v1 avoids persisting `Location` in the browser adapter unless product/legal approves.

---

## Implementation checklist (future server work)

- [ ] Deploy fleet-telemetry server + mTLS + monitoring
- [ ] Vehicle Command Proxy for signed config
- [ ] OAuth + virtual key UX (outside drive UI, parked)
- [ ] Server bridge → ELCAMOSO session (`ingestVehicleTelemetry` or relay `telemetry` role)
- [ ] Configure minimal field set for cost
- [ ] Re-register telemetry after billing limit events
- [ ] Regional register + token audience per user

---

## References

- [Fleet Telemetry overview](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)
- [Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data)
- [Authentication overview](https://developer.tesla.com/docs/fleet-api/authentication/overview)
- [Third-party tokens](https://developer.tesla.com/docs/fleet-api/authentication/third-party-tokens)
- [Virtual keys developer guide](https://developer.tesla.com/docs/fleet-api/virtual-keys/developer-guide)
- [Vehicle endpoints (fleet_telemetry_config)](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints)
- [Billing and limits](https://developer.tesla.com/docs/fleet-api/billing-and-limits)
- [Regions and countries](https://developer.tesla.com/docs/fleet-api/getting-started/regions-countries)
- [Best practices](https://developer.tesla.com/docs/fleet-api/getting-started/best-practices)
- [Announcements](https://developer.tesla.com/docs/fleet-api/announcements)
- [fleet-telemetry (GitHub)](https://github.com/teslamotors/fleet-telemetry)
