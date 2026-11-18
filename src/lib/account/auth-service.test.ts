import { beforeEach, describe, expect, it } from "vitest";

import {
  ACCOUNT_LOOKUP_FAILED_MESSAGE,
  createSessionFromVerifiedEmail,
  getAccountSession,
  requestAccountSignIn,
  requireAccountSession,
  verifyAccountMagicLink,
} from "@/lib/account/auth-service";
import {
  resetAccountAuthStoreForTests,
  resolveUserIdForEmail,
  saveAccountSession,
} from "@/lib/account/session-store";

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

  it("creates a session after magic-link verification", async () => {
    const issued = requestAccountSignIn("driver@example.com", "/drive", "http://localhost:5173");
    const issuedToken = new URL(issued.verifyUrl!).searchParams.get("token");
    expect(issuedToken).toBeTruthy();

    const verified = await verifyAccountMagicLink(issuedToken!);
    expect(verified.email).toBe("driver@example.com");
    expect(getAccountSession(verified.sessionToken)?.userId).toBe(verified.userId);
  });

  it("rejects invalid session tokens for protected actions", () => {
    expect(() => requireAccountSession("missing-token")).toThrow(/Authentication required/i);
  });

  it("rejects reused magic links", async () => {
    const issued = requestAccountSignIn("driver@example.com", "/drive", "http://localhost:5173");
    const token = new URL(issued.verifyUrl!).searchParams.get("token")!;
    await verifyAccountMagicLink(token);
    await expect(verifyAccountMagicLink(token)).rejects.toThrow(/expired or invalid/i);
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

  it("treats gmail and googlemail as the same in-memory account", async () => {
    const issued = requestAccountSignIn(
      "george.m.neacsu@googlemail.com",
      "/drive",
      "http://localhost:5173",
    );
    const token = new URL(issued.verifyUrl!).searchParams.get("token")!;
    const verified = await verifyAccountMagicLink(token);
    expect(verified.email).toBe("george.m.neacsu@gmail.com");
    const again = createSessionFromVerifiedEmail("george.m.neacsu@gmail.com");
    expect(again.userId).toBe(verified.userId);
    expect(resolveUserIdForEmail("george.m.neacsu@googlemail.com")).toBe(verified.userId);
  });

  it("does not mint a new id when a durable lookup is required and missing", () => {
    const previous = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgres://pglite-test/elcamoso";
    try {
      expect(() => createSessionFromVerifiedEmail("driver@example.com")).toThrow(
        ACCOUNT_LOOKUP_FAILED_MESSAGE,
      );
      expect(resolveUserIdForEmail("driver@example.com")).toBeNull();
    } finally {
      if (previous === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = previous;
    }
  });
});
