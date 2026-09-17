# ELCAMOSO — Monetization Audit

**Date:** 2026-08-29  
**Status:** Historical read-only audit (snapshot). **Implementation has progressed since this date** — see Progress update below and `docs/MEMORY_BANK_AND_CHANGELOG.md`.  
**Original next step:** Implement in phases per separate instructions after this audit is approved.

### Progress update (2026-09-17)

| Area | Audit said | Now |
| ---- | ---------- | --- |
| User accounts | None | Magic link + **Google OAuth** (PKCE); HttpOnly session cookie |
| Billing / Stripe | None | Stripe Checkout, portal, webhooks, entitlements (see `docs/billing/`) |
| Entitlements | None | Server `assertServerEntitlement` + client gates |
| Dynamic Drive trial | — | Preview trial with server-authoritative usage |
| Account docs | — | `docs/account-google-oauth.md` |

The sections below remain the original 2026-08-29 recommendations for historical context.

**Target commercial model (v1):**

| Plan | Price | Scope |
| ---- | ----- | ----- |
| **FREE** | €0 | Tesla browser, essential Sound Profiles, basic motion-responsive audio, basic Drive, **basic Tesla↔phone QR pairing**, limited Dynamic Drive preview |
| **DRIVE+** | €2.99/mo · €24.99/yr | All standard profiles, full Dynamic Drive, advanced controls, future premium features |
| **PRO** | — | **Not in v1.** Architecture must allow a third plan later without rewrites. |

**Principles (non-negotiable):**

- Stripe manages **payments**; ELCAMOSO **Entitlements** manage **authorization**.
- Never expose Stripe secret keys client-side.
- Never trust plan/price IDs from the client.
- Never grant DRIVE+ from a checkout redirect alone — **verified Stripe webhooks** are billing authority.
- FREE must work when Stripe or billing APIs are unavailable.
- Billing failures must not break normal Drive audio.

---

## 1. Executive summary

ELCAMOSO today is a **client-first premium EV sound app**. Core value (Web Audio, motion, Drive UI) runs entirely in the browser with settings in `localStorage`. Server functions exist for optional features (Tesla OAuth, phone relay pairing, AI studio, cloud sync stub) but **there is no user account, no database, no Stripe, and no entitlement layer**.

This is favorable for monetization: the product already separates **on-device Drive** from **server-assisted features**, which maps cleanly to FREE vs DRIVE+.

| Area | Current state | Monetization readiness |
| ---- | ------------- | ---------------------- |
| User accounts | None (anonymous `installId`, optional `cloudAccountId`) | **Greenfield** |
| Billing / Stripe | None | **Greenfield** |
| Entitlements | None | **Greenfield** |
| Feature gates | UX toggles only (`dynamicDrive`, etc.) | **Hooks exist, ungated** |
| Sound catalog | 47 profiles, no tier field | **Needs catalog metadata** |
| Dynamic Drive | User toggle, default off | **Strong DRIVE+ anchor** |
| Phone relay | Free basic QR pairing (`phone_sensor`); claim tokens + WS | **Free for pairing; Drive+ for premium audio** |
| Deployment | Vercel + Nitro, in-memory server state | **Needs persistent store for billing** |

---

## 2. Target architecture (recommended)

Independent entitlement layer. Stripe is an **input** to entitlements, not the runtime check scattered through UI.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (browser)                        │
│  Settings + UI ──► useEntitlements() ◄── cache (TTL, stale OK)  │
│       │                    │                                    │
│       ▼                    ▼                                    │
│  Feature gates      DriveSession (unchanged spine)                │
│  (profiles, DD,     localStorage settings + session singleton    │
│   relay, controls)                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ createServerFn (CSRF protected)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ELCAMOSO SERVER (Nitro)                    │
│                                                                 │
│  AccountService        ──► accountId (email magic link / OAuth) │
│  BillingService        ──► Stripe Checkout + Customer Portal    │
│  EntitlementService    ──► source of truth for plan + features  │
│  WebhookHandler        ──► Stripe events → EntitlementService   │
│                                                                 │
│  getEntitlementsFn(accountId)  ← client never sends plan id     │
│  createCheckoutSessionFn       ← server picks Price IDs         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Persistent store       │
              │  accounts               │
              │  subscriptions          │
              │  entitlements (snapshot)│
              │  stripe_customer_map    │
              └────────────────────────┘
                           ▲
                           │ verified webhooks only
              ┌────────────┴────────────┐
              │         Stripe          │
              └─────────────────────────┘
