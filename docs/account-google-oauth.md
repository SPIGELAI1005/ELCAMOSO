# Google account OAuth

Server-only configuration for **ELCAMOSO account** sign-in with Google. This is separate from Tesla vehicle OAuth.

**Never** prefix Google secrets with `VITE_` — they must not reach the browser bundle.

## Required

| Variable               | Description                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth 2.0 Web client ID from [Google Cloud Console](https://cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (server only; used only in the token exchange)                             |
| `GOOGLE_REDIRECT_URI`  | Must match a registered redirect URI exactly                                                   |

When all three are set, the account sign-in dialog shows **Continue with Google**. If any are missing, the button is hidden. Partial configuration fails server startup validation.

## Redirect URIs

| Environment | `GOOGLE_REDIRECT_URI`                                   |
| ----------- | ------------------------------------------------------- |
| Local       | `http://localhost:5173/auth/account/google/callback`    |
| Production  | `https://www.elcamoso.com/auth/account/google/callback` |

## Google Cloud Console setup

1. Create or select a Google Cloud project.
2. Configure the **OAuth consent screen** (External or Internal). Add scopes: `openid`, `email`, `profile`.
3. Create credentials → **OAuth client ID** → Application type **Web application** (Desktop / iOS clients cannot register HTTPS redirect URIs).
4. **Authorized JavaScript origins** (exact host only, no path):
   - `https://www.elcamoso.com`
   - `https://elcamoso.com` (optional; only needed if the non-www origin serves the app without redirecting)
   - `http://localhost:5173`
5. **Authorized redirect URIs** (must match the env value character-for-character):
   - `https://www.elcamoso.com/auth/account/google/callback`
   - `http://localhost:5173/auth/account/google/callback`
6. Copy Client ID and Client Secret into `.env.local` (or Vercel env). Production must also set `ELCAMOSO_ENV=production` so the server enforces the www production redirect URI.
7. Save. Google may take a few minutes (rarely up to a few hours) before the new URI is accepted.

### Production Console checklist (verified 2026-10-10)

Live production sends `redirect_uri=https://www.elcamoso.com/auth/account/google/callback` with client id `40511295281-…apps.googleusercontent.com`. That exact string must appear under **Authorized redirect URIs** on the same Web client. After registering it, Google sign-in reaches the account picker instead of Error 400.

## Troubleshooting: `The provided client secret is invalid`

Google accepted the authorize step, then rejected the **token exchange**. ELCAMOSO shows `/drive?googleAuth=secret` (or `failed`).

| Cause | Fix |
| ----- | --- |
| `GOOGLE_CLIENT_SECRET` was rotated in Cloud Console | Open the **same** Web client as `GOOGLE_CLIENT_ID`, copy the current secret into `.env.local`, restart `npm run dev` |
| Secret belongs to a different OAuth client | Client ID and secret must be a pair from one Web application credential |
| Typo, quotes, or trailing space in `.env.local` | Use a single unquoted line: `GOOGLE_CLIENT_SECRET=GOCSPX-…` |

The Client ID can still be correct while the secret is stale. Re-copying only the ID does not fix this.

## Troubleshooting: `Error 400: redirect_uri_mismatch`

Google rejects the authorize request **before** consent when the `redirect_uri` query param is not an exact registered value. Typical causes:

| Symptom / cause | Fix |
| --------------- | --- |
| Production env has the correct www callback, but Console is missing it | Add `https://www.elcamoso.com/auth/account/google/callback` to the Web client |
| Trailing slash, `http` vs `https`, or non-www host | Register the **exact** string the app sends (code expects www in production) |
| Wrong OAuth client (different Client ID than `GOOGLE_CLIENT_ID`) | Edit the client whose ID matches Vercel / `.env` |
| Client type is Desktop / iOS / Android | Create a **Web application** client and update env secrets |
| Just saved in Console | Wait a few minutes, then retry from a fresh tab (old error pages can be cached on phones) |

Decode the failing authorize URL (or Google’s `authError` payload) and confirm `redirect_uri=` matches Console and `GOOGLE_REDIRECT_URI` / `GOOGLE_REDIRECT_URI_PRODUCTION`. No app code change fixes a Console mismatch.

The production callback route itself is live (`GET /auth/account/google/callback` → redirect when `code` is missing). A mismatch error means Google never called that route.

## Security model

- Authorization Code flow with **PKCE** (`S256`) and **state** + **nonce**.
- Code → token exchange runs only in `completeGoogleSignIn` / `completeGoogleSignInFn` (server).
- ID token is validated for issuer, audience (`GOOGLE_CLIENT_ID`), expiration, and nonce (signature via Google tokeninfo).
- Google access tokens are discarded after exchange; never stored in localStorage or returned to the client.
- ELCAMOSO session is set as an **HttpOnly** cookie (`elcamoso_account_session`): **Secure** in production, **SameSite=Lax**, TTL aligned with the account session.
- Cookie value is a **signed session ticket** (HMAC) so login survives server restarts / multi-instance without relying on in-memory Maps alone.
- Google OAuth PKCE/state/nonce are also stored in a short-lived HttpOnly cookie (`elcamoso_google_oauth`) so the callback works across instances.
- The callback redirect response includes `Set-Cookie` explicitly (a bare `Response.redirect()` would drop cookies set only on the H3 event).

## Environment separation

| Variable       | Description                                         |
| -------------- | --------------------------------------------------- |
| `ELCAMOSO_ENV` | `development` (default), `staging`, or `production` |

When `ELCAMOSO_ENV=staging` or `production`, the server prefers:

- `GOOGLE_CLIENT_ID_STAGING` / `GOOGLE_CLIENT_ID_PRODUCTION`
- `GOOGLE_CLIENT_SECRET_STAGING` / `GOOGLE_CLIENT_SECRET_PRODUCTION`
- `GOOGLE_REDIRECT_URI_STAGING` / `GOOGLE_REDIRECT_URI_PRODUCTION`

If a suffixed value is missing, the unsuffixed `GOOGLE_*` value is used.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI=http://localhost:5173/auth/account/google/callback`.
3. Run `npm run dev` on port 5173.
4. Open any account sign-in dialog → **Continue with Google**.

## Flow

1. Client navigates to `GET /auth/account/google/start?returnTo=…`.
2. That **server route** mints PKCE state, sets the HttpOnly pending cookie (`elcamoso_google_oauth`) on the **same 302** that sends the browser to Google (authorize URL only; no secrets).
3. Google returns to `GET /auth/account/google/callback?code=…&state=…`.
4. The callback validates state (cookie and/or in-memory), exchanges the code with PKCE + client secret, verifies the ID token, creates the session, sets the HttpOnly session cookie, and redirects to `returnTo`.
5. Browser never receives Google tokens or the ELCAMOSO session token in JSON / localStorage.

Do **not** rely on `beginGoogleSignInFn` + `window.location.assign` for the production path: `createServerFn` `setCookie` is not reliably applied before a client-side navigation, which breaks the callback after Vite HMR or on multi-instance deploys. `beginGoogleSignInFn` remains for tests and diagnostics.

On failure the callback redirects to `/drive?googleAuth=…` (`cancelled` | `missing` | `expired` | `token` | `failed` | `unavailable`) and Drive shows a short status line.
