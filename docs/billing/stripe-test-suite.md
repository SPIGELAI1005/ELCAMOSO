# Stripe test suite

ELCAMOSO billing tests use **Stripe test mode** (`sk_test_*` keys). Local entitlements are verified after every lifecycle event — never via live Stripe on feature gates.

## Unit lifecycle suite (always runs)

`src/lib/billing/stripe/lifecycle.test.ts`

| Scenario                      | Test                                                     |
| ----------------------------- | -------------------------------------------------------- |
| New monthly subscription      | `checkout.session.completed` → Drive+ active             |
| New annual subscription       | Yearly price + interval `year`                           |
| Duplicate checkout prevention | Active subscriber → portal, no new Checkout              |
| Successful payment            | `invoice.paid` → active                                  |
| Failed payment                | `invoice.payment_failed` → `past_due` with grace         |
| Renewal                       | `invoice.paid` with advanced period end                  |
| Cancel at period end          | `cancel_at_period_end: true` → Drive+ retained           |
| Immediate cancellation        | `customer.subscription.deleted` → FREE                   |
| Payment method update         | `subscription.updated` (active) → entitlements unchanged |
| Customer portal               | `createStripePortalSession` happy path                   |
| Webhook replay                | Duplicate event id → idempotent                          |
| Webhook out-of-order          | Cancel pending then renewal; delete after active         |
| Subscription expiration       | Canceled + past period → FREE                            |

Shared fixtures: `src/lib/billing/stripe/test-fixtures.ts`

```bash
npm test -- --run src/lib/billing/stripe/lifecycle.test.ts
```

## Related unit tests

| File                                    | Coverage                                         |
| --------------------------------------- | ------------------------------------------------ |
| `checkout-service.test.ts`              | Checkout params, customer reuse, portal redirect |
| `webhook-processor.test.ts`             | Signature, idempotency, paused/resumed           |
| `resilience/failure-resilience.test.ts` | Stripe down, DB down, delayed webhooks           |
| `subscription-access-policy.test.ts`    | Grace, cancel-at-period-end policy               |

## Live integration (optional)

Skipped unless env has real test-mode keys:

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_DRIVE_PLUS_MONTHLY=price_…
STRIPE_PRICE_DRIVE_PLUS_YEARLY=price_…
```

| File                            | What it runs                   |
| ------------------------------- | ------------------------------ |
| `checkout.integration.test.ts`  | Creates real Checkout Sessions |
| `lifecycle.integration.test.ts` | Stripe Test Clocks (see below) |

```bash
npm test -- --run src/lib/billing/stripe/checkout.integration.test.ts
```

## Stripe Test Clocks (optional live)

When `STRIPE_LIFECYCLE_TEST_CLOCK=1` and test-mode keys are set:

`lifecycle.integration.test.ts` runs live clock tests:

1. Create test clock + customer + monthly subscription
2. Sync → verify local Drive+ entitlements
3. Advance clock → verify renewal period + entitlements
4. Cancel at period end → advance past period → verify FREE

```bash
STRIPE_LIFECYCLE_TEST_CLOCK=1 npm test -- --run src/lib/billing/stripe/lifecycle.integration.test.ts
```

Test clocks require a Stripe test-mode account with Test Clocks enabled. Runs are slow (clock advance polling) and hit the real Stripe API.

## Entitlement verification

Every lifecycle test calls `assertLocalEntitlements()` which checks:

- Runtime subscription store (`getSubscriptionForUser`)
- Access policy (`resolveLocalSubscriptionAccess`)
- Entitlement snapshot (`buildEntitlementSnapshot`) for `basic_drive` / `dynamic_drive` etc.

## CI recommendation

- **Always:** `lifecycle.test.ts`, `webhook-processor.test.ts`, `checkout-service.test.ts`
- **Optional nightly:** live integration + test clocks with secrets in CI vault

See also: `docs/billing/failure-resilience.md`, `docs/billing/admin-diagnostics.md`.
