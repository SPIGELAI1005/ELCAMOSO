import { describe, expect, it, afterEach } from "vitest";
import {
  createVehicleTelemetryProvider,
  resetVehicleTelemetryProvidersForTests,
} from "@/lib/motion/vehicle-telemetry/create-provider";
import { mapTeslaFleetSignalsToMotionSample } from "@/lib/motion/vehicle-telemetry/map-tesla-signals";
import { TeslaFleetTelemetryProvider } from "@/lib/motion/vehicle-telemetry/tesla-fleet-provider";

describe("VehicleTelemetryProvider", () => {
  afterEach(() => {
    resetVehicleTelemetryProvidersForTests();
  });

  it("returns disabled null provider when feature flag is off", () => {
    const provider = createVehicleTelemetryProvider({ enabled: false, kind: "tesla-fleet" });
    expect(provider.id).toBe("none");
    expect(provider.getStatus().status).toBe("disabled");
  });

  it("tesla provider emits samples only after ingest with real fields", async () => {
    const provider = createVehicleTelemetryProvider({
      enabled: true,
      kind: "tesla-fleet",
    }) as TeslaFleetTelemetryProvider;

    const samples: ReturnType<typeof mapTeslaFleetSignalsToMotionSample>[] = [];
    provider.subscribe((sample) => samples.push(sample));
    await provider.connect();

    expect(provider.ingest({ receivedAt: 1000, fields: { Soc: 50 } })).toBe(false);
    expect(samples).toHaveLength(0);

    expect(
      provider.ingest({
        receivedAt: 2000,
        fields: { VehicleSpeed: 45, LongitudinalAcceleration: 1.2 },
      }),
    ).toBe(true);
    expect(samples).toHaveLength(1);
    expect(samples[0]?.speedKmh).toBeCloseTo(72.42, 1);
    expect(samples[0]?.accelerationLongitudinal).toBe(1.2);
  });
});
