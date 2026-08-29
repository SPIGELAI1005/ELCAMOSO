import type { MotionSample } from "@/lib/motion/types";
import type { TeslaFleetTelemetryRecord } from "@/lib/motion/vehicle-telemetry/types";

const MPH_TO_KMH = 1.609344;

const AXLE_SPEED_FIELDS = [
  "DiAxleSpeedR",
  "DiAxleSpeedF",
  "DiAxleSpeedREL",
  "DiAxleSpeedRER",
] as const;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Tesla PedalPosition is a real; normalize to 0..1 without inventing values. */
export function normalizePedalPosition(raw: number): number | null {
  if (!Number.isFinite(raw) || raw < 0) return null;
  if (raw <= 1) return raw;
  if (raw <= 100) return raw / 100;
  return null;
}

function pickAxleSpeedRpm(fields: TeslaFleetTelemetryRecord["fields"]): number | null {
  let best: number | null = null;
  for (const key of AXLE_SPEED_FIELDS) {
    const value = finiteNumber(fields[key]);
    if (value === null || value < 0) continue;
    best = best === null ? value : Math.max(best, value);
  }
  return best;
}

function pickVehicleOperatingState(fields: TeslaFleetTelemetryRecord["fields"]): string | null {
  const gear = finiteString(fields["Gear"]);
  if (gear) return gear.toUpperCase();
  const driveRail = fields["DriveRail"];
  if (driveRail === true) return "READY";
  if (driveRail === false) return "STANDBY";
  return null;
}

/**
 * Map Tesla Fleet Telemetry fields to a MotionSample.
 * Returns null when no mappable motion fields are present.
 *
 * Official units (Tesla Available Data docs):
 * - VehicleSpeed: miles per hour
 * - LongitudinalAcceleration / LateralAcceleration: m/s²
 * - GpsHeading: degrees (0 = North)
 * - PedalPosition: accelerator position (real)
 * - DiAxleSpeed*: motor speed at axle (RPM)
 * - Gear: ShiftState enum string
 * - DriveRail: drive power ready boolean
 */
export function mapTeslaFleetSignalsToMotionSample(
  record: TeslaFleetTelemetryRecord,
): MotionSample | null {
  const fields = record.fields;
  const speedMph = finiteNumber(fields["VehicleSpeed"]);
  const longitudinal = finiteNumber(fields["LongitudinalAcceleration"]);
  const lateral = finiteNumber(fields["LateralAcceleration"]);
  const heading = finiteNumber(fields["GpsHeading"]);
  const pedalRaw = finiteNumber(fields["PedalPosition"]);
  const pedalPosition = pedalRaw !== null ? normalizePedalPosition(pedalRaw) : null;
  const motorAxleSpeedRpm = pickAxleSpeedRpm(fields);
  const vehicleOperatingState = pickVehicleOperatingState(fields);

  const hasMotion =
    speedMph !== null ||
    longitudinal !== null ||
    lateral !== null ||
    heading !== null ||
    pedalPosition !== null ||
    motorAxleSpeedRpm !== null ||
    vehicleOperatingState !== null;
  if (!hasMotion) return null;

  const sample: MotionSample = {
    timestamp: record.receivedAt,
    source: "vehicle-telemetry",
  };

  if (speedMph !== null && speedMph >= 0) {
    sample.speedKmh = speedMph * MPH_TO_KMH;
  }
  if (longitudinal !== null) {
    sample.accelerationLongitudinal = longitudinal;
  }
  if (lateral !== null) {
    sample.accelerationLateral = lateral;
  }
  if (heading !== null) {
    sample.heading = heading;
  }
  if (pedalPosition !== null) {
    sample.pedalPosition = pedalPosition;
  }
  if (motorAxleSpeedRpm !== null) {
    sample.motorAxleSpeedRpm = motorAxleSpeedRpm;
  }
  if (vehicleOperatingState !== null) {
    sample.vehicleOperatingState = vehicleOperatingState;
  }

  return sample;
}
