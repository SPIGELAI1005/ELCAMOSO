import {
  DRIVETRAIN_PERSONALITIES,
  getDrivetrainPersonality,
  listDrivetrainPersonalities,
  personalityToPowertrain,
} from "@/lib/drive/drivetrain-personalities";

export type {
  UpshiftRpmTable,
  KickdownProfile,
  DownshiftProfile,
  ShiftProfile,
  IdleStopProfile,
  RedlineProfile,
  RpmTrackingProfile,
  TransmissionProfile,
  PowertrainProfile,
} from "@/lib/powertrain/types-config";

export { profileIdleRpm } from "@/lib/powertrain/types-config";

export { getDrivetrainPersonality, listDrivetrainPersonalities, DRIVETRAIN_PERSONALITIES };

/** Built-in powertrain personalities (derived from drivetrain-personalities registry). */
export const POWERTRAIN_PROFILES = DRIVETRAIN_PERSONALITIES.map(personalityToPowertrain);

const byId = new Map(POWERTRAIN_PROFILES.map((p) => [p.id, p]));

export function getPowertrainProfile(id: string) {
  return byId.get(id) ?? POWERTRAIN_PROFILES[0]!;
}
