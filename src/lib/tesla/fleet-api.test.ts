import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTeslaLinkStoreForTests, saveLinkTokens } from "@/lib/tesla/link-store";
import { resolveUserFleetRegion } from "@/lib/tesla/fleet-api";
import { TESLA_SCOPE_STRING } from "@/lib/tesla/scopes";

describe("resolveUserFleetRegion", () => {
  beforeEach(() => {
    resetTeslaLinkStoreForTests();
    process.env.TESLA_TOKEN_ENCRYPTION_KEY = "c".repeat(64);
    saveLinkTokens("link-region", {
      accessToken: "token",
      refreshToken: "refresh",
      expiresAt: Date.now() + 3600_000,
      fleetApiBase: "https://fleet-api.prd.na.vn.cloud.tesla.com",
      scopes: TESLA_SCOPE_STRING,
      region: "NA",
    });
  });

  afterEach(() => {
    resetTeslaLinkStoreForTests();
    vi.unstubAllGlobals();
  });

  it("retries another region when the configured base returns 421", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 421, ok: false })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          response: {
            region: "EU",
            fleet_api_base_url: "https://fleet-api.prd.eu.vn.cloud.tesla.com",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveUserFleetRegion("link-region");
    expect(resolved?.region).toBe("EU");
    expect(resolved?.fleetApiBase).toContain("eu");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
