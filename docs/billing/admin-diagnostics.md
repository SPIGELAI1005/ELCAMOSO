# Billing admin diagnostics

Restricted developer/ops tooling for inspecting and reconciling subscription state. **Never exposed to normal users** and **never allows arbitrary entitlement edits**.

## Access control

| Layer | Guard |
|-------|--------|
| Web UI | `/debug/billing` — `import.meta.env.DEV` only (redirects to `/` in production builds) |
| Server fns | `ELCAMOSO_BILLING_ADMIN_SECRET` required on every admin request |
| CLI | Same secret via environment variable |

Set the secret in local `.env`:

```bash
ELCAMOSO_BILLING_ADMIN_SECRET=your-long-random-secret
```

Without the secret, admin server functions reject all calls.

## Web UI

Open in development:

```
http://localhost:5173/debug/billing
```

1. Enter the admin secret (stored in sessionStorage for the dev session only).
2. Lookup by **internal user id (UUID)** or **email**.
3. Review the read-only snapshot.
4. Optionally run **Re-sync from Stripe** — explicit Stripe pull only; no manual entitlement overrides.

Also linked from `/debug` and Settings → Diagnostics panel (dev only).

## CLI

```bash
ELCAMOSO_BILLING_ADMIN_SECRET=… npm run billing:diagnostics -- 55555555-5555-4555-8555-555555555555
ELCAMOSO_BILLING_ADMIN_SECRET=… npm run billing:diagnostics -- driver@example.com
ELCAMOSO_BILLING_ADMIN_SECRET=… npm run billing:diagnostics -- --resync driver@example.com
```

Outputs JSON diagnostics (and reconcile result when `--resync` is used).

## Snapshot fields

| Field | Source |
|-------|--------|
| Internal plan | Local entitlement resolution |
| Entitlements | `buildEntitlementSnapshot` (plan + trial overlay) |
| Trial status | Dynamic Drive trial service |
| Stripe customer id | User billing repository |
| Stripe subscription id | Latest persisted subscription |
| Local subscription status | Runtime subscription store |
| Current period end | Runtime store, fallback to persisted |
| Last subscription update | Persisted subscription `updatedAt` (webhook sync proxy) |
| Failed webhooks | Webhook event store `listFailed` |

## Modules

- `src/lib/billing/admin/auth.ts` — secret verification
- `src/lib/billing/admin/diagnostics.ts` — read-only snapshot builder
- `src/lib/billing/admin/resolve-user.ts` — UUID / email lookup
- `src/lib/billing/admin/server-fns.ts` — admin server functions
- `src/routes/debug.billing.tsx` — dev-only UI
- `scripts/billing-diagnostics.ts` — CLI entry

## What this does not do

- No entitlement mutation endpoints
- No bypass of Stripe for premium gates
- No production route (UI is dev-gated; server still requires secret)
- No exposure in consumer Settings or Drive flows

See also: `docs/billing/failure-resilience.md`.
