# Subscription access policy

ELCAMOSO grants **Drive+** from normalized local subscription state. Stripe webhooks update that state; browser checkout redirects are never trusted for access.

Policy implementation: `src/lib/billing/subscription-access-policy.ts`.

## Drive+ granted when

| Condition                                                         | Access               |
| ----------------------------------------------------------------- | -------------------- |
| `status == active`                                                | Yes                  |
| `status == trialing`                                              | Yes                  |
| `status == past_due` and within grace period                      | Yes                  |
| `cancelAtPeriodEnd == true` and `now < currentPeriodEnd`          | Yes until period end |
| `status == canceled` but `now < currentPeriodEnd` (scheduled end) | Yes until period end |

## Drive+ denied (FREE entitlements)

| Condition                              | Access |
| -------------------------------------- | ------ |
| `status == canceled` and period ended  | No     |
| `status == past_due` and grace expired | No     |
| `status == paused`                     | No     |
| No subscription / `plan == FREE`       | No     |

## Past due grace

Payment failure must not immediately interrupt driving.

- Configured via `DRIVE_PLUS_PAST_DUE_GRACE_DAYS` (default **7**).
- Grace starts when status first becomes `past_due` (`pastDueSince` on the local record).
- After grace expires, entitlements return to FREE until payment is restored via webhook.

## Cancel at period end

When a user cancels but keeps access until the billing period ends:

- Stripe typically keeps `status == active` with `cancel_at_period_end == true`.
- Access continues until `currentPeriodEnd`.
- After that timestamp, webhooks normalize to canceled and entitlements revert to FREE.

## Active Drive session safety

Entitlement refresh must not cut audio mid-drive.

1. **On Drive start** — `SessionBridge` commits the current entitlement set (`beginLiveDriveAccess`).
2. **During live Drive** (`kind == drive` and session running/suspended/starting):
   - Audio and motion config keep committed Drive+ capabilities even if billing state downgrades.
   - Settings downgrades are **deferred** (`EntitlementEnforcer` + `deferSettingsClampUntilDriveEnds`).
3. **On Drive stop** — hold releases; deferred downgrades apply; user returns to Basic Drive if access expired.

This avoids violent gain cuts, profile swaps, or Dynamic Drive toggles while the vehicle is in motion.

## Authority chain

```
Stripe webhook → normalize Subscription → access policy → provisionEntitlements → entitlement runtime
```

Never:

- Grant Drive+ from checkout success URL alone
- Read Stripe directly in UI gates
- Apply settings downgrades during an active Drive audio session

## Reconciliation fields

Local `Subscription` records store:

- `providerCustomerId` (Stripe Customer)
- `providerSubscriptionId` (Stripe Subscription)
- `status`, `interval`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`

Webhook idempotency prevents duplicate rows when events replay.
