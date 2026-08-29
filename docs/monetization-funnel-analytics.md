# Monetization funnel analytics

**Status:** Implemented on existing ELCAMOSO telemetry (2026-08-29)

**Related:** `src/lib/telemetry/analytics.ts`, `src/lib/telemetry/monetization-analytics.ts`, `docs/monetization-audit.md`

---

## Principles

- Uses the **existing client telemetry pipeline** — no new vendor.
- Events flow: `trackMonetizationEvent` → `elcamoso:analytics` → localStorage queue → `ingestTelemetryFn` (when Usage insights is on).
- Stripe webhook events use the same ingest store via `recordServerMonetizationEvent` (`installId: "server"`).
- **Never** attach GPS, routes, raw vehicle telemetry, or accelerometer samples.

Allowed meta fields: `source`, `plan`, `interval`, `context`, `milestone`.

---

## Funnel events

| Event | When | Typical source |
| ----- | ---- | -------------- |
| `pricing_viewed` | `/pricing` mount | `pricing` |
| `dynamic_trial_offered` | Trial offer UI shown | `pricing`, `trial_offer`, `settings` |
| `dynamic_trial_started` | User activates preview | `trial_offer`, `account_callback` |
| `dynamic_trial_session_started` | Server trial drive session begins | `drive` |
| `dynamic_trial_session_completed` | Trial drive session ends | `drive` |
| `dynamic_trial_low_remaining` | 10 / 5 / 1 min milestone nudge | `drive` |
| `dynamic_trial_exhausted` | Preview time or sessions exhausted | `drive` |
| `premium_feature_clicked` | Locked premium feature opened | `sounds`, `locked_sound` context |
| `upgrade_clicked` | Upgrade CTA tapped | `pricing`, `settings_plan`, `upgrade_prompt_*` |
| `plan_interval_selected` | Monthly / annual chosen at checkout | same as checkout source |
| `checkout_started` | Redirect to Stripe Checkout | `pricing`, `trial_complete`, `cockpit_upgrade` |
| `checkout_completed` | Stripe return `?billing=success` or webhook | `settings_plan`, checkout `source` metadata |
| `checkout_canceled` | Stripe return `?billing=cancel` | `settings_plan` |
| `subscription_started` | Webhook `checkout.session.completed` | checkout `source` metadata |
| `subscription_canceled` | Webhook subscription deleted | `billing` |

---

## Meta fields

| Field | Values | Notes |
| ----- | ------ | ----- |
| `source` | `pricing`, `settings_plan`, `drive`, `sounds`, `trial_complete`, `cockpit_upgrade`, `upgrade_prompt_*`, … | Where the user acted |
| `plan` | `free`, `drive_plus` | Commercial plan at event time |
| `interval` | `monthly`, `yearly` | When checkout / subscription relevant |
| `context` | `locked_sound`, `dynamic_drive`, `phone_pairing`, … | Premium gate context |
| `milestone` | `10`, `5`, `1` | Trial low-remaining minutes |

Stripe checkout copies `source` and `interval` into session metadata for webhook correlation.

---

## Funnel diagram

```
pricing_viewed
    ├── dynamic_trial_offered → dynamic_trial_started
    │       └── dynamic_trial_session_started
    │               ├── dynamic_trial_low_remaining (10/5/1)
    │               ├── dynamic_trial_session_completed
    │               └── dynamic_trial_exhausted
    │
    ├── premium_feature_clicked (sounds, gates)
    │       └── upgrade_clicked
    │
    └── plan_interval_selected → checkout_started
            ├── checkout_completed → subscription_started
            └── checkout_canceled
                    └── subscription_canceled (later, via portal)
```

---

## Privacy

| Included | Excluded |
| -------- | -------- |
| Anonymous `installId` | User email |
| Coarse `source` strings | Stripe customer / subscription ids in events |
| Plan + interval slugs | Webhook payload bodies |
| Trial milestone minutes | Exact route, GPS, motion traces |

Usage insights must be **enabled** in Settings → Privacy for client events to leave the device. Server webhook events are recorded regardless (aggregate billing funnel only).

---

## Implementation map

| Area | File |
| ---- | ---- |
| Event types + sanitizer | `src/lib/telemetry/monetization-analytics.ts` |
| Client queue | `src/lib/telemetry/analytics.ts` |
| Flush bridge | `src/components/TelemetryBridge.tsx` |
| Server ingest | `src/lib/telemetry/store.ts` |
| Webhook funnel | `src/lib/billing/stripe/subscription-sync.ts` |
| Pricing | `src/routes/pricing.tsx` |
| Trial UX | `DynamicDriveTrialOffer`, `TryDynamicDriveButton`, `DynamicDriveTrialBridge`, `DynamicDriveTrialDuringDrive` |
| Upgrade CTAs | `UpgradePrompt`, `DrivePlusCheckoutButton`, `BillingSettingsPanel` |
| Locked sounds | `src/routes/sounds.tsx` |

---

## Querying (dev)

Telemetry batches land in the in-memory `telemetryLog` via `ingestTelemetry`. Filter events where `name` matches monetization funnel list. Production should export the same schema to your analytics backend without adding a second client SDK.
