import type { SoundProfile } from "@/lib/sound/profiles";
import type { DriveState } from "@/lib/drive/model";
import type { MotionState } from "@/lib/drive/motion-energy";

export type DriveDisplayKind = "combustion" | "electric" | "ambient" | "cadence";

const AMBIENT_IDS = new Set([
  "open-wind",
  "storm-glider",
  "zen-drive",
  "rain-drive",
  "ocean-drive",
  "heartbeat",
  "deep-bass-pulse",
  "synthwave-drive",
  "neon-drive",
  "retro-arcade",
]);

const CADENCE_IDS = new Set([
  "horse-gallop",
  "wild-west-carriage",
  "romanian-85-carriage",
  "steam-train",
  "laughing-machine",
  "farting-car",
  "kazoo-kart",
  "santa-sleigh",
]);

export function driveDisplayKind(profile: SoundProfile): DriveDisplayKind {
  if (CADENCE_IDS.has(profile.id) || profile.category === "Playful") return "cadence";
  if (
    AMBIENT_IDS.has(profile.id) ||
    profile.category === "Nature" ||
    profile.category === "Musical"
  ) {
    return "ambient";
  }
  if (profile.drivetrainMode === "continuous") return "electric";
  return "combustion";
}

export interface DriveSecondaryReadout {
  value: string;
  label: string;
  gearLabel: string | null;
}

export function driveSecondaryReadout(
  profile: SoundProfile,
  state: DriveState,
  motion: MotionState,
): DriveSecondaryReadout {
  const kind = driveDisplayKind(profile);
  if (kind === "combustion") {
    return {
      value: String(Math.round(state.rpm)),
      label: "Rev",
      gearLabel: state.gear > 0 ? `D${state.gear}` : state.gear < 0 ? "R" : "N",
    };
  }
  if (kind === "electric") {
    return {
      value: String(Math.round(motion.motionEnergy * 100)),
      label: state.regen > 0.25 ? "Regen" : "Energy",
      gearLabel: null,
    };
  }
  if (kind === "cadence") {
    const gait =
      state.speed * 3.6 < 7
        ? "Walk"
        : state.speed * 3.6 < 16
          ? "Trot"
          : state.speed * 3.6 < 28
            ? "Canter"
            : "Gallop";
    return {
      value: gait,
      label: "Cadence",
      gearLabel: null,
    };
  }
  return {
    value: String(Math.round(Math.max(state.load, motion.motionEnergy) * 100)),
    label: "Intensity",
    gearLabel: null,
  };
}
