# Billing tax readiness

**Status:** Architecture prepared · tax features **disabled by default** (2026-08-29)

**Related:** `src/lib/billing/stripe/tax-config.ts`, `src/lib/billing/checkout-service.ts`

---

## Important — not legal or tax advice

ELCAMOSO application code **does not** implement VAT rates, tax registrations, nexus rules, or invoice legal text.

**German / EU VAT configuration, Stripe Tax setup, and registration obligations must be confirmed by the business and tax owner before production.** Do not enable tax collection based on this document alone.

This repo prepares **Stripe Checkout parameters** that can be turned on via environment configuration after Stripe Dashboard and professional tax review are complete.

---

## Design principles

| Principle | Implementation |
| --------- | -------------- |
| No invented tax rates | No percentages or country tables in code |
| No registration assumptions | No DE/EU VAT ID logic in entitlements or checkout |
| Configurable by environment | Env flags; all off in dev by default |
| Stripe as calculator | When enabled, Stripe Tax / Checkout collect and calculate |
| Billing authority unchanged | Webhooks still provision entitlements; tax does not affect access logic |

---

## Environment configuration

All variables support optional `_STAGING` / `_PRODUCTION` suffixes (same pattern as `STRIPE_SECRET_KEY`).

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `STRIPE_CHECKOUT_AUTOMATIC_TAX` | off | Sets Checkout `automatic_tax.enabled=true` when `true` |
| `STRIPE_CHECKOUT_BILLING_ADDRESS_COLLECTION` | unset | `auto` or `required` → `billing_address_collection` |
| `STRIPE_CHECKOUT_TAX_ID_COLLECTION` | off | Sets `tax_id_collection.enabled=true` when `true` (B2B VAT ID, etc.) |
| `STRIPE_CHECKOUT_CUSTOMER_UPDATE` | auto when tax on | `auto` / `off` — persist name/address on Customer from Checkout |

### Example (staging — only after Stripe Tax is configured in Dashboard)

```env
STRIPE_CHECKOUT_AUTOMATIC_TAX=true
STRIPE_CHECKOUT_BILLING_ADDRESS_COLLECTION=auto
STRIPE_CHECKOUT_TAX_ID_COLLECTION=true
STRIPE_CHECKOUT_CUSTOMER_UPDATE=auto
```

### Development / local

Leave all tax variables **unset**. Checkout behaves as today (no automatic tax, no extra address or tax ID prompts).

---

## Code path

```
beginDrivePlusCheckout()
  └── buildCheckoutSessionTaxParams(readStripeCheckoutTaxConfig())
        └── merged into stripe.checkout.sessions.create({ ... })
```

Module: `src/lib/billing/stripe/tax-config.ts`

- `readStripeCheckoutTaxConfig()` — reads env
- `buildCheckoutSessionTaxParams()` — returns only the Stripe keys that are enabled
- `isStripeCheckoutTaxConfigured()` — helper for ops / diagnostics

Entitlements, subscription sync, and UI copy are **unchanged** by tax flags.

---

## Stripe Dashboard prerequisites (business-owned)

Before setting env flags in production:

1. **Stripe Tax** — enable in Stripe Dashboard; configure origin address and registrations per professional advice.
2. **Product / Price tax behavior** — confirm Drive+ Prices are compatible with Stripe Tax (Dashboard setting, not hard-coded here).
3. **Customer Portal** — if buyers must update tax IDs later, configure Portal tax ID settings in Stripe (Portal session creation is unchanged in code).
4. **Invoices & receipts** — Stripe-generated; legal wording and VAT display are Dashboard / account settings.
5. **Webhooks** — existing handlers remain sufficient for subscription state; no tax amount is stored in ELCAMOSO DB today.

---

## What ELCAMOSO does not store

- VAT percentages
- Tax registration numbers (except what Stripe holds on Customer)
- Billing addresses (Stripe Customer object)
- Tax calculation audit trail (Stripe reporting)

Future reporting needs should use **Stripe exports / Sigma**, not duplicated tax logic in-app.

---

## Pre-production checklist (tax owner)

- [ ] Legal entity and place of supply documented
- [ ] German / EU VAT registration status confirmed (if applicable)
- [ ] Stripe Tax enabled and tested with test Customers in DE + EU + non-EU
- [ ] B2B reverse-charge scenarios validated with tax advisor (if offering B2B)
- [ ] Env flags set only on staging first; verify Checkout UI and invoice totals
- [ ] Customer-facing pricing copy reviewed (gross vs net display — product/marketing, not code)
- [ ] Production env flags applied after sign-off

---

## Testing

Unit tests: `src/lib/billing/stripe/tax-config.test.ts`, `src/lib/billing/checkout-service.test.ts`

Use Stripe **test mode** Customers and [Stripe Tax test scenarios](https://stripe.com/docs/tax/testing) — do not use fabricated VAT rates in application tests.

---

## Related docs

- `docs/monetization-audit.md` — commercial model
- `docs/monetization-funnel-analytics.md` — checkout funnel events (no tax fields)
- `docs/billing/tax-readiness.md` — this file
