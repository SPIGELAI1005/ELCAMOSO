# Tesla in-car purchase — end-to-end test scenario

Full path: **FREE user on Tesla browser** → Dynamic Drive preview → upgrade CTA → QR on car → phone checkout → Stripe webhook → entitlements → relay push → Drive+ without page reload.

**Integration tests:** `src/lib/tesla-upgrade/purchase-flow.integration.test.ts`  
**Playwright shell:** `e2e/tesla-purchase.spec.ts`  
**Field checklist:** `docs/TESLA_BROWSER_SMOKE_TEST.md` §8

---

## Preconditions

| Item          | Requirement                                                                    |
| ------------- | ------------------------------------------------------------------------------ |
| Tesla browser | `/drive?cockpit=1` (cockpit / safety layout)                                   |
| Account       | Signed in on Tesla (session token available)                                   |
| Billing       | Stripe test mode configured (`STRIPE_SECRET_KEY`, price IDs, webhook secret)   |
| Phone relay   | Optional but recommended — display peer on Tesla, phone peer linked for motion |
| Trial         | User has not consumed preview (`available` or `active` trial)                  |

---

## Happy path (step by step)

### 1. FREE user opens ELCAMOSO on Tesla

- Navigate to `/drive?cockpit=1` while parked.
- User plan is **FREE** — no `dynamic_drive` from subscription.
- Start Drive with Dynamic Drive enabled (preview or settings).

**Verify:** entitlements resolve to `FREE`; trial overlay can grant preview access after activation.

### 2. Starts Dynamic Drive preview

- User activates preview (`startPreview`) — status `active`, 30 min / 3 sessions.
- Entitlements overlay grants `dynamic_drive` while trial is active.

**Verify:** sound uses Dynamic Drive path; trial UI shows remaining time.

### 3. Active drive session on Tesla

- Client claims `driveSessionId` (tab-scoped).
- Trial `startDriveSession` binds session lease.
- Phone may join relay (`/connect/{id}`) as optional controller.

**Verify:** same `driveSessionId` resumes on reload; heartbeat credits time (45 s max gap).

### 4. Trial nearly expires — upgrade CTA

- Heartbeats consume allocation until remaining ≤ 10 minutes.
- `DynamicDriveTrialDuringDrive` surfaces one-time milestone nudges at **10**, **5**, and **1** minute thresholds.
- In cockpit, `UpgradePrompt` offers **Unlock on phone** → `/drive?cockpit=1&upgrade=drive-plus`.

**Verify:** milestone message appears once per threshold; CTA does not block driving.

### 5. Tesla displays QR

- `TeslaDrivePlusUpgrade` opens (via `upgrade=drive-plus` search param or explicit open).
- `createTeslaUpgradeTokenFn` mints 15-minute token bound to `clientDriveSessionId` + optional `relaySessionId`.
- QR encodes `{origin}/upgrade/{token}`.

**Verify:** QR renders; token status `pending`; no card fields on Tesla.

### 6. Phone scans QR

- Phone opens `/upgrade/{token}`.
- `resolveTeslaUpgradeTokenFn` validates token (not expired, status `pending`).

**Verify:** upgrade landing shows price and **Unlock Drive+** when billing is configured.

### 7. User logs in if needed

- Unsigned phone user sees `AccountSignInDialog`; return path preserves token URL.
- After sign-in, `bindUserToTeslaUpgradeToken` ties token to session user.

**Verify:** wrong account bind rejected (see failure matrix).

### 8. Stripe Checkout opens

- `beginTeslaUpgradeCheckoutFn` → `beginDrivePlusCheckout` with `source: tesla_upgrade`, `upgradeToken` in metadata.
- Browser redirects to Stripe Checkout (test card `4242…` in test mode).

**Verify:** checkout session metadata includes `userId`, `upgradeToken`, `source`.

### 9. Test payment succeeds

- User completes payment on phone.
- Stripe sends `checkout.session.completed` webhook.

**Verify:** webhook idempotency store accepts event once.

### 10. Stripe webhook updates subscription

- `dispatchStripeWebhookEvent` → subscription sync → local subscription store.
- Trial `completeTrial` / `converted` for user.
- `notifyTeslaUpgradeEntitlementGranted` completes token + pushes relay message.

**Verify:** `getSubscriptionForUser` → `DRIVE_PLUS`, status `active`.

### 11. Entitlements update

- `resolveEntitlementUser` returns `DRIVE_PLUS` + `dynamic_drive`.
- Client entitlement query invalidated on unlock.

**Verify:** no live Stripe call on entitlement gate (local store is authority).

### 12. Existing Drive Session receives realtime update

- Relay `entitlement-update` message to **display** peer only.
- `DriveSessionPanel` → `dispatchTeslaEntitlementUpdate`.
- `TeslaDrivePlusUpgrade` phase → `unlocked` (**Drive+ is ready**).

