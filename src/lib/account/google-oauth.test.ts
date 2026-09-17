import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  beginGoogleSignIn,
  completeGoogleSignIn,
  getGoogleSignInAvailability,
} from "@/lib/account/auth-service";
import {
  LOCAL_GOOGLE_REDIRECT_URI,
  PRODUCTION_GOOGLE_REDIRECT_URI,
  validateGoogleOAuthEnvAtStartup,
} from "@/lib/account/google-oauth-config";
import { buildTestIdToken } from "@/lib/account/google-id-token";
import { resetGoogleOAuthStateForTests } from "@/lib/account/google-oauth";
import { buildAccountSessionCookieOptions } from "@/lib/account/session-cookie";
import { resetAccountAuthStoreForTests } from "@/lib/account/session-store";

describe("Google account OAuth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetAccountAuthStoreForTests();
    resetGoogleOAuthStateForTests();
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.GOOGLE_REDIRECT_URI = LOCAL_GOOGLE_REDIRECT_URI;
    delete process.env.ELCAMOSO_ENV;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.ELCAMOSO_ENV;
    Object.assign(process.env, originalEnv);
  });

  function stubGoogleTokenExchange(claims: Record<string, unknown>) {
    const idToken = buildTestIdToken(claims);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("oauth2.googleapis.com/token") && !url.includes("tokeninfo")) {
          return Response.json({ access_token: "ya29.should-not-leak", id_token: idToken });
        }
        if (url.includes("oauth2.googleapis.com/tokeninfo")) {
          return Response.json(claims);
        }
        return new Response("not found", { status: 404 });
      }),
    );
    return idToken;
  }

  it("reports availability when credentials are set", () => {
    expect(getGoogleSignInAvailability().available).toBe(true);
  });

  it("hides Google sign-in when env is missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    expect(getGoogleSignInAvailability().available).toBe(false);
    expect(beginGoogleSignIn("/drive").available).toBe(false);
  });

  it("builds a Google authorize URL with state, PKCE, and nonce", () => {
    const started = beginGoogleSignIn("/drive?activateTrial=1");
    expect(started.available).toBe(true);
    const url = new URL(started.authorizeUrl!);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client");
    expect(url.searchParams.get("redirect_uri")).toBe(LOCAL_GOOGLE_REDIRECT_URI);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("completes sign-in from code + state into an account session", async () => {
    const started = beginGoogleSignIn("/settings");
    const state = new URL(started.authorizeUrl!).searchParams.get("state")!;
    const nonce = new URL(started.authorizeUrl!).searchParams.get("nonce")!;
    const nowSeconds = Math.floor(Date.now() / 1000);
    stubGoogleTokenExchange({
      iss: "https://accounts.google.com",
      aud: "google-client",
      sub: "google-sub-1",
      email: "driver@gmail.com",
      email_verified: true,
      exp: nowSeconds + 3600,
      iat: nowSeconds,
      nonce,
    });

    const session = await completeGoogleSignIn("auth-code", state);
    expect(session.email).toBe("driver@gmail.com");
    expect(session.returnTo).toBe("/settings");
    expect(session.sessionToken).toBeTruthy();
    expect(JSON.stringify(session)).not.toContain("ya29");
    expect(JSON.stringify(session)).not.toContain("google-secret");
  });

  it("rejects missing state", async () => {
    await expect(completeGoogleSignIn("auth-code", "")).rejects.toThrow(/Missing Google OAuth state/i);
  });

  it("rejects invalid state", async () => {
    await expect(completeGoogleSignIn("auth-code", "forged-state")).rejects.toThrow(
      /Google sign-in expired/i,
    );
  });

  it("rejects Google OAuth token errors", async () => {
    const started = beginGoogleSignIn("/drive");
    const state = new URL(started.authorizeUrl!).searchParams.get("state")!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "invalid_grant", error_description: "Bad authorization code." },
          { status: 400 },
        ),
      ),
    );
    await expect(completeGoogleSignIn("bad-code", state)).rejects.toThrow(/Bad authorization code/i);
  });

  it("rejects invalid ID tokens", async () => {
    const started = beginGoogleSignIn("/drive");
    const state = new URL(started.authorizeUrl!).searchParams.get("state")!;
    const nonce = new URL(started.authorizeUrl!).searchParams.get("nonce")!;
    const nowSeconds = Math.floor(Date.now() / 1000);
    stubGoogleTokenExchange({
      iss: "https://accounts.google.com",
      aud: "wrong-audience",
      sub: "google-sub-2",
      email: "driver@gmail.com",
      email_verified: true,
      exp: nowSeconds + 3600,
      nonce,
    });
    await expect(completeGoogleSignIn("auth-code", state)).rejects.toThrow(/audience/i);
  });

  it("rejects unverified Google emails", async () => {
    const started = beginGoogleSignIn("/drive");
    const state = new URL(started.authorizeUrl!).searchParams.get("state")!;
    const nonce = new URL(started.authorizeUrl!).searchParams.get("nonce")!;
    const nowSeconds = Math.floor(Date.now() / 1000);
    stubGoogleTokenExchange({
      iss: "https://accounts.google.com",
      aud: "google-client",
      sub: "google-sub-3",
      email: "unverified@gmail.com",
      email_verified: false,
      exp: nowSeconds + 3600,
      nonce,
    });
    await expect(completeGoogleSignIn("auth-code", state)).rejects.toThrow(/Verify your Google/i);
  });

  it("rejects missing env configuration at startup when partially set", () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(() => validateGoogleOAuthEnvAtStartup()).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("allows fully missing Google env at startup", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    expect(validateGoogleOAuthEnvAtStartup()).toEqual({
      configured: false,
      warnings: expect.arrayContaining([expect.stringMatching(/not configured/i)]),
    });
  });

  it("requires production redirect URI when configured", () => {
    process.env.ELCAMOSO_ENV = "production";
    process.env.GOOGLE_REDIRECT_URI = LOCAL_GOOGLE_REDIRECT_URI;
    expect(() => validateGoogleOAuthEnvAtStartup()).toThrow(PRODUCTION_GOOGLE_REDIRECT_URI);
  });

  it("accepts production redirect URI", () => {
    process.env.ELCAMOSO_ENV = "production";
    process.env.GOOGLE_REDIRECT_URI = PRODUCTION_GOOGLE_REDIRECT_URI;
    expect(validateGoogleOAuthEnvAtStartup().configured).toBe(true);
  });

  it("sets production cookie attributes to HttpOnly Secure SameSite=Lax", () => {
    const expiresAt = Date.now() + 60_000;
    const opts = buildAccountSessionCookieOptions(expiresAt, Date.now(), { production: true });
    expect(opts).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: expect.any(Number),
    });
    expect(opts.maxAge).toBeGreaterThan(0);
  });

  it("keeps Secure off for local development cookies", () => {
    const opts = buildAccountSessionCookieOptions(Date.now() + 60_000, Date.now(), {
      production: false,
    });
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("lax");
  });
});
