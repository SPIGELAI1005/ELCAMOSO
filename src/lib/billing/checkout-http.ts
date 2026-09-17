import { requireAccountSession } from "@/lib/account/auth-service";
import { ACCOUNT_SESSION_COOKIE_NAME } from "@/lib/account/session-cookie";

/** Reads the ELCAMOSO account session token from an API request (Bearer, header, or cookie). */
export function readAccountSessionToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (token) return token;
  }

  const headerToken = request.headers.get("x-elcamoso-session")?.trim();
  if (headerToken) return headerToken;

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [rawName, ...rest] = part.split("=");
      const name = rawName?.trim();
      if (name === ACCOUNT_SESSION_COOKIE_NAME) {
        const value = rest.join("=").trim();
        if (value) return decodeURIComponent(value);
      }
    }
  }

  return null;
}

export function requireAccountSessionFromRequest(request: Request) {
  const sessionToken = readAccountSessionToken(request);
  if (!sessionToken) {
    throw new CheckoutAuthError();
  }
  return requireAccountSession(sessionToken);
}

export class CheckoutAuthError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "CheckoutAuthError";
  }
}

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
