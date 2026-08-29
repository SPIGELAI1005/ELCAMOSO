import { describe, expect, it } from "vitest";
import { mapTeslaFleetSignalsToMotionSample } from "@/lib/motion/vehicle-telemetry/map-tesla-signals";

describe("mapTeslaFleetSignalsToMotionSample", () => {
  it("returns null when no mappable fields are present", () => {
    expect(
      mapTeslaFleetSignalsToMotionSample({
        receivedAt: 1000,
        fields: { Soc: 82 },
      }),
    ).toBeNull();
  });

  it("converts VehicleSpeed from mph to kmh", () => {
    const sample = mapTeslaFleetSignalsToMotionSample({
      receivedAt: 2000,
      fields: { VehicleSpeed: 60 },
    });
    expect(sample?.source).toBe("vehicle-telemetry");
    expect(sample?.speedKmh).toBeCloseTo(96.56, 1);
  });

  it("passes through longitudinal acceleration in m/s²", () => {
    const sample = mapTeslaFleetSignalsToMotionSample({
      receivedAt: 3000,
      fields: { LongitudinalAcceleration: -2.4 },
    });
    expect(sample?.accelerationLongitudinal).toBe(-2.4);
    expect(sample?.speedKmh).toBeUndefined();
  });

  it("maps heading when provided", () => {
    const sample = mapTeslaFleetSignalsToMotionSample({
      receivedAt: 4000,
      fields: { GpsHeading: 90, VehicleSpeed: 30 },
    });
    expect(sample?.heading).toBe(90);
  });

  it("ignores non-finite values", () => {
    const sample = mapTeslaFleetSignalsToMotionSample({
      receivedAt: 5000,
      fields: { VehicleSpeed: NaN, LongitudinalAcceleration: Infinity },
    });
    expect(sample).toBeNull();
  });

  it("maps pedal position, axle speed, and gear", () => {
    const sample = mapTeslaFleetSignalsToMotionSample({
      receivedAt: 6000,
      fields: {
        PedalPosition: 42,
        DiAxleSpeedR: 1800,
        DiAxleSpeedF: 1200,
        Gear: "D",
        DriveRail: true,
      },
    });
    expect(sample?.pedalPosition).toBeCloseTo(0.42, 2);
    expect(sample?.motorAxleSpeedRpm).toBe(1800);
    expect(sample?.vehicleOperatingState).toBe("D");
  });
});
