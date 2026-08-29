import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveLinkTokens, resetTeslaLinkStoreForTests } from "@/lib/tesla/link-store";
import { TESLA_SCOPE_STRING } from "@/lib/tesla/scopes";
import {
  ingestFleetTelemetryRecord,
  pullVehicleTelemetryRecord,
  resetTelemetryBridgeForTests,
} from "@/lib/tesla/telemetry-bridge";
import { resetTelemetryCacheForTests } from "@/lib/tesla/telemetry-cache";

describe("telemetry-bridge", () => {
  beforeEach(() => {
    process.env.TESLA_TOKEN_ENCRYPTION_KEY = "d".repeat(64);
    saveLinkTokens("link-stream", {
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: Date.now() + 3600_000,
      fleetApiBase: "https://fleet-api.prd.na.vn.cloud.tesla.com",
      scopes: TESLA_SCOPE_STRING,
      region: "NA",
    });
  });

  afterEach(() => {
    resetTelemetryCacheForTests();
    resetTelemetryBridgeForTests();
    resetTeslaLinkStoreForTests();
  });

  it("prefers fresh streamed records over polling", async () => {
    ingestFleetTelemetryRecord(
      {
        receivedAt: Date.now(),
        vin: "VIN999",
        fields: { VehicleSpeed: 30 },
      },
      "link-stream",
    );

    const record = await pullVehicleTelemetryRecord({ linkId: "link-stream", vin: "VIN999" });
    expect(record?.fields["VehicleSpeed"]).toBe(30);
  });

  it("returns null when link is unknown", async () => {
    const record = await pullVehicleTelemetryRecord({ linkId: "missing" });
    expect(record).toBeNull();
  });
});
