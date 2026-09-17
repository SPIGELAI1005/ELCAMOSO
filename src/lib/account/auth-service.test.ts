import { beforeEach, describe, expect, it } from "vitest";

import {
  getAccountSession,
  requestAccountSignIn,
  requireAccountSession,
  verifyAccountMagicLink,
} from "@/lib/account/auth-service";
import { resetAccountAuthStoreForTests, saveAccountSession } from "@/lib/account/session-store";

describe("account auth service", () => {
  beforeEach(() => {
    resetAccountAuthStoreForTests();
  });

  it("issues a dev verify URL for magic-link sign-in", () => {
    const result = requestAccountSignIn(
      "driver@example.com",
      "/drive?activateTrial=1",
      "http://localhost:5173",
    );
    expect(result.ok).toBe(true);
    expect(result.verifyUrl).toContain("/auth/account/callback?token=");
  });

  it("creates a session after magic-link verification", () => {
    const issued = requestAccountSignIn("driver@example.com", "/drive", "http://localhost:5173");
    const issuedToken = new URL(issued.verifyUrl!).searchParams.get("token");
    expect(issuedToken).toBeTruthy();

    const verified = verifyAccountMagicLink(issuedToken!);
    expect(verified.email).toBe("driver@example.com");
    expect(getAccountSession(verified.sessionToken)?.userId).toBe(verified.userId);
  });

  it("rejects invalid session tokens for protected actions", () => {
    expect(() => requireAccountSession("missing-token")).toThrow(/Authentication required/i);
  });

  it("rejects reused magic links", () => {
    const issued = requestAccountSignIn("driver@example.com", "/drive", "http://localhost:5173");
    const token = new URL(issued.verifyUrl!).searchParams.get("token")!;
    verifyAccountMagicLink(token);
    expect(() => verifyAccountMagicLink(token)).toThrow(/expired or invalid/i);
  });

  it("accepts persisted session tokens until expiry", () => {
    saveAccountSession({
      token: "session-1",
      userId: "11111111-1111-4111-8111-111111111111",
      email: "driver@example.com",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    expect(requireAccountSession("session-1").email).toBe("driver@example.com");
  });
});
