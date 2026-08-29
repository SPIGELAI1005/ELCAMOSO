import { describe, expect, it } from "vitest";
import {
  connectionNeedsAttention,
  connectionQualityFromStatus,
  connectionQualityLabel,
  driveSignalQualityLabel,
  dynamicDriveCockpitLabel,
  dynamicDriveStatusLabel,
  formatDriveGear,
} from "@/lib/drive/drive-connection";

describe("drive-connection", () => {
  it("maps product status to connection quality labels", () => {
    expect(connectionQualityLabel(connectionQualityFromStatus("vehicle-connected"))).toBe(
      "Vehicle connected",
    );
    expect(connectionQualityLabel(connectionQualityFromStatus("sound-active"))).toBe("");
    expect(connectionQualityLabel(connectionQualityFromStatus("gps-only"))).toBe("GPS only");
    expect(connectionQualityLabel(connectionQualityFromStatus("weak-signal"))).toBe("Weak signal");
  });

  it("labels drive signal quality in plain language", () => {
    expect(driveSignalQualityLabel("vehicle-connected")).toBe("Vehicle connected");
    expect(driveSignalQualityLabel("sound-active")).toBe("");
    expect(driveSignalQualityLabel("weak-signal")).toBe("Weak");
  });

  it("formats gear for display", () => {
    expect(formatDriveGear(4)).toBe("4");
    expect(formatDriveGear(0)).toBe("N");
    expect(formatDriveGear(-1)).toBe("R");
  });

  it("labels motion response mode for remote hints", () => {
    expect(dynamicDriveStatusLabel(true)).toBe("Full response");
    expect(dynamicDriveStatusLabel(false)).toBe("Classic");
  });

  it("hides cockpit mode subtitle in product UI", () => {
    expect(dynamicDriveCockpitLabel(true)).toBe("");
    expect(dynamicDriveCockpitLabel(false)).toBe("");
  });

  it("flags connection rows that need attention", () => {
    expect(connectionNeedsAttention("sound-active")).toBe(false);
    expect(connectionNeedsAttention("vehicle-connected")).toBe(false);
    expect(connectionNeedsAttention("gps-only")).toBe(true);
    expect(connectionNeedsAttention("weak-signal")).toBe(true);
  });
});
