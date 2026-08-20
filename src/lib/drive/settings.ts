import { DEFAULT_PROFILE_ID } from "@/lib/sound/profiles";

export interface ElcamosoSettings {
  profileId: string;
  volume: number;
  demoMotion: boolean;
  safetyAcknowledged: boolean;
}

const KEY = "elcamoso.settings";

export const DEFAULT_SETTINGS: ElcamosoSettings = {
  profileId: DEFAULT_PROFILE_ID,
  volume: 0.7,
  demoMotion: false,
  safetyAcknowledged: false,
};

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
  window.localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent("elcamoso:settings"));
  return merged;
}
