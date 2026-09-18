# Billing and entitlement security

Security model for ELCAMOSO Drive+ billing, trials, and premium assets. This document describes **actual controls and known limits** — not DRM guarantees.

ELCAMOSO runs procedural Web Audio in the browser. A determined user can always patch client code or invoke browser APIs directly. Server-side billing exists to keep **accounts, subscriptions, trials, and file delivery** honest — not to make the browser tamper-proof.

---

## Threat model (summary)

| Asset                   | Authority                                                                                             | Client bypass risk                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Stripe secrets          | Server env only                                                                                       | N/A if env stays server-side                                                                    |
| Subscription / Drive+   | Stripe webhooks + local store                                                                         | UI gates bypassable; file delivery gated server-side                                            |
| Dynamic Drive trial     | Server trial service                                                                                  | Procedural audio bypassable client-side                                                         |
| Account sessions        | HttpOnly cookie `elcamoso_account_session` (Secure in production, SameSite=Lax); server session store | Cookie theft still possible via XSS on non-HttpOnly siblings; session token itself is not in JS |
| Premium sound files     | Signed URLs + manifest entitlement check                                                              | Signed URL is a bearer token until expiry                                                       |
| Tesla upgrade QR tokens | Server in-memory store                                                                                | Single-use + TTL; lost on restart                                                               |

---

## Stripe secret exposure

**Controls**

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and Stripe Price IDs are read from `process.env` in server modules only (`src/lib/billing/stripe/`).
- No `VITE_*` Stripe variables. Checkout requests send plan **slugs** (`drive_plus` + `monthly|yearly`), never Price IDs.
- `getBillingPublicConfig()` exposes display prices and plan slugs only.

**Residual risk**

- Misconfigured bundling that imports server Stripe modules into client code would leak env reads at build time. Keep Stripe client usage in server routes and server functions only.

**Tests:** `src/lib/billing/security.test.ts` (server-resolved price ids)

---

## Webhook signature verification

**Controls**

- `src/routes/api/stripe/webhook.ts` reads **raw body** via `request.text()`.
- `constructStripeWebhookEvent()` uses Stripe SDK `webhooks.constructEvent(rawBody, signature, secret)`.
- Missing or invalid `Stripe-Signature` → HTTP 400.

**Residual risk**

- Middleware that parses JSON before the handler would break verification — webhook route must stay raw-body.

---

## Price ID tampering

**Controls**

- Checkout: client sends slugs; server maps to env Price IDs in `beginDrivePlusCheckout()`.
- Webhook sync: `syncStripeSubscriptionRecord()` rejects subscriptions whose first line item Price is **not** in configured Drive+ env ids (`isKnownDrivePlusStripePrice`).
- `resolvePlanFromMetadata()` no longer defaults to Drive+ — plan requires known Price or explicit metadata.

**Fix applied:** removed `resolvePlanFromMetadata` always returning `DRIVE_PLUS`.

---

## Entitlement tampering

**Controls**

- Authoritative snapshot: `resolveEntitlementUser()` (subscription store + trial overlay).
- Premium **mutations** (trial session start, relay join, dynamic drive claim) call `assertServerEntitlement()` on the server.
- Drive+ checkout and portal derive `userId` from session token, never from client-supplied user ids.

**Known limit (accepted)**

- `beginLiveDriveAccess()` and procedural synthesis run client-side. DevTools can enable premium **UI and Web Audio paths** without payment. This does not grant server-backed assets or durable subscription state.
- Client gates (`EntitlementGate`, `PremiumFeatureGate`) are UX — not security boundaries for procedural audio.

**Do not claim:** tamper-proof premium audio in the browser.

---

## Trial manipulation

**Controls**

- Trial start requires authenticated session (`resolveAuthenticatedUserId`).
- Time credit uses **server `Date.now()`** only — client clocks ignored (`credit.ts`).
- Per-heartbeat cap (`DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS`, 45s) limits background abuse.
- Session/device conflict rules in trial service.
- **Heartbeat re-checks `dynamic_drive` entitlement** — credits stop after entitlement revocation.

**Removed:** public `completeDynamicDriveTrialFn` (users could self-mark trial converted without payment). Conversion happens via Stripe webhook only.

**Production gap**

- Trial ledger is in-memory unless Postgres repository is wired. Restarts or multi-instance deploy can reset preview state. Wire Postgres before horizontal scale (schema exists in `src/lib/db/schema.ts`).

---

## Session token predictability

**Controls**

- Session tokens: `randomBytes(32)` base64url (~256 bits).
- Magic links: hashed at rest (SHA-256); single-use, 15 min TTL.
- **Sessions now stored keyed by SHA-256 hash**, not raw bearer token in the Map key.

**Residual risks**

- Session store is in-memory — not durable across restart/multi-instance (same as trials).
- Bearer / `x-elcamoso-session` headers still accepted on some API routes for compatibility; primary browser auth is the **HttpOnly** session cookie (not localStorage).

