# Drive Cockpit V2 — release checklist (Prompt 14)

**Status:** reviewable integration pack — **not** automatically deployed.  
**Date:** 2026-10-11  
**Progress:** `docs/DRIVE_COCKPIT_V2_PROGRESS.md`  
**Device script:** `docs/device/DRIVE_COCKPIT_V2_DEVICE_TEST_SCRIPT.md`  
**Listening honesty:** `docs/audio/LISTENING_AND_ASSET_STATUS.md` (0/57 listening-verified unless updated by humans)

Do **not** claim: all-realistic sounds, live email OTP delivery, live Stripe discount application, or Tesla moving-cabin support unless specifically demonstrated below.

---

## 1. Environment / config steps

### Always (baseline)

| Step | Action |
| --- | --- |
| 1 | Deploy code with **opt-in flags off** (defaults below) |
| 2 | Apply additive DB migrations in order (section 2) |
| 3 | Set `ELCAMOSO_ENV` / Stripe / auth secrets per existing billing & account docs |
| 4 | Confirm `ELCAMOSO_ALLOWED_ORIGINS` for Checkout returns |
| 5 | Smoke: `/`, `/drive` Demo, `/sounds` free trio |

### Coordinated identity + billing activation

Auth and billing must not leave a half-migrated identity system.

| Order | Flag / system | Rule |
| --- | --- | --- |
| A | Account session cookie + Google / magic-link | Keep working; OTP is additive |
| B | `ELCAMOSO_EMAIL_OTP_ENABLED` (if used) | Enable only after Supabase OTP templates + redirect allowlist verified (`docs/account/EMAIL_OTP_SETUP.md`) |
| C | Stripe keys + prices + webhook | Configure **test** first; webhook signature on raw body |
| D | `MONETIZATION_ENABLED=1` | Only after C green; never enable Checkout without webhook + customer↔user mapping |
| E | `ELCAMOSO_REWARDS_ENABLED` | Only after grant/claim **Postgres persistence** is wired (currently in-memory — see gaps) |
| F | Campaign `enabled: true` | Explicit ops flip; staging illustrative odds are not production terms |
| G | `ELCAMOSO_REWARD_DISCOUNTS_ENABLED` | Only with test-mode coupon ids + E/F; never create live coupons from the app |

**Rollback half-migration:** turn off D→G first (monetization/rewards/discounts), keep A. Do not flip OTP off mid-flight without a session continuity plan.

### Default flag state (safe release)

| Flag | Default | Release note |
| --- | --- | --- |
| `MONETIZATION_ENABLED` | off | |
| `ELCAMOSO_REWARDS_ENABLED` | off | |
| Campaign `enabled` | false | |
| `ELCAMOSO_REWARD_DISCOUNTS_ENABLED` | off | |
| `VITE_DRIVE_AUDIO_V3` / `ELCAMOSO_DRIVE_AUDIO_V3` | off | |
| `VITE_CITY_SHIFT_PRESET` / `ELCAMOSO_CITY_SHIFT_PRESET` | off | City selectable; not forced default |
| `SYMPHONY_ENABLED` / `FUSION_ENABLED` / `WORLDS_ENGINE_ENABLED` | on | Experience engines |

---

## 2. Additive migration order

Apply in order; do not rewrite history.

| # | Migration | Purpose |
| --- | --- | --- |
| 0000 | `0000_init_account_billing.sql` | users / subscriptions |
| 0001 | `0001_dynamic_drive_trial.sql` | trial tables |
| 0002 | `0002_stripe_webhook_events.sql` | webhook idempotency ledger |
| 0003 | `0003_entitlement_grants.sql` | grant kinds + table |
| 0004 | `0004_reward_claims.sql` | campaigns / claims / reservations / themes |
| 0005 | `0005_reward_discount_fulfilment.sql` | reservation lifecycle columns + statuses |

**Data compatibility:** Settings in localStorage use versioned `sanitizeSettings`. Free-trio change does not revoke grandfathered grants when persistence exists. In-memory grants/claims **do not survive** process restart — treat rewards/discounts as staging-only until repositories write 0003–0005.

---

## 3. Flagged rollout order

1. Ship code, flags off → verify Drive Demo + free trio + access clamps.  
2. Enable City preset default only if product wants it (`VITE_CITY_SHIFT_PRESET`).  
3. Enable V3 only for pilot listening cohorts.  
4. Auth OTP staging → production after delivery proof.  
5. Monetization test → production.  
6. Rewards + discounts only after persistence + coupon ops checklist (`docs/rewards/*`).

---

## 4. Dependency ordering (runtime)

```
Motion → PowertrainSimulator (VT) → SoundEngine (one synth path)
Session / EntitlementsProvider → SessionBridge live-drive hold → EntitlementEnforcer
Stripe webhooks → subscription store → entitlement snapshot
Sound Spin claim → grant/reservation store → (optional) discount apply → invoice.paid consume
```