**Verify:** `relaySend` payload includes `plan: DRIVE_PLUS`, `upgradeToken`.

### 13. Dynamic Drive continues without page reload

- Same `driveSessionId` — `startDriveSession` returns `resumed: true`.
- Session claim returns `resumed: true`.
- Post-conversion heartbeats credit **0** trial seconds (paid path via `maybeConvertPaidSubscriber`).

**Verify:** audio/engine does not stop; no full navigation reload required.

---

## Failure state matrix

Each row: **what happens**, **user-visible behavior**, **recovery**, **test coverage**.

### Upgrade token (QR link)

| Failure                   | System behavior                                              | User sees                                        | Recovery                                        | Test                     |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------- | ------------------------ |
| Token expired (>15 min)   | `resolveTeslaUpgradeToken` → `valid: false`, `expired: true` | Phone: **Link expired** — scan fresh QR from car | Generate new QR on Tesla                        | `expired upgrade token`  |
| Unknown / garbage token   | No record                                                    | Phone: **Link expired**                          | Scan valid QR                                   | Playwright invalid token |
| Token already completed   | `valid: false`, `status: completed`                          | Phone: **Already unlocked**                      | Return to car; polling/relay should show unlock | —                        |
| Token already used (race) | `bindUserToTeslaUpgradeToken` throws                         | Checkout error                                   | New QR from Tesla                               | —                        |
| Server restart            | In-memory token store cleared                                | Phone: **Link expired**                          | New QR from Tesla                               | Documented limitation    |
| Multi-instance deploy     | Token minted on instance A, phone hits B                     | **Link expired**                                 | Sticky sessions or shared token store (future)  | Documented limitation    |

### Account binding (phone)

| Failure               | System behavior                                         | User sees                       | Recovery                 | Test                     |
| --------------------- | ------------------------------------------------------- | ------------------------------- | ------------------------ | ------------------------ |
| Not signed in         | `beginTeslaUpgradeCheckoutFn` throws                    | Sign-in dialog                  | Sign in, retry           | —                        |
| Wrong account         | Bind rejects mismatched `userId`                        | Error: same account as car      | Sign in with car account | `wrong account on phone` |
| Car session anonymous | Token created with `userId: null`; phone bind sets user | Works if phone account intended | Sign in before checkout  | —                        |

### Billing / Stripe checkout

| Failure                       | System behavior                                                             | User sees                                                             | Recovery                          | Test                   |
| ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------- | ---------------------- |
| Stripe not configured         | `createTeslaUpgradeTokenFn` throws; resolve shows `billingAvailable: false` | Tesla: **Could not start phone checkout**; phone: billing unavailable | Enable Stripe env                 | —                      |
| Already Drive+                | `beginDrivePlusCheckout` → portal, not duplicate sub                        | Redirect to **Manage subscription**                                   | Use existing plan                 | `already Drive+`       |
| Invalid checkout origin       | `sanitizeOrigin` throws                                                     | Checkout error                                                        | Valid HTTPS origin                | —                      |
| Checkout create fails         | Stripe API error wrapped                                                    | **Checkout unavailable**                                              | Retry; check Stripe dashboard     | Stripe lifecycle suite |
| User abandons checkout        | No webhook; token stays `pending`                                           | Stripe cancel page                                                    | Scan QR again (same or new token) | —                      |
| Payment fails (card declined) | No `checkout.session.completed`                                             | Stripe failure UI                                                     | Fix payment method, retry         | Stripe lifecycle suite |
| Duplicate checkout session    | Second webhook idempotent                                                   | Single subscription                                                   | Safe ignore                       | Stripe lifecycle suite |

### Webhook / entitlements

| Failure                        | System behavior                                  | User sees                                              | Recovery                              | Test                       |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------- | -------------------------- |
| Webhook delayed                | Plan stays FREE until event processed            | Car still preview; phone may show success after Stripe | Wait; car polls every 2.5 s           | `webhook delayed`          |
| Webhook signature invalid      | Event rejected                                   | No unlock                                              | Fix `STRIPE_WEBHOOK_SECRET`           | Stripe lifecycle suite     |
| Webhook DB write fails         | Local subscription may lag; resilience paths     | Car may stay preview briefly                           | Reconcile admin tool / webhook replay | `failure-resilience` suite |
| Payment OK but entitlement lag | Polling fallback on Tesla                        | QR overlay pending → unlock within ~2.5 s              | Automatic poll `getEntitlementsFn`    | TeslaDrivePlusUpgrade      |
| Trial exhausted before webhook | Preview ends; Drive+ still applies after webhook | Brief essential mode then Drive+                       | Complete payment quickly              | trial lifecycle suite      |

