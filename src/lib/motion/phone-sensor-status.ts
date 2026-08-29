export type PhoneGpsStatus = "unavailable" | "denied" | "searching" | "live" | "weak";
export type PhoneMotionStatus = "unavailable" | "denied" | "calibrating" | "live";
export type PhoneCalibrationStatus = "pending" | "calibrating" | "ready" | "skipped";
export type PhoneSignalHealth = "strong" | "fair" | "weak" | "offline";

export interface PhoneSensorAvailabilityFlags {
  geolocation: boolean;
  motion: boolean;
  orientation: boolean;
}

export interface PhoneSensorStatusSnapshot {
  availability: PhoneSensorAvailabilityFlags;
  gps: PhoneGpsStatus;
  motion: PhoneMotionStatus;
  calibration: PhoneCalibrationStatus;
  signalHealth: PhoneSignalHealth;
  gpsAgeMs: number | null;
  motionAgeMs: number | null;
  sendHz: number;
}

export function gpsStatusLabel(status: PhoneGpsStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "weak":
      return "Weak";
    case "searching":
      return "Searching";
    case "denied":
      return "Denied";
    default:
      return "Unavailable";
  }
}

export function motionStatusLabel(status: PhoneMotionStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "calibrating":
      return "Calibrating";
    case "denied":
      return "Denied";
    default:
      return "Unavailable";
  }
}

export function calibrationStatusLabel(status: PhoneCalibrationStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "calibrating":
      return "Calibrating";
    case "skipped":
      return "Skipped";
    default:
      return "Pending";
  }
}

export function signalHealthLabel(health: PhoneSignalHealth): string {
  switch (health) {
    case "strong":
      return "Strong";
    case "fair":
      return "Fair";
    case "weak":
      return "Weak";
    default:
      return "Offline";
  }
}

export function computeSignalHealth(input: {
  relayConnected: boolean;
  gpsAgeMs: number | null;
  motionAgeMs: number | null;
  sendHz: number;
  motionAvailable?: boolean;
}): PhoneSignalHealth {
  if (!input.relayConnected) return "offline";
  const motionRequired = input.motionAvailable !== false;
  const gpsOk = input.gpsAgeMs !== null && input.gpsAgeMs < 2500;
  const motionOk = !motionRequired || (input.motionAgeMs !== null && input.motionAgeMs < 500);
  const rateOk = input.sendHz >= 8;
  if (gpsOk && motionOk && rateOk) return "strong";
  if ((gpsOk || motionOk) && input.sendHz >= 4) return "fair";
  if (gpsOk || motionOk) return "weak";
  return "weak";
}

export function phoneSensorNeedsAttention(sensor: PhoneSensorStatusSnapshot): boolean {
  return phoneSensorAttentionMessage(sensor) !== null;
}

/** One-line product copy when the phone link needs attention — no sensor grid. */
export function phoneSensorAttentionMessage(sensor: PhoneSensorStatusSnapshot): string | null {
  if (sensor.gps === "denied" || sensor.motion === "denied") {
    return "Allow location and motion so the car can follow the road.";
  }
  if (sensor.motion === "unavailable") {
    return "Motion access is unavailable on this browser.";
  }
  if (sensor.gps === "searching") {
    return "Finding GPS signal…";
  }
  if (sensor.gps === "weak" || sensor.signalHealth === "weak") {
    return "GPS is weak. Open sky helps sound stay in sync.";
  }
  if (sensor.calibration === "calibrating" && sensor.motion !== "live") {
    return "Learning how you move…";
  }
  if (sensor.signalHealth === "offline") {
    return "Connection interrupted. Keep this screen open.";
  }
  return null;
}
