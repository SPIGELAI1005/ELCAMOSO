import { describe, expect, it } from "vitest";
import { computeSignalHealth, phoneSensorNeedsAttention } from "@/lib/motion/phone-sensor-status";

const baseAvailability = { geolocation: true, motion: true, orientation: true };

describe("phone-sensor-status", () => {
  it("marks offline when relay disconnected", () => {
    expect(
      computeSignalHealth({
        relayConnected: false,
        gpsAgeMs: 0,
        motionAgeMs: 0,
        sendHz: 15,
      }),
    ).toBe("offline");
  });

  it("allows GPS-only health when motion unavailable", () => {
    expect(
      computeSignalHealth({
        relayConnected: true,
        gpsAgeMs: 100,
        motionAgeMs: null,
        sendHz: 12,
        motionAvailable: false,
      }),
    ).toBe("strong");
  });

  it("flags attention when permissions denied", () => {
    expect(
      phoneSensorNeedsAttention({
        availability: baseAvailability,
        gps: "denied",
        motion: "live",
        calibration: "ready",
        signalHealth: "weak",
        gpsAgeMs: null,
        motionAgeMs: 100,
        sendHz: 10,
      }),
    ).toBe(true);
  });
});
