import type { ElcamosoSettings } from "@/lib/drive/settings";
import { getProfileGain, getTuning } from "@/lib/drive/settings";
import type { SessionSnapshot } from "@/lib/drive/session";
import { getProfile, allProfiles } from "@/lib/sound/profiles";

export const RELAY_CONTROL_KINDS = {
  STATE_SYNC: "drive-state-sync",
  SET_PROFILE: "set-profile",
  SET_SOUND_INTENSITY: "set-sound-intensity",
  SET_TRANSMISSION: "set-transmission-mode",
  SET_TRANSIENT: "set-transient-intensity",
  SET_VOLUME: "set-master-volume",
  STOP_DRIVE: "stop-drive",
} as const;

export type RelayControlKind = (typeof RELAY_CONTROL_KINDS)[keyof typeof RELAY_CONTROL_KINDS];

/** Snapshot broadcast from Tesla display to phone remote UI. */
export interface DriveRemoteState {
  profileId: string;
  profileName: string;
  volume: number;
  /** Motion → sound intensity (tuning.response). */
  soundIntensity: number;
  profileGain: number;
  dynamicDrive: boolean;
  /** Rev-match / exhaust transient feel (shiftFeel.revMatch). */
  transientIntensity: number;
  driveStatus: "idle" | "starting" | "running" | "error";
  at: number;
}

export interface RemoteProfileOption {
  id: string;
  name: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function sessionDriveStatus(
  session: Pick<SessionSnapshot, "kind" | "status">,
): DriveRemoteState["driveStatus"] {
  if (session.status === "error") return "error";
  if (session.kind === "drive" && session.status === "starting") return "starting";
  if (session.kind === "drive" && session.status === "running") return "running";
  return "idle";
}

export function buildDriveRemoteState(
  settings: ElcamosoSettings,
  session: Pick<SessionSnapshot, "kind" | "status">,
): DriveRemoteState {
  const profile = getProfile(settings.profileId);
  const tuning = getTuning(settings, settings.profileId);
  return {
    profileId: settings.profileId,
    profileName: profile.name,
    volume: settings.volume,
    soundIntensity: tuning.response,
    profileGain: getProfileGain(settings, settings.profileId),
    dynamicDrive: settings.dynamicDrive,
    transientIntensity: settings.shiftFeel.revMatch,
    driveStatus: sessionDriveStatus(session),
    at: Date.now(),
  };
}

/** Curated list for the phone picker: active profile, favourites, then built-ins. */
export function remoteProfileOptions(settings: ElcamosoSettings): RemoteProfileOption[] {
  const catalog = allProfiles();
  const known = new Map(catalog.map((p) => [p.id, p.name]));
  const ids: string[] = [];
  const push = (id: string) => {
    if (!known.has(id) || ids.includes(id)) return;
    ids.push(id);
  };

  push(settings.profileId);
  for (const id of settings.favourites) push(id);
  for (const profile of catalog) push(profile.id);

  return ids.slice(0, 20).map((id) => ({ id, name: known.get(id)! }));
}

export function parseDriveRemoteState(payload: unknown): DriveRemoteState | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const profileId = str(p["profileId"]);
  const profileName = str(p["profileName"]);
  if (!profileId || !profileName) return null;
  const driveStatus = p["driveStatus"];
  return {
    profileId,
    profileName,
    volume: num(p["volume"], 0.7, 0, 1),
    soundIntensity: num(p["soundIntensity"], 1, 0.2, 2),
    profileGain: num(p["profileGain"], 1, 0.4, 1.6),
    dynamicDrive: p["dynamicDrive"] === true,
    transientIntensity: num(p["transientIntensity"], 0.5, 0, 1),
    driveStatus:
      driveStatus === "running" ||
      driveStatus === "starting" ||
      driveStatus === "error" ||
      driveStatus === "idle"
        ? driveStatus
        : "idle",
    at: num(p["at"], Date.now(), 0, Number.MAX_SAFE_INTEGER),
  };
}

/**
 * Apply a phone remote control action on the Tesla display.
 * Returns settings patch to persist; null when ignored.
 */
export function patchFromPhoneRemoteAction(
  kind: string,
  payload: unknown,
  settings: ElcamosoSettings,
): Partial<ElcamosoSettings> | null {
  switch (kind) {
    case RELAY_CONTROL_KINDS.SET_PROFILE: {
      const profileId = str((payload as Record<string, unknown> | undefined)?.["profileId"]);
      if (!profileId) return null;
      const known = new Set(allProfiles().map((p) => p.id));
      if (!known.has(profileId)) return null;
      return { profileId };
    }
    case RELAY_CONTROL_KINDS.SET_SOUND_INTENSITY: {
      const body = payload as Record<string, unknown> | undefined;
      const profileId = str(body?.["profileId"]) ?? settings.profileId;
      const known = new Set(allProfiles().map((p) => p.id));
      if (!known.has(profileId)) return null;
      const response = num(body?.["response"], 1, 0.2, 2);
      const tuning = getTuning(settings, profileId);
      return {
        tuning: {
          ...settings.tuning,
          [profileId]: { ...tuning, response },
        },
      };
    }
    case RELAY_CONTROL_KINDS.SET_TRANSMISSION: {
      const enabled = (payload as Record<string, unknown> | undefined)?.["dynamicDrive"];
      if (typeof enabled !== "boolean") return null;
      return { dynamicDrive: enabled };
    }
    case RELAY_CONTROL_KINDS.SET_TRANSIENT: {
      const revMatch = num(
        (payload as Record<string, unknown> | undefined)?.["revMatch"],
        settings.shiftFeel.revMatch,
        0,
        1,
      );
      return { shiftFeel: { ...settings.shiftFeel, revMatch } };
    }
    case RELAY_CONTROL_KINDS.SET_VOLUME: {
      const volume = num(
        (payload as Record<string, unknown> | undefined)?.["volume"],
        settings.volume,
        0,
        1,
      );
      return { volume };
    }
    default:
      return null;
  }
}

export function isStopDriveAction(kind: string): boolean {
  return kind === RELAY_CONTROL_KINDS.STOP_DRIVE;
}
