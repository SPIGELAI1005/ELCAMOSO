import { describe, expect, it } from "vitest";
import { mapVehicleDataToTelemetryRecord } from "@/lib/tesla/map-vehicle-data";
import { mapTeslaFleetSignalsToMotionSample } from "@/lib/motion/vehicle-telemetry/map-tesla-signals";

describe("mapVehicleDataToTelemetryRecord", () => {
  it("maps official drive_state fields without inventing values", () => {
    const record = mapVehicleDataToTelemetryRecord({
      vin: "VIN123",
      response: {
        response: {
          drive_state: {
            speed: 45,
            shift_state: "D",
            pedal_position: 22,
            power: 12,
            timestamp: 1_700_000_000,
          },
        },
      },
    });

    expect(record?.fields["VehicleSpeed"]).toBe(45);
    expect(record?.fields["Gear"]).toBe("D");
    expect(record?.fields["PedalPosition"]).toBe(22);
    expect(record?.fields["DriveRail"]).toBe(true);

    const sample = mapTeslaFleetSignalsToMotionSample(record!);
    expect(sample?.speedKmh).toBeCloseTo(72.42, 1);
    expect(sample?.pedalPosition).toBeCloseTo(0.22, 2);
  });

  it("returns null when drive_state has no motion fields", () => {
    expect(
      mapVehicleDataToTelemetryRecord({
        vin: "VIN123",
        response: { response: { drive_state: { timestamp: 1 } } },
      }),
    ).toBeNull();
  });
});