### Relay / realtime unlock

| Failure                           | System behavior                          | User sees                                    | Recovery                              | Test                            |
| --------------------------------- | ---------------------------------------- | -------------------------------------------- | ------------------------------------- | ------------------------------- |
| Relay not connected               | `pushEntitlementUpdateToDisplay` → false | No instant WS unlock                         | 2.5 s entitlement polling on car      | `relay disconnected`            |
| No relay session on token         | Token completes; no WS push              | Polling only                                 | Still unlocks via poll                | `payment succeeds but no relay` |
| Display peer disconnected         | Push fails                               | Polling fallback                             | Reconnect relay or wait for poll      | `relay disconnected`            |
| Phone-only relay (no display)     | Push fails — no display peer             | Polling fallback                             | Ensure Tesla tab connected as display | `relay disconnected`            |
| User closes upgrade overlay early | Event listener removed                   | Drive continues; poll still runs if reopened | Reopen upgrade or wait for plan poll  | —                               |

### Drive session continuity

| Failure                     | System behavior                                              | User sees                         | Recovery           | Test                          |
| --------------------------- | ------------------------------------------------------------ | --------------------------------- | ------------------ | ----------------------------- |
| Page reload during checkout | New token may be needed; session resumes by `driveSessionId` | QR may stale                      | Rescan if expired  | trial lifecycle `page reload` |
| Second browser tab          | Session conflict rules                                       | Second tab blocked or conflict UI | Single cockpit tab | trial `double browser`        |
| Trial heartbeat loss        | Credit capped at 45 s gap                                    | Slower trial burn                 | Keep tab visible   | trial `heartbeat lost`        |

### Operational / admin

| Failure               | System behavior                                       | User sees                    | Recovery                       | Test                   |
| --------------------- | ----------------------------------------------------- | ---------------------------- | ------------------------------ | ---------------------- |
| Stripe ↔ local drift  | `resolveEntitlementUser` uses local store             | Wrong plan until reconcile   | `/debug/billing` re-sync (dev) | admin diagnostics      |
| Past due subscription | Grace period rules (`DRIVE_PLUS_PAST_DUE_GRACE_DAYS`) | May lose premium after grace | Update payment in portal       | Stripe lifecycle suite |

---

## Automated test commands

```bash
# Server-side integration (7 scenarios)
npm test -- --run src/lib/tesla-upgrade/purchase-flow.integration.test.ts

# Playwright shell (upgrade route smoke)
npm run test:e2e -- e2e/tesla-purchase.spec.ts

# Related suites
npm test -- --run src/lib/dynamic-drive-trial/lifecycle.test.ts
npm test -- --run src/lib/billing/stripe/lifecycle.test.ts
npm test -- --run src/lib/billing/resilience/failure-resilience.test.ts
```

---

## Architecture notes

```
Tesla (display)                    Phone                         Server
     │                                │                              │
     │  createTeslaUpgradeTokenFn     │                              │
     │──────────────────────────────────────────────────────────────>│
     │  QR /upgrade/{token}           │                              │
     │                                │  resolve + checkout          │
     │                                │─────────────────────────────>│
     │                                │  Stripe Checkout             │
     │                                │──────────> Stripe            │
     │                                │                              │<── webhook
     │  entitlement-update (WS)       │                              │
     │<──────────────────────────────────────────────────────────────│
     │  dispatchTeslaEntitlementUpdate│                              │
     │  Drive+ is ready (no reload)   │                              │
     │                                │                              │
     │  fallback: poll entitlements every 2.5 s if WS missed       │
```

**Key modules**

| Module                                        | Role                             |
| --------------------------------------------- | -------------------------------- |
| `src/components/TeslaDrivePlusUpgrade.tsx`    | QR overlay, unlock phases        |
| `src/routes/upgrade.$token.tsx`               | Phone landing + checkout CTA     |
| `src/lib/tesla-upgrade/store.ts`              | Token TTL, bind, complete        |
| `src/lib/tesla-upgrade/notify.ts`             | Post-webhook relay push          |
| `src/lib/drive-relay/store.ts`                | `pushEntitlementUpdateToDisplay` |
| `src/lib/billing/stripe/subscription-sync.ts` | Webhook → subscription + notify  |

**Known limitations (v1)**

- Upgrade tokens and relay sessions are **in-memory** — lost on process restart; not safe for horizontal scale without shared store.
- Trial milestone CTA on phone path uses `/settings` pricing link; **cockpit** uses QR (`Unlock on phone`).
- Full Stripe payment is not automated in Playwright yet — use integration tests + manual Tesla smoke for live checkout.

See also: `docs/billing/failure-resilience.md`, `docs/billing/stripe-test-suite.md`, `docs/dynamic-drive-trial-test-suite.md`.
