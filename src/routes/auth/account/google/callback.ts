import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";

import {
  ACCOUNT_SESSION_COOKIE_NAME,
  buildAccountSessionCookieOptions,
} from "@/lib/account/session-cookie";

function redirectTo(origin: string, path: string): Response {
  const target = path.startsWith("/") ? path : "/drive";
  return Response.redirect(new URL(target, origin).toString(), 302);
}

/**
 * Google OAuth callback — authorization-code exchange runs entirely on the server.
 * Sets the HttpOnly account session cookie, then redirects. No tokens in the browser.
 */
export const Route = createFileRoute("/auth/account/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;

        const oauthError = url.searchParams.get("error");
        if (oauthError) {
          return redirectTo(origin, "/drive?googleAuth=cancelled");
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return redirectTo(origin, "/drive?googleAuth=missing");
        }

        try {
          const { completeGoogleSignIn } = await import("@/lib/account/auth-service");
          const result = await completeGoogleSignIn(code, state);

          setCookie(
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
          if (returnTo.startsWith("/drive")) {
            return redirectTo(origin, "/drive?activateTrial=1");
          }
          return redirectTo(origin, returnTo);
        } catch {
          return redirectTo(origin, "/drive?googleAuth=failed");
        }
      },
    },
  },
});
