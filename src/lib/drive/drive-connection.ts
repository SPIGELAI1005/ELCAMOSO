import type { DriveProductStatus } from "@/lib/drive/session";

/** Consumer-facing motion link quality (no raw sensor values). */
export type ConnectionQuality = "live" | "vehicle" | "gps" | "weak" | "paused" | "idle";

export function connectionQualityFromStatus(status: DriveProductStatus): ConnectionQuality {
  switch (status) {
    case "vehicle-connected":
      return "vehicle";
    case "sound-active":
      return "live";
    case "gps-only":
      return "gps";
    case "weak-signal":
      return "weak";
    case "sound-paused":
      return "paused";
    default:
      return "idle";
  }
}

export function connectionQualityLabel(quality: ConnectionQuality): string {
  switch (quality) {
    case "vehicle":
      return "Vehicle connected";
    case "live":
      return "";
    case "gps":
      return "GPS only";
    case "weak":
      return "Weak signal";
    case "paused":
      return "Paused";
    default:
      return "";
  }
}

/** Cockpit instrument subtitle — hidden in product UI (profile name is enough). */
export function dynamicDriveCockpitLabel(_active: boolean): string {
  return "";
}

/** Whether the connection row should use emphasis (not raw telemetry). */
export function connectionNeedsAttention(status: DriveProductStatus): boolean {
  const q = connectionQualityFromStatus(status);
  return q === "gps" || q === "weak" || q === "paused";
}

/** Settings / remote hint — not shown on the main Drive instrument. */
export function dynamicDriveStatusLabel(active: boolean): string {
  return active ? "Full response" : "Classic";
}

/** 1-based gear display for the instrument cluster. */
export function formatDriveGear(gear: number): string {
  if (gear < 0) return "R";
  if (gear === 0) return "N";
  return String(gear);
}

/** Drive Signal quality for the cockpit (plain language, no API terms). */
export function driveSignalQualityLabel(status: DriveProductStatus): string {
  switch (status) {
    case "vehicle-connected":
      return "Vehicle connected";
    case "sound-active":
      return "";
    case "gps-only":
      return "Fair";
    case "weak-signal":
      return "Weak";
    case "sound-paused":
      return "Paused";
    default:
      return "";
  }
}
