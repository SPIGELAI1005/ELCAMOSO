import type { DriveProductStatus } from "@/lib/drive/session";
import type { DriveState } from "@/lib/drive/model";
import type { SoundProfile } from "@/lib/sound/profiles";
import { driveDisplayKind } from "@/lib/drive/drive-display";
import type { SpeedFreshness } from "@/lib/powertrain/types";

/** How trustworthy the numeric speed readout is for the cockpit. */
export type CockpitSpeedAvailability = "live" | "estimate" | "stale" | "unavailable";

export interface CockpitSpeedView {
  /** Numeric value for live/estimate; empty when unavailable/stale. */
  value: string;
  /** True when the unit label should sit under the value. */
  showUnit: boolean;
  /** Short caption under the cluster (empty when silent). */
  caption: string;
  availability: CockpitSpeedAvailability;
}

export type CockpitSecondaryKind = "gear" | "regime";

export interface CockpitSecondaryView {
  kind: CockpitSecondaryKind;
  /** Gear numeral / R / N, or regime word (Cruise, Regen, …). */
  value: string;
  label: string;
  /** Always remind that gear/RPM are simulated when shown. */
  simulatedCaption: string;
  /** 0..1 arc fill from drivetrain RPM when combustion; energy otherwise. */
  arcProgress: number;
  /** Rounded RPM for combustion; empty for gearless regimes. */
  rpmText: string;
  showRpm: boolean;
}

const VOLUME_STEP = 0.05;

export function cockpitSpeedAvailability(input: {
  productStatus: DriveProductStatus;
  speedFreshness?: SpeedFreshness | null;
  /** Session kind; demo/audition treat speed as live simulation. */
  sessionKind?: string;
}): CockpitSpeedAvailability {
  const { productStatus, speedFreshness, sessionKind } = input;
  if (
    sessionKind === "demo" ||
    sessionKind === "audition" ||
    sessionKind === "ab" ||
    sessionKind === "replay" ||
    productStatus === "simulation"
  ) {
    return "live";
  }
  if (productStatus === "idle" || productStatus === "sound-paused") {
    return productStatus === "sound-paused" ? "stale" : "unavailable";
  }
  if (productStatus === "weak-signal") return "stale";
  if (speedFreshness === "stale" || speedFreshness === "hold" || speedFreshness === "decay") {
    return "stale";
  }
  if (speedFreshness === "uncertain") return "estimate";
  if (productStatus === "gps-only") return "estimate";
  if (productStatus === "vehicle-connected" || productStatus === "sound-active") return "live";
  return "estimate";
}

/**
 * Format speed for the cockpit. Never shows a misleading zero when telemetry is
 * unavailable or stale - GPS zero alone is not treated as parked proof here.
 */
export function formatCockpitSpeed(
  speedMps: number,
  availability: CockpitSpeedAvailability,
  unitLabel: string,
  displayValue: number,
): CockpitSpeedView {
  if (availability === "unavailable") {
    return {
      value: "—",
      showUnit: false,
      caption: "Speed unavailable",
      availability,
    };
  }
  if (availability === "stale") {
    return {
      value: "—",
      showUnit: false,
      caption: "Waiting for motion",
      availability,
    };
  }
  const caption =
    availability === "estimate"
      ? `GPS estimate · ${unitLabel}`
      : unitLabel;
  return {
    value: String(Math.max(0, Math.round(displayValue))),
    showUnit: true,
    caption: availability === "estimate" ? "GPS estimate" : "",
    availability,
  };
}

/** Regime / gear secondary readout from the single drivetrain state. */
export function cockpitSecondaryView(
  profile: SoundProfile,
  state: DriveState,
): CockpitSecondaryView {
  const kind = driveDisplayKind(profile);
  const pt = state.powertrain;
  const rpm = pt?.rpm ?? state.rpm;
  const gear = pt?.gear ?? state.gear;
  const redline = pt ? Math.max(rpm, 1) : 7000;
  const idle = 800;
  const maxRpm = Math.max(redline, idle + 1);
  // Prefer personality redline when present via normalizedRpm.
  const arcFromNorm = pt?.normalizedRpm;
  const arcProgress =
    typeof arcFromNorm === "number"
      ? Math.min(1, Math.max(0, arcFromNorm))
      : Math.min(1, Math.max(0, (rpm - idle) / (maxRpm - idle)));

  if (kind === "combustion" && profile.drivetrainMode === "virtual-transmission") {
    const gearValue =
      gear < 0 ? "R" : gear === 0 ? "N" : String(Math.max(1, Math.round(gear)));
    return {
      kind: "gear",
      value: gearValue,
      label: "Gear",
      simulatedCaption: "Simulated gear · RPM",
      arcProgress,
      rpmText: String(Math.round(rpm)),
      showRpm: true,
    };
  }

  if (kind === "electric" || profile.drivetrainMode === "continuous") {
    const regime =
      state.regen > 0.25 ? "Regen" : state.speed * 3.6 < 1.5 ? "Idle" : "Drive";
    return {
      kind: "regime",
      value: regime,
      label: "Regime",
      simulatedCaption: "Simulated response",
      arcProgress: Math.min(1, Math.max(state.load, state.throttle)),
      rpmText: "",
      showRpm: false,
    };
  }

  if (kind === "cadence") {
    const kmh = state.speed * 3.6;
    const gait =
      kmh < 7 ? "Walk" : kmh < 16 ? "Trot" : kmh < 28 ? "Canter" : "Gallop";
    return {
      kind: "regime",
      value: gait,
      label: "Cadence",
      simulatedCaption: "Simulated cadence",
      arcProgress: Math.min(1, kmh / 40),
      rpmText: "",
      showRpm: false,
    };
  }

  const intensity = Math.round(Math.max(state.load, state.throttle) * 100);
  return {
    kind: "regime",
    value: String(intensity),
    label: "Intensity",
    simulatedCaption: "Simulated intensity",
    arcProgress: Math.min(1, Math.max(state.load, state.throttle)),
    rpmText: "",
    showRpm: false,
  };
}

/** First N favourites that still exist in the catalog (keep expired-access ids). */
export function cockpitFavouriteSlots(
  favourites: readonly string[],
  catalogIds: ReadonlySet<string>,
  max = 3,
): string[] {
  const out: string[] = [];
  for (const id of favourites) {
    if (!catalogIds.has(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function stepMasterVolume(volume: number, direction: 1 | -1): number {
  const next = volume + direction * VOLUME_STEP;
  return Math.min(1, Math.max(0, Math.round(next * 100) / 100));
}

export function volumePercentLabel(volume: number, muted: boolean): string {
  if (muted || volume <= 0) return "Muted";
  return `${Math.round(volume * 100)}%`;
}

/** Telemetry status copy for the header - restrained, no raw sensors. */
export function cockpitTelemetryLabel(productStatus: DriveProductStatus): string {
  switch (productStatus) {
    case "vehicle-connected":
      return "Vehicle";
    case "gps-only":
      return "GPS";
    case "weak-signal":
      return "Weak signal";
    case "sound-paused":
      return "Paused";
    case "simulation":
      return "Demo";
    case "sound-active":
      return "Live";
    default:
      return "";
  }
}