```

### Layer responsibilities

| Layer | Owns | Must not own |
| ----- | ---- | ------------ |
| **Account** | Stable `accountId`, auth session, link to Stripe Customer | Feature logic |
| **Billing / trial** | Checkout, portal, trial periods, invoices | UI authorization |
| **Entitlements** | `{ plan, status, features, expiresAt, source }` | Payment capture |
| **Feature gates** | Read entitlements + catalog rules; degrade gracefully | Stripe API calls |
| **Drive session** | Audio, fusion, powertrain (unchanged) | Subscription state |

### Fail-safe defaults

| Condition | Behavior |
| --------- | -------- |
| Not logged in | **FREE** tier |
| `getEntitlementsFn` error / timeout | **FREE** tier (never upgrade by accident) |
| Stripe webhook delay | Last known entitlement until TTL; then FREE if expired |
| Stripe entirely down | FREE continues; DRIVE+ upsell hidden or “unavailable” |
| User toggles `dynamicDrive` in localStorage | **Ignored** if entitlement denies (server snapshot wins on sync) |

### Future plan extensibility

Store entitlements as **feature flags keyed by plan**, not boolean `isPremium`:

```typescript
interface EntitlementSnapshot {
  plan: "free" | "drive_plus" | "pro"; // pro unused in v1
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  features: {
    catalogTier: "essential" | "standard" | "all";
    dynamicDrive: boolean | "preview"; // preview = limited DD
    phoneRelay: boolean;
    advancedControls: boolean;
    // future: cloudSync, aiStudio, fleetTelemetry, ...
  };
  validUntil: number | null;
  revision: number; // monotonic for cache invalidation
}
```

Adding PRO later = new Stripe prices + new row rules in `EntitlementService` — no Drive session rewrite.

---

## 3. Current authentication

| Item | Finding |
| ---- | ------- |
| ELCAMOSO user login | **None** — no `/login`, email, or JWT session |
| Tesla OAuth | Vehicle linking only — `src/lib/tesla/oauth.ts`, callback `src/routes/auth/tesla/callback.tsx` |
| Tesla tokens | In-memory `link-store.ts`, keyed by client `teslaLinkId` in settings |
| Anonymous IDs | `installId()` in `src/lib/telemetry/analytics.ts`; `cloudAccountId` defaults to `local-${Date.now()}` in Settings |
| CSRF | `createCsrfMiddleware` on server functions — `src/start.ts` |

**Gap:** No durable identity to attach subscriptions. **Minimum-risk path:** magic-link or OAuth (Apple/Google) → `accountId` → optional link to existing `installId` for analytics continuity.

**Important:** Tesla OAuth ≠ ELCAMOSO account. Keep separate; DRIVE+ must not depend on Tesla Fleet.

---

## 4. Users / database

| Store | Technology | Durability | Path |
| ----- | ---------- | ---------- | ---- |
| Settings | `localStorage` (`elcamoso.settings`) | Device-local | `src/lib/drive/settings.ts` |
| Drive traces | IndexedDB | Device-local | `src/lib/drive/traces.ts` |
| ELCAMOSO Cloud | In-memory `Map` | **Lost on cold start** | `src/lib/cloud/store.ts` |
| Telemetry ingest | In-memory ring buffer | Ephemeral | `src/lib/telemetry/store.ts` |
| Share codes | In-memory `Map` | Ephemeral | `src/lib/telemetry/store.ts` |
| Tesla tokens | In-memory encrypted | Ephemeral | `src/lib/tesla/link-store.ts` |
| Drive relay sessions | In-memory, 30 min TTL | Ephemeral | `src/lib/drive-relay/store.ts` |

**No Postgres, Supabase client, Redis, or Vercel KV** in `package.json`.

**Recommendation:** Add **one** persistent store for accounts + entitlements + Stripe customer mapping. Options (lowest risk first):

1. **Vercel Postgres** + Drizzle/Prisma — same deploy target, SQL, webhook-friendly.
2. **Supabase Postgres** — backend only; user-facing copy stays “ELCAMOSO Cloud”.
3. **Stripe Customer + metadata** — insufficient alone; still need entitlement snapshot table for feature gates and offline resilience.

Cloud garage sync (`syncGarageFn`) should remain **optional** and not block v1 billing.

---

## 5. Session handling

### Drive session (audio / motion)

| Concern | Location | Server involvement |
| ------- | -------- | ------------------ |
| Singleton pipeline | `src/lib/drive/session.ts` | None |
| React subscription | `src/lib/store/session-store.ts` | None |
| Settings sync | `src/components/SessionBridge.tsx` | None |
| Lifecycle hook | `src/lib/drive/useDriveSession.ts` | None |

**Monetization impact:** Drive session should **not** call Stripe or entitlements every RAF tick. Entitlements affect **configuration** (`dynamicDrive`, allowed `profileId`, relay enablement) at session start or settings sync — not the audio loop.

### Drive relay session (phone ↔ Tesla)

| Concern | Location |
| ------- | -------- |
| Create / join | `src/lib/drive-relay/server-fns.ts` |
| WS hub | `src/lib/drive-relay/hub.ts`, `/api/drive-relay/ws` |
| Phone route | `src/routes/pair.tsx`, `pair_.$token.tsx` (legacy `connect.$sessionId`) |
| Tesla panel | `src/components/DriveSessionPanel.tsx` |

**Current (2026-09-17):** Free includes `phone_sensor`. Create/claim/join use opaque claim tokens (`/pair/{token}`) and short codes; QR never embeds `joinSecret`.  
**DRIVE+ mapping:** Premium profiles / Dynamic Drive / advanced audio stay Drive+. Pairing itself is Free — see `docs/PHONE_PAIRING.md`.

---

## 6. Current feature gating

All toggles in `ElcamosoSettings` — **none payment-linked**:

| Setting | Default | Premium candidate |
| ------- | ------- | ----------------- |
| `dynamicDrive` | `false` | **DRIVE+** (full); FREE = preview only |
| `teslaFleetTelemetry` | `false` | Future / optional add-on |
| `cloudEnabled` | `false` | Future |
| `analyticsEnabled` | `false` | Unchanged (opt-in privacy) |
| `devPanel` / `debugDriveDiagnostics` | `false` | Dev only |

Other gating (non-monetary): safety ack, intense-volume confirm, debug overlay.

**No** `entitlement`, `plan`, `trialEndsAt`, or paywall routes.

---

## 7. Sound profile data model

**Interface:** `SoundProfile` in `src/lib/sound/profiles.ts` — fields include `id`, `name`, `category`, `drivetrainMode`, optional `drivetrainPersonalityId`, `custom`, `baseId`. **No `tier` or `requiresPlan`.**

**Catalog size:** 47 built-in profiles (22 in `profiles.ts` + 25 in `profiles-expansion.ts`) + runtime custom profiles from Studio/Garage.

**Access today:** All profiles browsable on `/sounds`; default profile `gt-v8`.

### Proposed catalog split (for implementation phase)

| Tier | Suggested profiles (product — refine before launch) |
| ---- | --------------------------------------------------- |
| **FREE essential** | `gt-v8`, `cyber-pulse`, `flat-six-sport`, `open-wind`, `zen-drive` (~5) |
| **DRIVE+ standard** | Remaining built-in catalog + full Dynamic Drive on VT profiles |

Implement via **`catalogTier: 'essential' | 'standard'`** on profile metadata (or separate manifest JSON server-controlled) — not hard-coded in 47 profile objects if avoidable.

**Custom sounds / Studio:** Keep FREE creation; optional DRIVE+ limit (count or export) in a later phase.

---

## 8. Dynamic Drive architecture

| Piece | Path | Gate today |
| ----- | ---- | ---------- |
| User flag | `settings.dynamicDrive` | User toggle, Advanced settings |
| Eligibility | `supportsDynamicDrive(profile)` → `drivetrainMode === 'virtual-transmission'` | Profile metadata |
| Powertrain | `PowertrainSimulator` in `session.ts` when flag on | Client-only |
| Audio | `DynamicDriveSynth` in `src/lib/sound/engine.ts` | Client-only |
| Phone remote | Can toggle `dynamicDrive` over relay | Ungated |

**17 virtual-transmission profiles** benefit from full Dynamic Drive; 30 continuous profiles use improved/synthetic load path.

### FREE “limited Dynamic Drive preview” (recommended)

| FREE | DRIVE+ |
| ---- | ------ |
| Legacy / improved synth always | Full `PowertrainSimulator` + transients |
| Preview: 1–2 VT profiles OR time-boxed DD OR capped RPM/shift count per drive | Unlimited |
| No phone relay motion | Phone pairing |
| Essential profiles only | All standard profiles |

Preview must be **entitlement-driven**, not a hidden localStorage bypass.

Docs: `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`, `docs/SOUND_CHARACTER_SPEC.md`.

---

## 9. Phone / Tesla shared session architecture

Documented in `docs/drive-relay-sessions.md`.

- WebSocket roles: `display`, `phone`, `telemetry`
- Motion ~15 Hz when `RELAY_MOTION_STREAM_ENABLED` (`src/lib/drive-relay/config.ts`)
- Production caveat: Vercel serverless = HTTP only today; relay WS works in dev/preview/dedicated host

**Monetization (updated 2026-09-17):** Free includes basic Tesla↔phone QR pairing + sensor relay (`phone_sensor`). Drive+ owns premium profiles, full Dynamic Drive, and advanced audio — not the pairing mechanism itself. See `docs/PHONE_PAIRING.md`.

---

## 10. Backend / API framework

| Piece | Detail |
| ----- | ------ |
| Framework | TanStack Start + Nitro (`vite.config.ts` → `preset: "vercel"`) |
| Server functions | Thin `createServerFn` wrappers — `src/lib/*/server-fns.ts` |
| Middleware | CSRF on server fn — `src/start.ts` |
| SSR wrapper | `src/server.ts` |
| API routes | WS only: `/api/drive-relay/ws` |
| Webhooks | **None** |

### Existing server functions (integration touchpoints)

| Module | Functions |
| ------ | --------- |
| `cloud/server-fns.ts` | `syncGarageFn`, `loadGarageFn`, `findSoundFn`, `promptToSoundFn`, `driveCoachFn`, `ingestTelemetryFn`, `createShareFn`, `loadShareFn` |
| `tesla/server-fns.ts` | OAuth, vehicle list, telemetry pull |
| `drive-relay/server-fns.ts` | `createDriveRelaySessionFn`, `joinDriveRelaySessionFn`, `getDriveRelaySessionFn` |

**New modules (recommended, not implemented):**

- `src/lib/billing/stripe.ts` — server-only Stripe SDK
- `src/lib/billing/webhook-handler.ts` — signature verify + idempotent events
- `src/lib/entitlements/service.ts` — read/write snapshots
- `src/lib/entitlements/server-fns.ts` — `getEntitlementsFn`, `createCheckoutSessionFn`, `createPortalSessionFn`
- `src/routes/api/stripe/webhook.ts` or Nitro route — **no CSRF**; Stripe signature instead

Follow project rule: no Node-only packages in client bundles; Stripe SDK server-only.

---

## 11. Current payments

**None.**

- No `stripe` in `package.json`
- No checkout, subscription, invoice, or webhook code
- “Billing” in repo = Tesla Fleet API pricing docs + legal liability cap in terms

---

## 12. Environment handling

**`.env.example`** (current):

| Variable | Purpose |
| -------- | ------- |
| `ELCAMOSO_ENV` | development / staging / production |
| `OPENAI_API_KEY` | Optional AI |
| `TESLA_*` | Fleet OAuth (per-env client ids) |
| `TESLA_TOKEN_ENCRYPTION_KEY` | Token encryption |

**Missing for monetization:**

| Variable | Server-only |
| -------- | ----------- |
| `STRIPE_SECRET_KEY` | Yes |
| `STRIPE_WEBHOOK_SECRET` | Yes |
| `STRIPE_PRICE_DRIVE_PLUS_MONTHLY` | Yes (never trust client) |
| `STRIPE_PRICE_DRIVE_PLUS_YEARLY` | Yes |
| `DATABASE_URL` | Yes |
| `SESSION_SECRET` / auth secret | Yes |

Env resolution pattern exists in `src/lib/tesla/config.ts` (`VERCEL_ENV` → staging/production). Reuse for Stripe price IDs per environment.

---

## 13. Analytics

| Piece | Path |
| ----- | ---- |
| Events | `garage_open`, `studio_*`, `share_create`, `audio_error`, `calibrate_complete` |
| Opt-in | `settings.analyticsEnabled` |
| Transport | `TelemetryBridge` → `ingestTelemetryFn` (in-memory) |

**Missing for monetization:** `paywall_view`, `checkout_start`, `subscription_active`, `trial_start`, `plan_change`, `entitlement_denied` (coarse, no PII).

Add events in implementation phase; keep opt-in policy.

---

## 14. Production deployment

| Item | Detail |
| ---- | ------ |
| Host | Vercel (`vercel.json`, Nitro `preset: "vercel"`) |
| Build | `npm run build` → `.vercel/output` |
| Stack | React 19, TanStack Start, Vite 8, Nitro 3 |
| WS relay | Dev/preview plugin; production WS needs dedicated service or future infra |
| Cold starts | In-memory Tesla/cloud/relay state **resets** — blocks production billing unless DB + sticky sessions |

**Billing implication:** Entitlements and Stripe customer IDs **must** live in persistent storage, not server memory.

---

## 15. FREE vs DRIVE+ feature mapping

| Capability | FREE | DRIVE+ |
| ---------- | ---- | ------ |
| Tesla browser Drive | ✓ | ✓ |
| Essential Sound Profiles | ✓ | ✓ |
| All standard Sound Profiles | — | ✓ |
| Basic motion-responsive audio | ✓ | ✓ |
| Dynamic Drive (full) | — | ✓ |
| Dynamic Drive preview | Limited | — |
| Virtual RPM / transmission | Preview or legacy | ✓ |
| Rev match, load-sensitive audio, advanced transients | — | ✓ |
| Phone sensor pairing | — | ✓ |
| Advanced controls (remote, tuning depth) | Basic | ✓ |
| Studio / Garage / Demo | ✓ (keep low friction) | ✓ |
| Tesla Fleet Telemetry | Optional future | Optional future |
| AI Find Sound / Coach | Optional future gate | ✓ or quota |

---

## 16. Minimum-risk integration plan (phased)

**Do not implement in one refactor.** Suggested order:

| Phase | Scope | Production behavior change |
| ----- | ----- | --------------------------- |
| **0** | This audit + entitlement types + feature manifest (no gates) | None |
| **1** | DB schema + Account (magic link) + `getEntitlementsFn` returning FREE for all | None visible |
| **2** | Stripe Checkout + webhook → EntitlementService; Customer Portal | Opt-in beta |
| **3** | Feature gates: catalog tier + `dynamicDrive` + relay create | Soft launch |
| **4** | FREE DD preview mode + upsell UX (premium, low-friction) | Launch |
| **5** | Analytics, trial, past_due grace, admin tools | Post-launch |

Each phase shippable behind `ELCAMOSO_BILLING_ENABLED` server flag default **off** until ready.

---

## 17. Security checklist

- [ ] Stripe secret key and webhook secret **server-only**
- [ ] Webhook handler verifies `Stripe-Signature`; idempotent event processing
- [ ] Price IDs loaded from env; client receives Checkout **session URL** only
- [ ] `getEntitlementsFn` derives plan from DB, not from client claims
- [ ] CSRF remains on mutating server fns; webhook route excluded appropriately
- [ ] Fail **closed** on upgrade (never grant DRIVE+ without proof), **open** on downgrade errors (FREE still drives)
- [ ] No subscription state in `localStorage` as authority (cache OK with TTL + revision)

---

## 18. Files to touch (implementation reference)

| Concern | Current | New / extended |
| ------- | ------- | -------------- |
| Settings schema | `src/lib/drive/settings.ts` | Optional `entitlementRevision` cache fields |
| Entitlements | — | `src/lib/entitlements/*` |
| Billing | — | `src/lib/billing/*` |
| Gates | `SessionBridge`, `settings.tsx`, `sounds.tsx`, `drive.tsx`, `DriveSessionPanel` | `src/lib/entitlements/gates.ts` |
| Catalog | `profiles.ts` | `catalog-manifest.ts` or profile `catalogTier` |
| Docs | This file | `docs/monetization-entitlements.md` (phase 1) |

**Do not modify** `session.ts` RAF loop for billing. Gate inputs only.

---

## 19. Open product decisions (before implementation)

1. Exact FREE essential profile list (5 vs 8).
2. Dynamic Drive preview shape: time limit, single profile, or feature-cap (e.g. no downshift transients).
3. Account requirement before checkout vs guest checkout → link later.
4. Trial length (7/14 days) and grace on `past_due`.
5. Whether yearly plan is default in upsell UI.
6. Phone relay on FREE for existing users during migration (grandfathering).

---

## 20. Related documentation

| Doc | Relevance |
| --- | --------- |
| `elcamoso-comprehensive-spec.md` | Product identity, ELCAMOSO Cloud naming |
| `docs/DYNAMIC_DRIVE_ARCHITECTURE.md` | DRIVE+ technical core |
| `docs/drive-relay-sessions.md` | Phone pairing |
| `docs/SOUND_CHARACTER_SPEC.md` | Profile engagement |
| `AGENTS.md` | Do not break remote branch; thin server fns |

---

## 21. Audit conclusion

ELCAMOSO is **ready for a clean entitlement-first monetization layer** without rewriting Drive. The highest-risk gaps are **lack of persistent storage** and **lack of account identity** — both must precede Stripe webhooks. Stripe should be wired **only** through a webhook → EntitlementService path; the app should read **EntitlementService** everywhere, never Stripe directly in product UI.

**Until phased implementation begins: no production behavior changes.**
