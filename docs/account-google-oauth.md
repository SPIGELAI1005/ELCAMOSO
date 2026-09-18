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
3. Create credentials → **OAuth client ID** → Application type **Web application**.
4. Authorized JavaScript origins (local): `http://localhost:5173`
5. Authorized redirect URIs: register both local and production callbacks above.
6. Copy Client ID and Client Secret into `.env.local` (or Vercel env).

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

1. Client calls `beginGoogleSignInFn` → redirects to Google (authorize URL only; no secrets).
2. Google returns to `GET /auth/account/google/callback?code=…&state=…`.
3. The **server route handler** validates state, exchanges the code with PKCE + client secret, verifies the ID token, creates the session, sets the HttpOnly cookie, and redirects to `returnTo`.
4. Browser never receives Google tokens or the ELCAMOSO session token in JSON / localStorage.

`completeGoogleSignInFn` remains available for tests and internal callers; production Google redirects use the server route above.