Audio paths are mutually exclusive (Symphony/World → V3 pilot → V2 hybrid → Dynamic Drive → legacy). No dual-graph mix on one profile.

---

## 5. Monitoring (minimal, non-sensitive)

Allowed examples: monetization event names already used (`checkout_completed`, etc.), webhook processed/duplicate counters, claim `status` transitions without PII.  
**Never** log motion traces, GPS, raw emails, Stripe secrets, or full session tokens.

---

## 6. Explicit rollback

| Layer | Action |
| --- | --- |
| Flags | Set monetization / rewards / discounts / V3 / City-default **off** |
| Audio | Users on V2/Current continue; V3 pilots fall back when flag off |
| Billing | Stop Checkout; portal may remain for existing customers |
| Rewards | `/rewards` unavailable message; no new claims |
| Discounts | No new applies; leave Stripe test coupons unused |
| DB | Do **not** drop migrations; forward-only |

---

## 7. Prompt 14 integration fixes landed

| Defect | Fix |
| --- | --- |
| Symphony/World/Fusion `access:"free"` bypassed free trio | Canonical `FREE_SOUND_PROFILE_IDS` wins in `resolveProfileAccess`; experience profiles marked `drive_plus` |
| Drive gating ignored experience entitlements | `canDriveProfileWithAccess` + `useFeatureAccess` |
| Mid-drive `fade_to_free` deferred | `EntitlementEnforcer` applies fade immediately |
| Live-drive hold profile grants unused | Merged into granted ids in selectors |
| Docs overstated resolver wiring | `ENTITLEMENTS.md` updated; persistence gap documented |

---

## 8. Automated checks run (this environment)

| Check | Result (2026-10-11) |
| --- | --- |
| `npx tsc --noEmit` | pass |
| `npm run build` | pass |
| Focused vitest (powertrain, entitlements, profile-access, rewards, stripe lifecycle/webhook) | **291** passed |
| Catalog / matrix ID coverage | **57/57** (no missing IDs) |
| Listening-verified promotion from metrics | **not done** (forbidden) |
| Live email delivery | **not demonstrated** |
| Live Stripe discount on real invoice | **not demonstrated** (mocks only) |
| Tesla moving cabin | **pending** |

---

## 9. Remaining manual checks

- Full headphone listening checklist (`LISTENING_AND_ASSET_STATUS.md`)
- Device script A–D on desktop, iPhone, Tesla parked
- Staging OTP real delivery
- Stripe test-mode coupon ops + one paid invoice consume
- Long soak: 20+ switches, tab suspend, worklet fallback on target devices
- Processing deadline / dropout notes per device (no universal CPU claim)

---

## 10. Feature readiness table

| Feature | Implemented | Automated | Listening | Actual-device | External config | Release flag |
| --- | --- | --- | --- | --- | --- | --- |
| Acoustic specs + catalog tuning (57) | yes | yes | no | pending | n/a | n/a |
| Virtual drivetrain / City maps | yes | yes | n/a | pending | City default optional | `VITE_CITY_SHIFT_PRESET` off |
| Drive Audio V3 pilots | yes | unit | no | pending | n/a | `VITE_DRIVE_AUDIO_V3` off |
| Sample hybrid bank | yes (empty) | yes | no | n/a | approved WAVs | assets awaiting |
| Shift audio choreography | yes | yes | no | pending | n/a | n/a |
| Gain staging / boost / mute | yes | unit | no | pending | n/a | n/a |
| Drive cockpit UI | yes | partial | n/a | pending | n/a | n/a |
| Email OTP | yes | mocks | n/a | pending delivery | Supabase templates | opt-in |
| Free trio + access resolver | yes | yes | n/a | pending | n/a | n/a |
| Offline lease fade_to_free | yes | unit | n/a | pending | n/a | n/a |
| Sound Spin rewards | yes | unit | n/a | pending | campaign config | `ELCAMOSO_REWARDS_ENABLED` off |
| Stripe reward discounts | yes | mocks | n/a | pending | test coupons | `ELCAMOSO_REWARD_DISCOUNTS_ENABLED` off |
| Monetization / Drive+ Checkout | yes | yes | n/a | pending | Stripe | `MONETIZATION_ENABLED` off |
| Tesla browser support | partial parked path | n/a | no | **pending moving** | vehicle SW notes | n/a |

---

## 11. Stop state

Concrete reviewable result:

- Integration defects above fixed in code.  
- Checklist + device script published.  
- Automated build/typecheck/focused tests green in this environment.  
- **No** automatic production deploy.  
- **No** claim of universal realism, live email, live discounts, or Tesla-while-moving support.
