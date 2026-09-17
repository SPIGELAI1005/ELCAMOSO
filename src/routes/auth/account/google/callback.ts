import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";

import {
  ACCOUNT_SESSION_COOKIE_NAME,
  GOOGLE_OAUTH_PENDING_COOKIE_NAME,
  buildAccountSessionCookieOptions,
  serializeClearedCookieHeader,
  serializeCookieHeader,
} from "@/lib/account/session-cookie";

function redirectWithCookies(origin: string, path: string, setCookies: string[]): Response {
  const target = path.startsWith("/") ? path : "/drive";
  const headers = new Headers({
    Location: new URL(target, origin).toString(),
    "Cache-Control": "no-store",
  });
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}

/**
 * Google OAuth callback — authorization-code exchange runs entirely on the server.
 * Sets the HttpOnly account session cookie on the redirect response (required: a bare
 * Response.redirect() would drop cookies set via setCookie on the H3 event).
 */
export const Route = createFileRoute("/auth/account/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const clearPending = serializeClearedCookieHeader(GOOGLE_OAUTH_PENDING_COOKIE_NAME);

        const oauthError = url.searchParams.get("error");
        if (oauthError) {
          return redirectWithCookies(origin, "/drive?googleAuth=cancelled", [clearPending]);
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return redirectWithCookies(origin, "/drive?googleAuth=missing", [clearPending]);
        }

        try {
          const pendingCookie = getCookie(GOOGLE_OAUTH_PENDING_COOKIE_NAME) ?? null;
          const { completeGoogleSignIn } = await import("@/lib/account/auth-service");
          const result = await completeGoogleSignIn(code, state, Date.now(), pendingCookie);

          const sessionCookie = serializeCookieHeader(
            ACCOUNT_SESSION_COOKIE_NAME,
            result.sessionToken,
            buildAccountSessionCookieOptions(result.expiresAt),
          );

          try {
            const { isMonetizationEnabled } = await import("@/lib/billing/monetization-flag");
            if (isMonetizationEnabled()) {
              const { getDynamicDriveTrialService } = await import(
                "@/lib/dynamic-drive-trial/service"
              );
              await getDynamicDriveTrialService().startPreview(result.userId);
            }
          } catch {
            // Trial activation is best-effort; account session is already established.
          }

          const returnTo = result.returnTo.startsWith("/") ? result.returnTo : "/drive";
          const nextPath = returnTo.startsWith("/drive") ? "/drive?activateTrial=1" : returnTo;
          return redirectWithCookies(origin, nextPath, [sessionCookie, clearPending]);
        } catch {
          return redirectWithCookies(origin, "/drive?googleAuth=failed", [clearPending]);
        }
      },
    },
  },
});
