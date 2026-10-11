# Drive Cockpit V2 — actual-device test script

**Purpose:** Parked / synthetic-telemetry validation on desktop, iPhone, and Tesla browser.  
**Rule:** The tester must not need to manipulate the app while the vehicle is moving.  
**Do not bypass** Tesla / browser restrictions. If moving-cabin behaviour cannot be verified, mark **pending**.

Related: `docs/DRIVE_COCKPIT_V2_RELEASE_CHECKLIST.md`, `docs/audio/LISTENING_AND_ASSET_STATUS.md`.

## Before you start

Record for each device:

| Field | Value |
| --- | --- |
| Date (UTC) | |
| Tester | |
| App build / commit | |
| Device | Desktop / iPhone / Tesla |
| OS / browser | e.g. Windows 11 + Chrome; iOS + Safari; Tesla software + browser UA |
| Vehicle model / SW (Tesla) | or N/A |
| Output path | Speakers / headphones / cabin |
| Flags under test | list enabled flags (default: all opt-in flags **off**) |
| Network | Wi‑Fi / LTE / offline after start |

## Prep (all devices)

1. Fresh or known settings export; note master volume default (~35%).
2. Sign-in path under test (Google / magic link / email OTP) — or anonymous if only free trio.
3. Open `/drive` while **parked**. Use Demo pedals or synthetic motion — not road driving.
4. Confirm reduced-motion OS setting on/off for one pass each if available.

## A. Parked / synthetic telemetry (required)

| # | Check | Desktop | iPhone | Tesla | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 | Cold start → audio after gesture; no stuck silence | | | | |
| A2 | Free trio selectable; premium Engine locked without Drive+ | | | | |
| A3 | Symphony essential (Cinematic Rock) selectable on FREE; Neon/Fusion locked | | | | |
| A4 | Favourites strip; locked chips visible but not driveable | | | | |
| A5 | Mute / unmute; volume persist after reload | | | | |
| A6 | Profile switch ×20+; no stuck graph; crossfade OK | | | | |
| A7 | City/Touring/Sport shift map (if VT on); one event per shift; no hunting in Demo | | | | |
| A8 | Gearless / continuous profile (e.g. cyber-pulse) — no fake gears | | | | |
| A9 | Simulate GPS loss / stale speed (Demo or debug) — hold/decay, no invented accel | | | | |
| A10 | Tab background 30s → resume; AudioContext recovers | | | | |
| A11 | Airplane / offline after audio started — lease fade_to_free if entitlement drops | | | | |
| A12 | Reduced motion: Sound Spin / hero motion respects preference | | | | |
| A13 | Logo **O )))** only; no OEM / car chrome in Drive | | | | |
| A14 | Portrait mobile layout usable; bottom chrome Drive · Explore · Studio · Garage | | | | |

**Processing note:** Record subjective dropouts / glitches and any available performance observer notes. Do **not** claim a universal CPU %.

## B. Auth / entitlements (parked)

| # | Check | Pass? | Notes |
| --- | --- | --- | --- |
| B1 | Sign-in → session cookie; entitlements refresh | | |
| B2 | Sign-out other tab → this tab drops premium | | |
| B3 | Temporary grant / trial expiry (staging) → fade or clamp | | |
| B4 | Sound Spin (`ELCAMOSO_REWARDS_ENABLED` staging only): one claim; reload no reroll | | |
| B5 | Reward discount (`ELCAMOSO_REWARD_DISCOUNTS_ENABLED` + test coupons only): terms shown; no live coupons | | |

## C. Tesla browser — parked only

| # | Check | Result | Restrictions observed |
| --- | --- | --- | --- |
| C1 | Load `/drive` parked; start Demo audio | | |
| C2 | Autoplay / user-gesture requirements | | |
| C3 | Sample rate / output quirks | | |
| C4 | Touch targets / portrait layout | | |
| C5 | **Moving vehicle audio** | **pending** unless verified | Never instruct driver to operate UI while moving |

## D. Listening (human — not automated)

Use `docs/audio/LISTENING_AND_ASSET_STATUS.md`. Numerical lab metrics **do not** promote listening-verified.

| Profile / scenario | Headphones | Cabin | Status |
| --- | --- | --- | --- |
| american-muscle-v8 idle/load/lift | | | not performed / pass / fail |
| flat-six-sport | | | |
| cyber-pulse | | | |
| (add as auditioned) | | | |

**Listening-verified count remains honest:** do not invent pass results.

## Sign-off

| Role | Name | Date | Outcome |
| --- | --- | --- | --- |
| Device tester | | | ready / blocked / pending Tesla moving |
| Product | | | |

Claims **not** made by this script alone: all-realistic sounds, live email delivery, live Stripe discount application, Tesla support while moving.
