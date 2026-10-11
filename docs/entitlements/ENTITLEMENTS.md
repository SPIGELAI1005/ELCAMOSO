# Entitlements, free Sound Profiles and offline lease (Prompt 11)

## Permanent free Sound Profile set

Configured in `src/lib/sound/profile-access-config.ts` (`FREE_SOUND_PROFILE_SET` / `FREE_SOUND_PROFILE_IDS`).

| Role | ID | Rationale |
| --- | --- | --- |
| Muscle / body-led | `american-muscle-v8` | Low-end body presence; free-tier gear realism |
| Sport / mechanical | `flat-six-sport` | Contrasting high-rev NA mechanical character |
| Futuristic | `cyber-pulse` | Continuous EV / future motion sound |

Default `DEFAULT_PROFILE_ID` and `FALLBACK_SOUND_PROFILE_ID` point at the muscle free id.

**Grandfathering:** Shrinking the free list does **not** revoke purchased / grandfathered profile grants stored in `entitlement_grants` / in-memory grant store.

## What stays free

- Drive Cockpit UI, master volume, mute, favourites strip (locked chips stay visible)
- Fundamental gear / regime realism for profiles the user can drive (`virtual_transmission` on FREE)
- Sound quality path for free profiles (same engine; no artificial downgrade)
- Short non-driving previews of locked profiles (`LOCKED_PROFILE_PREVIEW_SECONDS`)

## What premium unlocks

- Additional catalog Sound Profiles (`all_sound_profiles`)
- Existing premium capabilities already in `PREMIUM_ENTITLEMENTS` (Dynamic Drive extras, full Symphony/Worlds/Fusion, etc.)

No new prices or payment plans are introduced by Prompt 11.

## Authoritative resolver

`src/lib/entitlements/access-resolver.ts` is the server/test decision engine for profile + capability access.

Drive/Sounds UI gating uses `canDriveProfileWithAccess` (`drive-profile-access.ts`) via `useFeatureAccess`:

- Free trio from `FREE_SOUND_PROFILE_IDS` (profile.access cannot invent extra free IDs)
- Active grants ∪ live-drive hold profile ids
- `all_sound_profiles` entitlement / trial / subscription
- Symphony / World / Fusion IDs via experience entitlements (`symphony_essential`, etc.)

Also:

- Favourites / Drive cockpit: `useFeatureAccess`
- Mid-drive lease expiry: `EntitlementEnforcer` applies `fade_to_free` immediately (other downgrades may defer until Drive ends)
- Sound asset manifests (`manifest-service` via `hasEntitlement`)
- Rewards (Sound Spin fulfilment writes `reward_profile` / `reward_entitlement` grants; see `docs/rewards/SOUND_SPIN.md`)
- Account UI snapshots (`buildEntitlementSnapshot`)

**Persistence note (Prompt 14):** grant / claim / discount reservation tables exist (`0003`–`0005`) but runtime stores remain in-memory until a Postgres repository is wired. Do not enable rewards/discounts in multi-instance production until persistence is live.

### Precedence (UTC `now` in epoch ms)

1. Permanent free profile ids  
2. Active purchased / grandfathered profile grants (`expiresAt` null or `> now`)  
3. Active reward profile / entitlement grants  
4. Trial overlay (`trialEndsAt` UTC)  
5. Subscription access policy (`active` / `trialing` / `past_due` grace / cancel-at-period-end)  
6. Bounded offline / live-drive lease (cannot outlive `expiresAtUtc`)  
7. Denied  

### Past-due / cancel

Configured by `DRIVE_PLUS_PAST_DUE_GRACE_DAYS` (default 7) via `subscription-access-policy.ts`. All timestamps compared as UTC epoch ms.

## Client vs server

- Client booleans and localStorage **never** authorize protected routes or signed asset delivery.
- Server: `requireEntitlement` / `assertServerEntitlement` / `resolveEntitlementUser` with verified session cookie.
- Clients may **read** their grants via entitlement snapshot; they **cannot** write premium grants (no public write server fn).

## Offline / session lease

`src/lib/entitlements/offline-lease.ts` + `live-drive-access.ts`:

- Max lease: **72 hours** (`OFFLINE_LEASE_MAX_MS`)
- Issued when a live Drive session begins
- Revalidate on reconnect / entitlement refresh
- Expiry mid-drive policy: **`fade_to_free`** → crossfade to `FALLBACK_SOUND_PROFILE_ID` (no modal, no blast)
- Account switch → `invalidateOfflineLeaseOnAccountSwitch` drops prior-user cache

## Protected sample assets

`buildSoundAssetManifest` issues short-lived signed URLs only when `all_sound_profiles` is entitled. Assets already delivered to a browser are extractable. Procedural synthesis shipped in the client cannot be made secret by hiding UI.

## Configuration points

| Point | Location |
| --- | --- |
| Free trio | `profile-access-config.ts` |
| Plan entitlements | `plans.ts` |
| Past-due grace days | `DRIVE_PLUS_PAST_DUE_GRACE_DAYS` |
| Offline lease max | `OFFLINE_LEASE_MAX_MS` |
| Expiry policy | `OFFLINE_LEASE_EXPIRY_POLICY` |
| Grants (runtime) | `grants.ts` |
| Grants (DB) | `drizzle/migrations/0003_entitlement_grants.sql` |

## Staging note

Apply migration `0003_entitlement_grants` before relying on durable grants in Postgres. In-memory grant store covers tests and local without DB.
