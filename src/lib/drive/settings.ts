import { DEFAULT_PROFILE_ID } from "@/lib/sound/profiles";

/** Per-profile fine-tuning of how motion translates into sound state. */
export interface ProfileTuning {
  /** 0.2..2 how strongly acceleration becomes throttle demand */
  throttle: number;
  /** 0.2..2 how strongly speed/rpm becomes overall intensity */
  response: number;
  /** 0..2 how strongly deceleration is heard as regeneration */
  regen: number;
}

export const DEFAULT_TUNING: ProfileTuning = { throttle: 1, response: 1, regen: 1 };

/** Per-profile balance gain so profiles sit at a comparable loudness. */
export const DEFAULT_PROFILE_GAIN = 1;

export interface ElcamosoSettings {
  profileId: string;
  /** master volume, 0..1 */
  volume: number;
  demoMotion: boolean;
  safetyAcknowledged: boolean;
  onboarded: boolean;
  lastDriveAt: number | null;
  /** calmer O ))) motion and transitions */
  reducedMotion: boolean;
  /** vibration feedback that follows throttle and regen */
  haptics: boolean;
  /** 0.4..2 device motion sensitivity from calibration */
  motionSensitivity: number;
  /** noise floor in m/s^2 measured during calibration */
  motionNoiseFloor: number;
  calibratedAt: number | null;
  tuning: Record<string, ProfileTuning>;
  /** per-profile balance gain, 0.4..1.6 */
  profileGain: Record<string, number>;
}

const KEY = "elcamoso.settings";

export const DEFAULT_SETTINGS: ElcamosoSettings = {
  profileId: DEFAULT_PROFILE_ID,
  volume: 0.7,
  demoMotion: false,
  safetyAcknowledged: false,
  onboarded: false,
  lastDriveAt: null,
  reducedMotion: false,
  haptics: false,
  motionSensitivity: 1,
  motionNoiseFloor: 0,
  calibratedAt: null,
  tuning: {},
  profileGain: {},
};

export function getTuning(settings: ElcamosoSettings, profileId: string): ProfileTuning {
  return { ...DEFAULT_TUNING, ...(settings.tuning?.[profileId] ?? {}) };
}

export function getProfileGain(settings: ElcamosoSettings, profileId: string): number {
  const value = settings.profileGain?.[profileId];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1.6, Math.max(0.4, value))
    : DEFAULT_PROFILE_GAIN;
}

export function readSettings(): ElcamosoSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(next: Partial<ElcamosoSettings>) {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const merged = { ...readSettings(), ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* storage unavailable, keep the session in memory only */
  }
  window.dispatchEvent(new CustomEvent("elcamoso:settings"));
  return merged;
}

/* ---------------------------------------------------------------- transfer */

const BACKUP_KIND = "elcamoso.settings.backup";
const BACKUP_VERSION = 1;

export interface SettingsBackup {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  settings: ElcamosoSettings;
}

export function buildBackup(): SettingsBackup {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: readSettings(),
  };
}

/** Downloads the saved profiles and drive settings as a JSON file. */
export function exportSettingsFile() {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elcamoso-settings-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Validates and normalises an imported backup into usable settings. */
export function parseBackup(raw: string): ElcamosoSettings {
  const data: unknown = JSON.parse(raw);
  const payload = isRecord(data) && isRecord(data["settings"]) ? data["settings"] : data;
  if (!isRecord(payload)) throw new Error("This file is not an ELCAMOSO backup.");

  const tuning: Record<string, ProfileTuning> = {};
  if (isRecord(payload["tuning"])) {
    for (const [id, value] of Object.entries(payload["tuning"])) {
      if (!isRecord(value)) continue;
      tuning[id] = {
        throttle: num(value["throttle"], 1, 0.2, 2),
        response: num(value["response"], 1, 0.2, 2),
        regen: num(value["regen"], 1, 0, 2),
      };
    }
  }

  const profileGain: Record<string, number> = {};
  if (isRecord(payload["profileGain"])) {
    for (const [id, value] of Object.entries(payload["profileGain"])) {
      profileGain[id] = num(value, 1, 0.4, 1.6);
    }
  }

  return {
    ...DEFAULT_SETTINGS,
    profileId:
      typeof payload["profileId"] === "string" ? payload["profileId"] : DEFAULT_PROFILE_ID,
    volume: num(payload["volume"], DEFAULT_SETTINGS.volume, 0, 1),
    demoMotion: bool(payload["demoMotion"], false),
    safetyAcknowledged: bool(payload["safetyAcknowledged"], false),
    onboarded: bool(payload["onboarded"], false),
    reducedMotion: bool(payload["reducedMotion"], false),
    haptics: bool(payload["haptics"], false),
    motionSensitivity: num(payload["motionSensitivity"], 1, 0.4, 2),
    motionNoiseFloor: num(payload["motionNoiseFloor"], 0, 0, 10),
    calibratedAt:
      typeof payload["calibratedAt"] === "number" ? payload["calibratedAt"] : null,
    lastDriveAt: typeof payload["lastDriveAt"] === "number" ? payload["lastDriveAt"] : null,
    tuning,
    profileGain,
  };
}

export async function importSettingsFile(file: File) {
  const text = await file.text();
  const next = parseBackup(text);
  return writeSettings(next);
}
