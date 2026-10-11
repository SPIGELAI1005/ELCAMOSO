# Email one-time code (OTP) setup — ELCAMOSO

Passwordless flow: **email → six-digit code → verified ELCAMOSO session cookie → internal return path**.

Google OAuth and the legacy email magic-link path remain available. Supabase Auth is the OTP **provider**; ELCAMOSO continues to mint its own HttpOnly session cookie after server-side `verifyOtp`. Protected APIs must not trust a client user id or a client-only “logged in” flag.

**Do not put secrets in this guide or in git.**

---

## 1. Environment variables (names only)

| Variable | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Server | Project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Server | Anon / publishable key used by Auth OTP API |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Optional alias for `SUPABASE_ANON_KEY` |
| `ELCAMOSO_EMAIL_OTP_ENABLED` | Server | `1` / unset = enable when URL+key present; `0` = force off |
| `ELCAMOSO_ACCOUNT_SESSION_SECRET` | Server | Optional HMAC secret for session tickets (existing) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Server | Existing Google OAuth (unchanged) |

Never expose service-role keys to the browser. OTP send/verify run in `createServerFn` handlers only.

---

## 2. Supabase project

1. Reuse the existing Supabase project if the team already has one. Do **not** invent credentials.
2. Authentication → Providers → **Email** enabled.
3. Authentication → URL Configuration:
   - **Site URL** (examples):
     - Local: `http://localhost:5173`
     - Staging: your staging origin
     - Production: `https://www.elcamoso.com` (or current production origin)
   - **Redirect URLs**: include the same origins. OTP code entry does **not** depend on phone deep links; redirects are for dashboard hygiene and any residual magic-link templates.

---

## 3. Email template (required for numeric codes)

Magic Link and Email OTP share the email implementation. To send a **six-digit code**, the Magic Link template must include `{{ .Token }}` (not only a link).

Example body:

```html
<h2>Your ELCAMOSO sign-in code</h2>
<p>Enter this code in the app (for example on the car screen while you read mail on your phone):</p>
<p style="font-size: 24px; letter-spacing: 0.2em;"><strong>{{ .Token }}</strong></p>
<p>If you did not request this, you can ignore this email.</p>
```

If the template only contains `{{ .ConfirmationURL }}`, users receive a link instead of a typed code.

---

## 4. OTP lifetime (provider-wide)

- Configure **Authentication → Providers → Email → Email OTP Expiration**.
- Recommended for ELCAMOSO: **600 seconds (10 minutes)** or shorter for higher assurance.
- **Caution (from Supabase docs):** this setting also governs Magic Links and other email links (confirmation, recovery, invite, email change). Changing it is **provider-wide**.
- The in-app resend countdown is **UI/rate-limit only**. It does **not** change backend OTP expiry.

Default Supabase behaviour if left untouched: roughly **60s** between sends and **1 hour** expiry — tighten before production.

---

## 5. SMTP / sender domain

1. Authentication → SMTP Settings (or project custom SMTP).
2. Use a verified sender domain (SPF, DKIM, DMARC with your ESP).
3. From-name suggestion: `ELCAMOSO` — From address on your domain (e.g. `signin@your-domain`).
4. Confirm deliverability on staging before production cutover.

---

## 6. Product choices encoded in code

| Choice | Value | Rationale |
| --- | --- | --- |
| `shouldCreateUser` | `true` | First-time users may sign up via email code (`EMAIL_OTP_SHOULD_CREATE_USER`) |
| Session after verify | ELCAMOSO HttpOnly cookie | Same contract as Google / magic-link; Stripe + entitlements stay on `userId` |
| Supabase session | Discarded after verify | Provider proves email; app session is ours |
| Account existence | Not disclosed | Same success copy whether or not the mailbox / user exists |

---

## 7. Local / staging / production checklist

1. Set `SUPABASE_URL` + `SUPABASE_ANON_KEY` for the environment.
2. Confirm email template contains `{{ .Token }}`.
3. Set OTP expiration (document the chosen seconds in the deploy notes).
4. Configure SMTP + DNS.
5. Smoke-test Google OAuth still works.
6. Smoke-test magic-link fallback with `ELCAMOSO_EMAIL_OTP_ENABLED=0` if needed.
7. Staging E2E delivery check (see PROGRESS / below) — mocks do not prove mail delivery.

---

## 8. In-car UX note

The driver enters the code in the car UI while reading the email on a phone. There is **no** phone-link-only session dependency for this flow.

---

## 9. Staging end-to-end delivery check (manual)

Mocks and unit tests do **not** prove real email delivery. Once per staging deploy:

1. Use a real mailbox you control.
2. Open staging → Sign in → enter that email → **Send sign-in code**.
3. Confirm a six-digit code arrives (not only a magic link).
4. Enter the code on a second viewport (or the same) and confirm session + return path.
5. Confirm a second send within ~60s is rejected (provider and/or app rate limit).
6. Confirm an old code fails after expiry / reuse.

Record pass/fail in the release notes — do not claim production readiness without this check.