---

## Upgrade token replay (Tesla QR)

**Controls**

- Tokens: `randomBytes(24)` base64url, 15 min TTL.
- Single-use: `completeTeslaUpgradeToken()` → `status: completed`.
- `bindUserToTeslaUpgradeToken()` rejects wrong account when token pre-bound to car session user.
- Checkout metadata carries `upgradeToken`; webhook completes token and pushes relay update.

**Fix applied:** `resolveTeslaUpgradeTokenFn` no longer returns `userId` or `clientDriveSessionId` to unauthenticated callers.

**Production gap**

- In-memory token store — not shared across instances; restart clears pending tokens.

---

## IDOR and subscription ownership

**Controls**

- Billing/trial endpoints derive user from `sessionToken` — no `userId` in client body for entitlement changes.
- Admin diagnostics require `ELCAMOSO_BILLING_ADMIN_SECRET` (`src/lib/billing/admin/auth.ts`).
- **Fix applied:** `resolveUserIdForStripeCustomer()` prefers Stripe customer → user mapping; rejects metadata `userId` that conflicts with customer owner.
- Checkout completion resolves user: customer mapping first, then metadata / `client_reference_id`.

**Fix applied:** `getBillingHealthFn` no longer returns **global** failed webhook events to any authenticated user (admin diagnostics only).

---

## Premium asset authorization

**Controls**

- Manifest: `buildSoundAssetManifest()` checks `all_sound_profiles` server-side before signing URLs.
- Delivery: HMAC-SHA256 signed paths (`src/lib/sound-assets/signing.ts`), `timingSafeEqual` verification, path traversal blocked.
- Premium files must not live under `/public`.

**Known limit**

- Signed URL is a **bearer credential** until expiry (~30 min). Anyone with the URL can fetch the file. Short TTL reduces sharing window; user binding in signature is optional future hardening.

**Do not claim:** perfect DRM or non-extractable samples in a web browser.

---

## Concurrent sessions and race conditions

**Controls**

- Trial + dynamic drive session services enforce one active drive lease per user with stale takeover.
- Webhook idempotency: event id ledger (`claim` → `markSucceeded` / `markFailed`).

**Fix applied**

- Postgres webhook `claim()` uses `INSERT … ON CONFLICT DO NOTHING` and treats concurrent `processing` as duplicate.
- Memory webhook store treats `processing` as duplicate to avoid double-handle in single process.

**Production gap**

- In-memory subscription/trial/session stores have no cross-process locking — use Postgres repositories for multi-instance.

---

## Client clock manipulation

**Controls**

- Trial heartbeats ignore client timestamps; server assigns `now`.
- Subscription period evaluation uses server time in `evaluateSubscriptionAccess()`.

No significant clock-skew attack surface on trial credit.

---

## Webhook replay

**Controls**

- Stripe signature includes timestamp (SDK default tolerance ~300s).
- Event id deduplication via webhook event store.
- Duplicate `succeeded` events → skipped (`duplicate: true`).
- Handler failure → `markFailed`, HTTP 500, Stripe retries.

**Fix applied:** atomic claim reduces double-processing race before `markSucceeded`.

**Production requirement:** `DATABASE_URL` with Postgres webhook ledger — memory store loses dedup on restart.

---

## Checkout redirect safety

**Controls**

- **Fix applied:** `assertAllowedCheckoutOrigin()` — production requires `ELCAMOSO_ALLOWED_ORIGINS` or origin host matching request `Host`.
- Development allows localhost without allowlist.

Configure for production:

```env
ELCAMOSO_ALLOWED_ORIGINS=https://app.elcamoso.com
```

---

## Security test suite

```bash
npm test -- --run src/lib/billing/security.test.ts
npm test -- --run src/lib/billing/stripe/webhook-processor.test.ts
npm test -- --run src/lib/billing/stripe/lifecycle.test.ts
```

---

## Production checklist

1. Set `ELCAMOSO_ALLOWED_ORIGINS` for checkout/portal return URLs.
2. Configure Stripe webhook endpoint with raw body; verify `STRIPE_WEBHOOK_SECRET`.
3. Use Postgres (`DATABASE_URL`) for webhook ledger, subscriptions, user billing, trials, sessions before multi-instance deploy.
4. Set `ELCAMOSO_BILLING_ADMIN_SECRET` only in dev/staging ops environments.
5. Set `SOUND_ASSET_SIGNING_SECRET` before shipping non-empty sound asset catalog.
6. Treat client premium audio as **best-effort UX gating**; treat webhooks as billing authority.

---

## Related docs

- `docs/billing/failure-resilience.md` — outage behavior
- `docs/billing/admin-diagnostics.md` — dev-only reconciliation
- `docs/billing/stripe-test-suite.md` — lifecycle tests
- `docs/billing/tesla-purchase-e2e.md` — QR upgrade flow and failure matrix
- `docs/premium-sound-asset-protection.md` — asset delivery limits
