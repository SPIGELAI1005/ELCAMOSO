import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTeslaLinkStoreForTests, saveLinkTokens } from "@/lib/tesla/link-store";
import { consumeOAuthState, createOAuthState, resetOAuthStateForTests } from "@/lib/tesla/oauth";
import { TESLA_MINIMUM_SCOPES, TESLA_SCOPE_STRING } from "@/lib/tesla/scopes";
import {
  disconnectTesla,
  getTeslaConnectionStatus,
  handleTeslaOAuthCallback,
  startTeslaOAuth,
} from "@/lib/tesla/service";

const ENV_KEYS = [
  "TESLA_CLIENT_ID",
  "TESLA_CLIENT_SECRET",
  "TESLA_REDIRECT_URI",
  "TESLA_TOKEN_ENCRYPTION_KEY",
  "ELCAMOSO_ENV",
] as const;

function saveEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) snap[key] = process.env[key];
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snap[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("Tesla OAuth scopes", () => {
  it("requests minimum read-only scopes only", () => {
    expect(TESLA_MINIMUM_SCOPES).toEqual(["openid", "offline_access", "vehicle_device_data"]);
    expect(TESLA_SCOPE_STRING).not.toContain("vehicle_cmds");
    expect(TESLA_SCOPE_STRING).not.toContain("vehicle_location");
  });
});

describe("Tesla connection status", () => {
  const envSnap = saveEnv();

  beforeEach(() => {
    resetTeslaLinkStoreForTests();
    resetOAuthStateForTests();
    process.env.TESLA_CLIENT_ID = "test-client";
    process.env.TESLA_CLIENT_SECRET = "test-secret";
    process.env.TESLA_REDIRECT_URI = "http://localhost:5173/auth/tesla/callback";
    process.env.TESLA_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    process.env.ELCAMOSO_ENV = "development";
  });

  afterEach(() => {
    restoreEnv(envSnap);
    resetTeslaLinkStoreForTests();
    resetOAuthStateForTests();
    vi.unstubAllGlobals();
  });

  it("never exposes tokens in public status payloads", () => {
    saveLinkTokens("link-abc12345", {
      accessToken: "secret-access",
      refreshToken: "secret-refresh",
      expiresAt: Date.now() + 3600_000,
      fleetApiBase: "https://fleet-api.prd.na.vn.cloud.tesla.com",
      scopes: TESLA_SCOPE_STRING,
      region: "NA",
    });

    const status = getTeslaConnectionStatus("link-abc12345");
    const json = JSON.stringify(status);
    expect(json).not.toContain("secret-access");
    expect(json).not.toContain("secret-refresh");
    expect(status.linked).toBe(true);
  });

  it("requires consent before starting OAuth", () => {
    const denied = startTeslaOAuth({ linkId: "link-abc12345", consentAccepted: false });
    expect(denied.ok).toBe(false);

    const allowed = startTeslaOAuth({ linkId: "link-abc12345", consentAccepted: true });
    expect(allowed.ok).toBe(true);
    expect(allowed.authorizeUrl).toContain("client_id=test-client");
    expect(allowed.authorizeUrl).toContain("scope=");
    expect(allowed.authorizeUrl).toContain("require_requested_scopes=true");
  });

  it("completes OAuth callback and stores encrypted tokens server-side", async () => {
    const state = createOAuthState("link-abc12345");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
          scope: TESLA_SCOPE_STRING,
        }),
      }),
    );

    const result = await handleTeslaOAuthCallback({ code: "auth-code", state });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe("connected");

    const status = getTeslaConnectionStatus("link-abc12345");
    expect(status.linked).toBe(true);
    expect(JSON.stringify(status)).not.toContain("rt-456");
    expect(JSON.stringify(status)).not.toContain("at-123");
  });

  it("rejects expired OAuth state on callback", async () => {
    const state = createOAuthState("link-abc12345");
    consumeOAuthState(state);
    const result = await handleTeslaOAuthCallback({ code: "abc", state });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/expired|invalid/i);
  });

  it("revokes and deletes link on disconnect", async () => {
    saveLinkTokens("link-abc12345", {
      accessToken: "secret-access",
      refreshToken: "secret-refresh",
      expiresAt: Date.now() + 3600_000,
      fleetApiBase: "https://fleet-api.prd.na.vn.cloud.tesla.com",
      scopes: TESLA_SCOPE_STRING,
      region: "NA",
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await disconnectTesla("link-abc12345");
    expect(result.ok).toBe(true);
    expect(getTeslaConnectionStatus("link-abc12345").linked).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.tesla.com/oauth2/v3/revoke",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
