import { createFileRoute } from "@tanstack/react-router";

import {
  GOOGLE_OAUTH_PENDING_COOKIE_NAME,
  buildGoogleOAuthPendingCookieOptions,
  serializeCookieHeader,
} from "@/lib/account/session-cookie";

/**
 * Starts Google OAuth with PKCE.
 * Sets the pending OAuth cookie on the same 302 that sends the browser to Google,
 * so the callback works across Vite HMR and multi-instance deploys (createServerFn
 * setCookie alone is not reliable before a client-side location.assign).
 */
export const Route = createFileRoute("/auth/account/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const returnTo = url.searchParams.get("returnTo") ?? "/drive";
        const origin = url.origin;

        const { beginGoogleSignIn } = await import("@/lib/account/auth-service");
        const started = beginGoogleSignIn(returnTo, origin);

        if (!started.available || !started.authorizeUrl || !started.pendingCookie) {
          const target = new URL("/drive", origin);
          target.searchParams.set("googleAuth", "unavailable");
          return Response.redirect(target.toString(), 302);
        }

        const headers = new Headers({
          Location: started.authorizeUrl,
          "Cache-Control": "no-store",
        });
        headers.append(
          "Set-Cookie",
          serializeCookieHeader(
            GOOGLE_OAUTH_PENDING_COOKIE_NAME,
            started.pendingCookie,
            buildGoogleOAuthPendingCookieOptions(),
          ),
        );
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
