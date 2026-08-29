# Billing failure resilience

ELCAMOSO treats **local subscription and entitlement state** as the authority for Drive and premium feature gates. Stripe is used only for checkout, portal, webhooks, and explicit reconciliation — never on every premium check.

## Principles

| Rule | Detail |
|------|--------|
| FREE Drive always works | Procedural audio and `basic_drive` / `basic_sound_profiles` never depend on Stripe or Postgres |
| Local-first gates | `getSubscriptionForUser()` + `resolveLocalSubscriptionAccess()` — no live Stripe calls |
| Webhooks update async | Stripe events provision the in-memory store; durable DB upsert is best-effort |
| Checkout / portal explicit | User-initiated only; transient Stripe errors surface as `BillingServiceUnavailableError` |
| Reconciliation is opt-in | `reconcileBillingFn` pulls from Stripe when ops or the user explicitly requests it |

## Architecture

```
Stripe webhook ──► subscription-sync ──► persistAndProvisionSubscription
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
                 subscription-store (runtime)              repository upsert
                 entitlement provision                     (Postgres, optional)
                         │
                         ▼
              premium gates / Drive audio / session licensing
              (local only — never Stripe)
```

### Key modules

| Module | Role |
|--------|------|
| `src/lib/billing/resilience/local-access.ts` | Local-only Drive+ access resolution |
| `src/lib/billing/resilience/persist-subscription.ts` | Always provisions entitlements; DB optional |
| `src/lib/billing/resilience/stripe-errors.ts` | Transient Stripe detection + user-safe errors |
| `src/lib/billing/resilience/reconciliation.ts` | Health snapshot + explicit Stripe pull |
| `src/lib/billing/stripe/subscription-guard.ts` | Checkout guard — local store only |
| `src/lib/billing/server-fns.ts` | `getBillingHealthFn`, `reconcileBillingFn` |

## Failure scenarios

| Scenario | User impact | System behavior |
|----------|-------------|-----------------|
| **Stripe API unavailable** | Checkout / portal may fail with “Billing is temporarily unavailable” | Drive and entitlements unchanged; no Stripe on gates |
| **Webhook delayed** | Premium may lag until event arrives | FREE Drive works; user stays on prior local plan until webhook |
| **Webhook duplicated** | None | Idempotent `claim()` in webhook event store skips re-processing |
| **Payment failure** | Billing UI shows payment issue; Drive+ retained during grace | `past_due` + `DRIVE_PLUS_PAST_DUE_GRACE_DAYS` (default 7) |
| **Customer portal unavailable** | Manage subscription link fails gracefully | Local entitlements unchanged |
| **Expired Checkout session** | User returns with `?billing=cancel`; no upgrade | No entitlement change until `checkout.session.completed` webhook |
| **Subscription canceled** | Plan shows canceling / FREE after period end | Local store updated via webhook; live-drive hold defers mid-drive downgrade |
| **Subscription renewed** | Drive+ continues | `invoice.paid` / subscription.updated refreshes local period |
| **Database temporarily unavailable** | None for Drive | Webhook still provisions memory entitlements; `persisted: false` logged |

## Reconciliation tools

### Health snapshot

`getBillingHealthFn` (authenticated) returns:

- `stripeConfigured`
- `localPlan` / `localAccessReason`
- `hasStripeCustomer` / `providerSubscriptionId`
- `failedWebhookCount`
- recent failed webhook events (when store supports `listFailed`)

### Explicit Stripe pull

`reconcileBillingFn` (authenticated):

1. Resolves linked Stripe customer
2. Lists latest subscription from Stripe
3. Runs `syncStripeSubscriptionById` → local store + entitlements

Never called from Drive, audio, or entitlement middleware.

## Live Drive hold

When a user is mid-drive, `live-drive-access` retains premium entitlements captured at session start even if billing downgrades locally. After the session ends, local state applies.

## Testing

`src/lib/billing/resilience/failure-resilience.test.ts` simulates the scenarios above without live Stripe.

Run:

```bash
npm test -- --run src/lib/billing/resilience/failure-resilience.test.ts
```

## Environment

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Checkout, portal, reconciliation |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |
| `DRIVE_PLUS_PAST_DUE_GRACE_DAYS` | Grace before past_due revokes Drive+ (default 7) |
