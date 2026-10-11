# Sound Spin (Prompt 12)

Monthly free reward wheel for verified ELCAMOSO accounts. **Disabled by default** until campaign configuration is complete.

## Flags

| Flag | Default | Effect |
| --- | --- | --- |
| `ELCAMOSO_REWARDS_ENABLED` | off | Master switch. When off, `/rewards` shows unavailable and claim APIs reject. |
| Campaign `enabled` | `false` (staging config) | Even with the env flag on, claiming stays off until the active campaign is explicitly enabled. |

No paid spins. No speed / distance / acceleration requirements. No automatic subscription enrolment.

## Period (UTC)

Campaign months use **UTC calendar boundaries** only.

- Period key: `YYYY-MM`
- Inclusive start: `YYYY-MM-01T00:00:00.000Z`
- Exclusive end: first instant of the next UTC month

Example: `2026-10-31T23:30:00.000Z` → `2026-10`; `2026-11-01T00:00:00.000Z` → `2026-11`.

One recorded claim per `(accountId, campaignId, periodKey)`. Idempotency keys supplement that uniqueness within the same period; they do not allow a reroll.

## Authority

1. Client requests claim with an idempotency key (no prize id).
2. Server validates auth, audience (free vs paid pool), campaign, and weights.
3. Server selects the reward with cryptographic RNG (`node:crypto.randomInt`).
4. Server **records the claim** (outcome + config version snapshot) then fulfils grants.
5. Client animates the already-recorded result. Reload / retry returns the same claim.

Clients never choose prize, eligibility, probability, expiry, or access level.

## Reward types

| Kind | Access start (v1) | Expiry |
| --- | --- | --- |
| `sound_48h` | Claim time (UTC) | +48 hours |
| `sound_pack_7d` | Claim time (UTC) | +7 days |
| `cockpit_theme` | Claim time | Permanent theme unlock for the account |
| `one_payment_discount` | Claim time | Reservation expires +30 days; Stripe apply/consume in `STRIPE_DISCOUNT_FULFILMENT.md` |
| `full_library_weekend` | Claim time | UTC Sunday 23:59:59.999 of the applicable weekend week, capped at 96 hours |

Free and paid pools are separate. Paid pool does not offer full-library weekend as a filler for content the subscriber already owns; theme + one-payment discount carry real value.

## Weights and inventory

- Weights must be finite and nonnegative; pool total after normalization must be > 0.
- Invalid pool → claiming disabled (no silent worse prize).
- Inventory-limited outcomes: use the pool’s **declared** `inventoryFallbackRewardId`, or disable claiming if fallback is missing/unavailable.

Staging campaign probabilities are **illustrative only** (`stagingIllustrativeOnly: true`). Production terms must be explicit reviewed configuration.

## Data model

Postgres migration `drizzle/migrations/0004_reward_claims.sql`:

- `reward_campaigns` — versioned config
- `reward_claims` — UNIQUE `(user_id, campaign_id, period_key)` + idempotency uniqueness
- `reward_discount_reservations` — durable discount holds
- `reward_cockpit_themes` — theme unlocks

Runtime v1 uses an in-memory store mirroring those constraints (same pattern as entitlement grants). Fulfilment writes idempotent grant ids via `upsertEntitlementGrant`.

## UI

- Route: `/rewards` (linked from Garage when the rewards flag is on)
- Outside active Drive: no reward pop-ups on `/drive`
- Shows UTC terms, access start, expiry, next eligibility, and **actual odds**
- Wheel segments are decorative (`wheelSegmentsProportionalToOdds: false`) — UI must not imply equal odds
- Reduced motion: instant reveal
- Accessible result text + keyboard claim control

## Tests

`src/lib/rewards/*.test.ts` cover concurrent claims, idempotency, period boundaries, fulfilment retry, cross-user reads, invalid weights, inventory fallback, entitlement expiry, and deterministic RNG injection (`setRewardRandomForTests`).
