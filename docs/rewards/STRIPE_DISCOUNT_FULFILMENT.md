# Stripe reward discount fulfilment (Prompt 13)

Applies Sound Spin `one_payment_discount` reservations through **existing** Stripe Checkout / subscription APIs. Feature is **off until configured**. Does **not** create live coupons or modify live subscriptions from application code.

Pinned Stripe API version: `2026-08-26.dahlia` (`ELCAMOSO_STRIPE_API_VERSION` in `src/lib/billing/stripe/client.ts`).

## Flags

| Variable | Default | Role |
| --- | --- | --- |
| `ELCAMOSO_REWARD_DISCOUNTS_ENABLED` | off | Master switch for apply/checkout attachment |
| `STRIPE_REWARD_COUPON_PERCENT_15` / `_20` | unset | Test-mode Coupon ids (`duration=once`, matching percent) |
| `STRIPE_REWARD_COUPON_PERCENT_MAP` | unset | Optional JSON map of additional percents → coupon ids |
| `ELCAMOSO_REWARD_DISCOUNT_FINALIZED_ALTERNATIVE` | `pending` | When upcoming invoice is already `open`/`paid`: `pending` or `ineligible` |
| `ELCAMOSO_REWARD_DISCOUNT_MIN_AMOUNT_CENTS` | unset | Optional subtotal floor |
| `ELCAMOSO_REWARD_DISCOUNT_CURRENCIES` | unset | Optional allowlist (comma ISO codes) |

Also requires Stripe billing config (`STRIPE_SECRET_KEY`, prices, webhook secret) and `MONETIZATION_ENABLED` for Checkout.

## Supported cases

### 1) Non-subscriber → new monthly Checkout

- Path: `beginDrivePlusCheckout({ rewardReservationId })`
- Interval must be **monthly** (annual Checkout rejected for rewards)
- Server resolves coupon from reservation percent; attaches `discounts: [{ coupon }]`
- Status → `applied` with checkout session id
- **Consumed only** on `invoice.paid` webhook proving the coupon/discount — not on success URL

### 2) Active monthly subscriber → one future payment

- Path: `applyRenewalRewardDiscount`
- Previews upcoming invoice (`invoices.createPreview`)
- Identifies draft target when possible; refuses stacking if preview already discounted
- If invoice already finalized (`open`/`paid`): configured alternative (`pending` or `ineligible`) — **never** alters a paid invoice
- Applies `duration=once` coupon via `subscriptions.update` with stable Idempotency-Key `reward-discount:{reservationId}:renewal-apply`
- Status → `applied` until paid invoice webhook → `consumed`

## Policy (explicit)

| Topic | Rule |
| --- | --- |
| Product/price | Drive+ **monthly** price only (`drive_plus_monthly`) |
| Interval | Month only; annual subscribers ineligible |
| Currency | Follows Stripe Price unless allowlist set |
| Expiry | Reservation `expiresAtUtc` |
| Non-stacking | Existing Stripe discount wins |
| Past-due / canceled | Ineligible for renewal path |
| Paid invoice | Never modified |
| Price / renewal date / plan | Never silently changed |
| Public promo codes | Not used (no globally reusable codes) |
| Customer ownership | From verified session + `user_billing` mapping; posted customer ids rejected on mismatch |

## Lifecycle

`reserved` → `applied` | `pending` | `ineligible` | `failed` | `expired` → `consumed` (only after paid invoice proof)

Failed payment returns `applied` → `reserved` for retry within expiry. Subscription deletion before consume → `ineligible`.

## Operator setup (test mode, no secrets)

1. In Stripe **Test** Dashboard, create Coupons:
   - `duration = once`
   - `percent_off = 15` and `20` (match campaign)
   - Optionally restrict `applies_to` to the Drive+ monthly product
2. Copy Coupon ids into `STRIPE_REWARD_COUPON_PERCENT_15` / `_20` (or the JSON map).
3. Confirm webhook endpoint verifies signatures (existing `/api/stripe/webhook` raw-body path).
4. Set `ELCAMOSO_REWARD_DISCOUNTS_ENABLED=1` in the target environment only after the above.
5. Smoke: non-subscriber monthly Checkout with reservation; active monthly apply; confirm reservation becomes `consumed` only after `invoice.paid`.

## Rollback

1. Set `ELCAMOSO_REWARD_DISCOUNTS_ENABLED=0` (immediate stop of new applies).
2. Leave Coupon objects in Stripe Test mode unused (do not delete if historical invoices reference them).
3. Do not run Coupon create/update against **live** mode from this app.
4. Reservations already `applied` remain until invoice outcome; new Checkout will not attach rewards while the flag is off.

## Tests

`src/lib/rewards/discount/discount.integration.test.ts` (mocked Stripe ops / Checkout):

- First purchase monthly Checkout + expected totals (1000 → 850 at 15%)
- Existing monthly subscriber apply
- Duplicate redemption
- Other customer's reservation
- Posted customer mismatch
- Expired reward
- Conflicting discount
- Finalized invoice → pending
- Timeout retry with stable idempotency key
- Webhook consume + replay
- Failed payment release
- Annual ineligible
- Terms preview

Signature verification and event-id idempotency remain covered by `webhook-processor.test.ts`.
