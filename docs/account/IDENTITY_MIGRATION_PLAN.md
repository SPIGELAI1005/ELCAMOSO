# Identity mapping plan — Supabase email OTP ↔ ELCAMOSO accounts

**Status:** Reviewed design for Prompt 10. **Do not auto-merge production identities.**

## Current ownership (from Drive Cockpit V2 audit)

| System | Role |
| --- | --- |
| ELCAMOSO `users.id` | Canonical account id for entitlements, Stripe `stripeCustomerId`, Dynamic Drive trial |
| HttpOnly cookie `elcamoso_account_session` | Signed session ticket → `userId` + verified email |
| Google OAuth | Verifies email via ID token, then `createUserForEmail(email)` |
| Magic link | Verifies email via one-time token, then same session mint |
| Supabase Auth (new) | Verifies email via `verifyOtp` type `email`, then **same** session mint |

## Mapping rule (Prompt 10)

1. After **successful** Supabase `verifyOtp`, take `data.user.email` from the provider response.
2. Call `createSessionFromVerifiedEmail(verifiedEmail)` which uses `createUserForEmail`:
   - If that email already maps to an ELCAMOSO `userId`, **reuse it** (preserves purchases / Stripe customer).
   - Otherwise create a new UUID and register the email.
3. **Never** set ELCAMOSO `userId` = Supabase `auth.users.id` in this phase (avoids splitting existing paid accounts).
4. **Never** merge accounts because the client posted a matching email without provider verification.

## What is intentionally not automated

- Linking two different emails that a human claims are the same person
- Merging a Google account and an email-OTP account with different emails
- Rewriting historical Stripe customers onto a new UUID
- Writing Supabase user ids into production `users` without a reviewed migration

## Future optional table (additive, not applied here)

```text
auth_identity_links
  elcamoso_user_id  uuid  not null  → users.id
  provider          text  not null  -- 'supabase' | 'google' | …
  provider_subject  text  not null  -- stable provider user id
  email_verified    text  not null
  created_at        timestamptz
  unique (provider, provider_subject)
```

Population would be **idempotent** upserts after verified sign-in, reviewed in a later migration PR. Until then, email string equality after verification is the bridge.

## Test coverage (automated)

- New email → new `userId`
- Existing email (pre-registered / prior purchase mapping) → same `userId`
- Wrong / expired / reused code → no session
- Throttle / resend cooldown
- Redirect allowlist
- Cross-user sessions remain isolated
- Unverified client email cannot assume another user’s id

## Rollback

- Set `ELCAMOSO_EMAIL_OTP_ENABLED=0` or remove `SUPABASE_*` env vars.
- Google + magic-link continue to issue the same cookie contract.
