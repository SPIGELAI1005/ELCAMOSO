import { DEFAULT_PROFILE_ID } from "@/lib/sound/profiles";

/** Per-profile fine-tuning of how motion translates into sound state. */
export interface ProfileTuning {
  /** 0.2..2 — how strongly acceleration becomes throttle demand */
  throttle: number;
  /** 0.2..2 — how strongly speed/rpm becomes overall intensity */
  response: number;
  /** 0..2 — how strongly deceleration is heard as regeneration */
  regen: number;
}

export const DEFAULT_TUNING: ProfileTuning = { throttle: 1, response: 1, regen: 1 };

export interface ElcamosoSettings {
  profileId: string;
  volume: number;
  demoMotion: boolean;
  safetyAcknowledged: boolean;
  onboarded: boolean;
  lastDriveAt: number | null;
  /** calmer O ))) motion and transitions */
  reducedMotion: boolean;
  tuning: Record<string, ProfileTuning>;
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
  tuning: {},
};

export function getTuning(settings: ElcamosoSettings, profileId: string): ProfileTuning {
  return { ...DEFAULT_TUNING, ...(settings.tuning?.[profileId] ?? {}) };
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
    /* storage unavailable — keep the session in memory only */
  }
  window.dispatchEvent(new CustomEvent("elcamoso:settings"));
  return merged;
}
