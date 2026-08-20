import { DEFAULT_PROFILE_ID, getProfile, SOUND_PROFILES } from "@/lib/sound/profiles";
import type { SoundProfile } from "@/lib/sound/profiles";
import {
  DEFAULT_ENVIRONMENT_ID,
  ENVIRONMENTS,
  getEnvironment,
  normalizeMix,
  type LayerMix,
} from "@/lib/sound/environments";
import {
  MAX_SNIPPET_BYTES,
  SNIPPET_TRIGGERS,
  type SnippetTrigger,
  type SoundSnippet,
} from "@/lib/sound/snippets";

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

/* ------------------------------------------------------------------ studio */

/** A Studio creation: a built-in profile reshaped by a handful of dials. */
export interface StudioTweaks {
  /** 0.5..2 overall pitch of the core voice */
  pitch: number;
  /** 0.4..2 how open and bright the sound is */
  brightness: number;
  /** 0..2 texture, grit and air */
  grit: number;
  /** 0..2 level of the atmospheric beds (water, gravel, wind) */
  texture: number;
  /** 0..2 speed of the rhythmic layer (hooves, bells, chuffs) */
  rhythm: number;
  /** 0..2 detune spread and character */
  character: number;
  /** signature one-shots such as horns, laughs and whinnies */
  signals: boolean;
}

export const DEFAULT_TWEAKS: StudioTweaks = {
  pitch: 1,
  brightness: 1,
  grit: 1,
  texture: 1,
  rhythm: 1,
  character: 1,
  signals: true,
};

export interface CustomSound {
  id: string;
  name: string;
  baseId: string;
  createdAt: number;
  tweaks: StudioTweaks;
  note?: string;
  /** driving environment saved with the sound */
  environmentId?: string;
  /** per-layer mixer saved with the sound */
  mix?: LayerMix;
}


/** Turns a Studio recipe into a playable profile. */
export function materializeCustom(sound: CustomSound): SoundProfile {
  const base = getProfile(sound.baseId);
  const t = { ...DEFAULT_TWEAKS, ...sound.tweaks };
  const v = base.voice;
  const scaleRhythm = <T extends { baseRate: number; rateScale: number } | undefined>(r: T) =>
    r ? { ...r, baseRate: r.baseRate * t.rhythm, rateScale: r.rateScale * t.rhythm } : undefined;

  const profile: SoundProfile = {
    ...base,
    id: sound.id,
    name: sound.name,
    category: "Garage",
    description: sound.note?.trim()
      ? sound.note.trim()
      : `A Studio sound built from ${base.name}.`,
    custom: true,
    baseId: base.id,
    createdAt: sound.createdAt,
    environmentId: getEnvironment(sound.environmentId).id,
    mix: normalizeMix(sound.mix),

    voice: {
      ...v,
      baseFrequency: v.baseFrequency * t.pitch,
      filterBase: v.filterBase * t.brightness,
      filterRange: v.filterRange * t.brightness,
      noise: Math.min(1, v.noise * t.grit),
      detune: v.detune * t.character,
      textures: (v.textures ?? []).map((tex) => ({
        ...tex,
        level: Math.min(1, tex.level * t.texture),
      })),
      signals: t.signals ? (v.signals ?? []) : [],
    },
  };
  const rhythm = scaleRhythm(v.rhythm);
  const rhythmB = scaleRhythm(v.rhythmB);
  if (rhythm) profile.voice.rhythm = rhythm;
  if (rhythmB) profile.voice.rhythmB = rhythmB;
  return profile;
}

/* ---------------------------------------------------------------- settings */

export interface ElcamosoSettings {
  profileId: string;
  /** master volume, 0..1 */
  volume: number;
  demoMotion: boolean;
  safetyAcknowledged: boolean;
  onboarded: boolean;
  /** last onboarding step reached, 0..2 */
  onboardingStep: number;
  lastDriveAt: number | null;
  /** number of drives started, shown in the Garage */
  driveCount: number;
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
  /** Studio creations kept in the Garage */
  customSounds: CustomSound[];
  /** profile ids marked as favourites */
  favourites: string[];
  /** curated lists of profiles for quick jumps */
  playlists: Playlist[];
  /** recorded or uploaded snippets mapped to driving states */
  snippets: SoundSnippet[];
  /** driving environment used for audition, demo and drive */
  environmentId: string;
  /** global per-layer mixer applied to built-in profiles */
  layerMix: LayerMix;
  /** show the diagnostics panel in Settings */
  devPanel: boolean;
}

/** A curated set of profiles you can step through while driving. */
export interface Playlist {
  id: string;
  name: string;
  profileIds: string[];
  createdAt: number;
}

const KEY = "elcamoso.settings";

export const DEFAULT_SETTINGS: ElcamosoSettings = {
  profileId: DEFAULT_PROFILE_ID,
  volume: 0.7,
  demoMotion: false,
  safetyAcknowledged: false,
  onboarded: false,
  onboardingStep: 0,
  lastDriveAt: null,
  driveCount: 0,
  reducedMotion: false,
  haptics: false,
  motionSensitivity: 1,
  motionNoiseFloor: 0,
  calibratedAt: null,
  tuning: {},
  profileGain: {},
  customSounds: [],
  favourites: [],
  playlists: [],
  snippets: [],
  environmentId: DEFAULT_ENVIRONMENT_ID,
  layerMix: normalizeMix(undefined),
  devPanel: false,
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

/* ------------------------------------------------------- validation layer */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

const str = (v: unknown, fallback: string) =>
  typeof v === "string" && v.trim() ? v : fallback;

function sanitizeTweaks(v: unknown): StudioTweaks {
  const r = isRecord(v) ? v : {};
  return {
    pitch: num(r["pitch"], 1, 0.5, 2),
    brightness: num(r["brightness"], 1, 0.4, 2),
    grit: num(r["grit"], 1, 0, 2),
    texture: num(r["texture"], 1, 0, 2),
    rhythm: num(r["rhythm"], 1, 0, 2),
    character: num(r["character"], 1, 0, 2),
    signals: bool(r["signals"], true),
  };
}

function sanitizeCustomSounds(v: unknown): CustomSound[] {
  if (!Array.isArray(v)) return [];
  const baseIds = new Set(SOUND_PROFILES.map((p) => p.id));
  const seen = new Set<string>();
  const out: CustomSound[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const id = str(item["id"], "");
    const baseId = str(item["baseId"], DEFAULT_PROFILE_ID);
    if (!id || seen.has(id) || !baseIds.has(baseId)) continue;
    seen.add(id);
    out.push({
      id,
      name: str(item["name"], "Untitled sound").slice(0, 40),
      baseId,
      createdAt: num(item["createdAt"], Date.now(), 0, Number.MAX_SAFE_INTEGER),
      tweaks: sanitizeTweaks(item["tweaks"]),
      note: typeof item["note"] === "string" ? item["note"].slice(0, 160) : "",
      environmentId: getEnvironment(
        typeof item["environmentId"] === "string" ? item["environmentId"] : null,
      ).id,
      mix: normalizeMix(item["mix"]),
    });
    if (out.length >= 60) break;
  }
  return out;
}

function sanitizePlaylists(v: unknown, knownIds: Set<string>): Playlist[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Playlist[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const id = str(item["id"], "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const profileIds = Array.isArray(item["profileIds"])
      ? Array.from(
          new Set(
            item["profileIds"].filter(
              (p): p is string => typeof p === "string" && knownIds.has(p),
            ),
          ),
        ).slice(0, 40)
      : [];
    out.push({
      id,
      name: str(item["name"], "Untitled list").slice(0, 40),
      profileIds,
      createdAt: num(item["createdAt"], Date.now(), 0, Number.MAX_SAFE_INTEGER),
    });
    if (out.length >= 20) break;
  }
  return out;
}

function sanitizeSnippets(v: unknown): SoundSnippet[] {
  if (!Array.isArray(v)) return [];
  const triggers = new Set(SNIPPET_TRIGGERS.map((t) => t.id));
  const seen = new Set<string>();
  const out: SoundSnippet[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const id = str(item["id"], "");
    const dataUrl = str(item["dataUrl"], "");
    if (!id || seen.has(id) || !dataUrl.startsWith("data:audio")) continue;
    if (dataUrl.length > MAX_SNIPPET_BYTES * 1.4) continue;
    seen.add(id);
    const rawTrigger = str(item["trigger"], "throttle");
    out.push({
      id,
      name: str(item["name"], "Snippet").slice(0, 40),
      dataUrl,
      trigger: (triggers.has(rawTrigger as SnippetTrigger)
        ? rawTrigger
        : "throttle") as SnippetTrigger,
      level: num(item["level"], 0.8, 0, 1.5),
      rate: num(item["rate"], 1, 0.5, 2),
      createdAt: num(item["createdAt"], Date.now(), 0, Number.MAX_SAFE_INTEGER),
      everySeconds: num(item["everySeconds"], 25, 5, 300),
    });
    if (out.length >= 12) break;
  }
  return out;
}


export interface SettingsIssue {
  field: string;
  detail: string;
}

/**
 * Normalises any stored value into a complete, in-range settings object and
 * reports what had to be repaired, so a partial or corrupted entry can never
 * trap the app in an inconsistent state.
 */
export function sanitizeSettings(input: unknown): {
  settings: ElcamosoSettings;
  issues: SettingsIssue[];
} {
  const issues: SettingsIssue[] = [];
  if (!isRecord(input)) {
    if (input !== undefined && input !== null) {
      issues.push({ field: "root", detail: "Stored value was not an object; defaults used." });
    }
    return { settings: { ...DEFAULT_SETTINGS }, issues };
  }
  const p = input;

  const check = <T>(field: string, value: T, fallback: T, ok: boolean) => {
    if (!ok) issues.push({ field, detail: `Invalid value repaired to ${String(fallback)}.` });
    return ok ? value : fallback;
  };

  const tuning: Record<string, ProfileTuning> = {};
  if (isRecord(p["tuning"])) {
    for (const [id, value] of Object.entries(p["tuning"])) {
      if (!isRecord(value)) {
        issues.push({ field: `tuning.${id}`, detail: "Dropped: not an object." });
        continue;
      }
      tuning[id] = {
        throttle: num(value["throttle"], 1, 0.2, 2),
        response: num(value["response"], 1, 0.2, 2),
        regen: num(value["regen"], 1, 0, 2),
      };
    }
  } else if (p["tuning"] !== undefined) {
    issues.push({ field: "tuning", detail: "Dropped: not an object." });
  }

  const profileGain: Record<string, number> = {};
  if (isRecord(p["profileGain"])) {
    for (const [id, value] of Object.entries(p["profileGain"])) {
      profileGain[id] = num(value, 1, 0.4, 1.6);
    }
  } else if (p["profileGain"] !== undefined) {
    issues.push({ field: "profileGain", detail: "Dropped: not an object." });
  }

  const customSounds = sanitizeCustomSounds(p["customSounds"]);
  if (p["customSounds"] !== undefined && !Array.isArray(p["customSounds"])) {
    issues.push({ field: "customSounds", detail: "Dropped: not a list." });
  }

  const favourites = Array.isArray(p["favourites"])
    ? p["favourites"].filter((f): f is string => typeof f === "string").slice(0, 60)
    : [];

  const knownIds = new Set([
    ...SOUND_PROFILES.map((s) => s.id),
    ...customSounds.map((s) => s.id),
  ]);
  const rawProfileId = p["profileId"];
  const profileId = check(
    "profileId",
    typeof rawProfileId === "string" ? rawProfileId : DEFAULT_PROFILE_ID,
    DEFAULT_PROFILE_ID,
    typeof rawProfileId === "string" && knownIds.has(rawProfileId),
  );

  const playlists = sanitizePlaylists(p["playlists"], knownIds);
  const snippets = sanitizeSnippets(p["snippets"]);
  const rawEnvironment = typeof p["environmentId"] === "string" ? p["environmentId"] : null;
  if (rawEnvironment && !ENVIRONMENTS.some((e) => e.id === rawEnvironment)) {
    issues.push({ field: "environmentId", detail: "Unknown environment; open road used." });
  }

  const onboarded = bool(p["onboarded"], false);
  const safetyAcknowledged = bool(p["safetyAcknowledged"], false);

  const settings: ElcamosoSettings = {
    profileId,
    volume: num(p["volume"], DEFAULT_SETTINGS.volume, 0, 1),
    demoMotion: bool(p["demoMotion"], false),
    safetyAcknowledged,
    onboarded,
    onboardingStep: num(p["onboardingStep"], 0, 0, 2),
    lastDriveAt: typeof p["lastDriveAt"] === "number" ? p["lastDriveAt"] : null,
    driveCount: num(p["driveCount"], 0, 0, 1e9),
    reducedMotion: bool(p["reducedMotion"], false),
    haptics: bool(p["haptics"], false),
    motionSensitivity: num(p["motionSensitivity"], 1, 0.4, 2),
    motionNoiseFloor: num(p["motionNoiseFloor"], 0, 0, 10),
    calibratedAt: typeof p["calibratedAt"] === "number" ? p["calibratedAt"] : null,
    tuning,
    profileGain,
    customSounds,
    favourites,
    playlists,
    snippets,
    environmentId: getEnvironment(rawEnvironment).id,
    layerMix: normalizeMix(p["layerMix"]),
    devPanel: bool(p["devPanel"], false),
  };


  // A drive that was already acknowledged implies setup is finished. Repairing
  // this here is what keeps inconsistent flags from bouncing you to onboarding.
  if (!settings.onboarded && (settings.safetyAcknowledged || settings.driveCount > 0)) {
    settings.onboarded = true;
    issues.push({
      field: "onboarded",
      detail: "Set to true: this device has already acknowledged safety or driven.",
    });
  }

  return { settings, issues };
}

/* ------------------------------------------------------------ load report */

export type LoadOutcome = "empty" | "ok" | "repaired" | "corrupt" | "unavailable" | "server";

export interface LoadReport {
  outcome: LoadOutcome;
  at: number;
  /** bytes of the stored entry */
  size: number;
  issues: SettingsIssue[];
  message: string;
}

let lastLoad: LoadReport = {
  outcome: "server",
  at: 0,
  size: 0,
  issues: [],
  message: "Not loaded yet.",
};

export function getLastLoadReport(): LoadReport {
  return lastLoad;
}

export function readSettings(): ElcamosoSettings {
  if (typeof window === "undefined") {
    lastLoad = {
      outcome: "server",
      at: Date.now(),
      size: 0,
      issues: [],
      message: "Rendered on the server: defaults used.",
    };
    return DEFAULT_SETTINGS;
  }
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    lastLoad = {
      outcome: "unavailable",
      at: Date.now(),
      size: 0,
      issues: [],
      message: "Storage is blocked on this device: settings stay in memory only.",
    };
    return DEFAULT_SETTINGS;
  }

  if (!raw) {
    lastLoad = {
      outcome: "empty",
      at: Date.now(),
      size: 0,
      issues: [],
      message: "No saved settings yet: defaults used.",
    };
    return DEFAULT_SETTINGS;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    lastLoad = {
      outcome: "corrupt",
      at: Date.now(),
      size: raw.length,
      issues: [{ field: "root", detail: "Stored JSON could not be parsed." }],
      message: "Saved settings were unreadable and have been reset to defaults.",
    };
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* nothing else to do */
    }
    return DEFAULT_SETTINGS;
  }

  const { settings, issues } = sanitizeSettings(parsed);
  lastLoad = {
    outcome: issues.length ? "repaired" : "ok",
    at: Date.now(),
    size: raw.length,
    issues,
    message: issues.length
      ? `Loaded with ${issues.length} repaired value${issues.length === 1 ? "" : "s"}.`
      : "Loaded successfully.",
  };
  if (issues.length) {
    // persist the repair so the same problem is not re-read next time
    try {
      window.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* keep the repaired copy in memory */
    }
  }
  return settings;
}

export function writeSettings(next: Partial<ElcamosoSettings>) {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const merged = sanitizeSettings({ ...readSettings(), ...next }).settings;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* storage unavailable, keep the session in memory only */
  }
  window.dispatchEvent(new CustomEvent("elcamoso:settings"));
  return merged;
}

/** Clears the onboarding flags so the guided setup can be run again. */
export function resetOnboarding() {
  return writeSettings({
    onboarded: false,
    safetyAcknowledged: false,
    onboardingStep: 0,
    driveCount: 0,
  });
}

/** Wipes every stored value: the last-resort recovery. */
export function clearStoredSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing else to do */
  }
  window.dispatchEvent(new CustomEvent("elcamoso:settings"));
  return DEFAULT_SETTINGS;
}

export function readRawStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- transfer */

const BACKUP_KIND = "elcamoso.settings.backup";
const BACKUP_VERSION = 3;

export interface SettingsBackup {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  /** app fields the importer can report on, even across versions */
  app: { name: "ELCAMOSO" };
  settings: ElcamosoSettings;
}

export function buildBackup(): SettingsBackup {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: "ELCAMOSO" },
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

/* ------------------------------------------------------ version migration */

/**
 * Older exports used different field names and had no Studio sounds. Each step
 * lifts a payload one version forward, so any earlier backup arrives in the
 * current shape instead of being rejected.
 */
function migratePayload(payload: Record<string, unknown>, version: number) {
  const notes: string[] = [];
  const p: Record<string, unknown> = { ...payload };

  if (version < 2) {
    // v1: single "profile"/"sensitivity" fields, one shared gain, no Garage.
    if (p["profile"] !== undefined && p["profileId"] === undefined) {
      p["profileId"] = p["profile"];
      notes.push("Renamed the saved sound to the current field.");
    }
    if (p["sensitivity"] !== undefined && p["motionSensitivity"] === undefined) {
      p["motionSensitivity"] = p["sensitivity"];
      notes.push("Carried motion sensitivity over from the older format.");
    }
    if (typeof p["gain"] === "number" && !isRecord(p["profileGain"])) {
      const id = typeof p["profileId"] === "string" ? p["profileId"] : DEFAULT_PROFILE_ID;
      p["profileGain"] = { [id]: p["gain"] };
      notes.push("Turned the old single gain into a per-sound balance.");
    }
    if (p["acknowledged"] !== undefined && p["safetyAcknowledged"] === undefined) {
      p["safetyAcknowledged"] = p["acknowledged"];
    }
    if (!Array.isArray(p["customSounds"])) p["customSounds"] = [];
    if (!Array.isArray(p["favourites"])) p["favourites"] = [];
  }

  if (version < 3) {
    // v2: no onboarding step and no drive counter.
    if (p["onboardingStep"] === undefined) {
      p["onboardingStep"] = p["onboarded"] === true ? 2 : 0;
      notes.push("Rebuilt the setup progress from the saved setup state.");
    }
    if (p["driveCount"] === undefined) p["driveCount"] = 0;
    if (p["devPanel"] === undefined) p["devPanel"] = false;
  }

  if (version < 4) {
    // v3: no environments, layer mixer, playlists or snippets.
    if (p["environmentId"] === undefined) {
      p["environmentId"] = DEFAULT_ENVIRONMENT_ID;
      notes.push("Placed older sounds on the open road environment.");
    }
    if (p["layerMix"] === undefined) p["layerMix"] = normalizeMix(undefined);
    if (!Array.isArray(p["playlists"])) p["playlists"] = [];
    if (!Array.isArray(p["snippets"])) p["snippets"] = [];
  }

  return { payload: p, notes };
}

export type ImportMode = "merge" | "replace";

export interface ImportReport {
  version: number;
  mode: ImportMode;
  /** custom sounds that arrived and were kept */
  soundsAdded: number;
  /** custom sounds already present under the same id */
  soundsSkipped: number;
  favouritesAdded: number;
  tuningsMerged: number;
  playlistsAdded: number;
  snippetsAdded: number;
  /** compatibility steps applied to an older file */
  migrations: string[];
  /** values that had to be repaired to fit the current app */
  repairs: SettingsIssue[];
}


interface ParsedBackup {
  settings: ElcamosoSettings;
  report: Pick<ImportReport, "version" | "migrations" | "repairs">;
}


/** Validates, migrates and normalises a backup file into usable settings. */
export function parseBackup(raw: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!isRecord(data)) throw new Error("This file is not an ELCAMOSO backup.");

  const kind = typeof data["kind"] === "string" ? data["kind"] : "";
  if (kind && kind !== BACKUP_KIND) {
    throw new Error("This backup was made by a different app.");
  }

  const version = num(data["version"], 1, 1, 99);
  const body = isRecord(data["settings"]) ? data["settings"] : data;
  if (!isRecord(body)) throw new Error("This backup has no settings in it.");
  if (version > BACKUP_VERSION) {
    // A newer file is still readable: unknown fields are simply dropped.
    const { settings, issues } = sanitizeSettings(body);
    return {
      settings,
      report: {
        version,
        migrations: ["This backup came from a newer version; unknown values were skipped."],
        repairs: issues,
      },
    };
  }

  const { payload, notes } = migratePayload(body, version);
  const { settings, issues } = sanitizeSettings(payload);
  return { settings, report: { version, migrations: notes, repairs: issues } };
}

/**
 * Merges an imported backup into the current setup: Studio sounds, favourites,
 * tuning and balances are added alongside what is already here, and existing
 * ids are never overwritten.
 */
export function mergeBackup(
  current: ElcamosoSettings,
  incoming: ElcamosoSettings,
): { settings: ElcamosoSettings; soundsAdded: number; soundsSkipped: number; favouritesAdded: number; tuningsMerged: number } {
  const existingIds = new Set(current.customSounds.map((s) => s.id));
  const added: CustomSound[] = [];
  let soundsSkipped = 0;
  for (const sound of incoming.customSounds) {
    if (existingIds.has(sound.id)) {
      soundsSkipped += 1;
      continue;
    }
    existingIds.add(sound.id);
    added.push(sound);
  }

  const favourites = Array.from(new Set([...current.favourites, ...incoming.favourites]));
  const favouritesAdded = favourites.length - current.favourites.length;

  const tuning = { ...current.tuning };
  let tuningsMerged = 0;
  for (const [id, value] of Object.entries(incoming.tuning)) {
    if (!tuning[id]) {
      tuning[id] = value;
      tuningsMerged += 1;
    }
  }

  const profileGain = { ...incoming.profileGain, ...current.profileGain };

  const settings: ElcamosoSettings = {
    ...current,
    volume: incoming.volume,
    reducedMotion: incoming.reducedMotion,
    haptics: incoming.haptics,
    motionSensitivity: incoming.motionSensitivity,
    motionNoiseFloor: incoming.motionNoiseFloor,
    calibratedAt: incoming.calibratedAt,
    customSounds: [...current.customSounds, ...added],
    favourites,
    tuning,
    profileGain,
    driveCount: Math.max(current.driveCount, incoming.driveCount),
  };

  // Keep the imported sound selected only if it can actually be resolved here.
  const known = new Set([
    ...SOUND_PROFILES.map((s) => s.id),
    ...settings.customSounds.map((s) => s.id),
  ]);
  if (known.has(incoming.profileId)) settings.profileId = incoming.profileId;

  return { settings, soundsAdded: added.length, soundsSkipped, favouritesAdded, tuningsMerged };
}

export async function importSettingsFile(
  file: File,
  mode: ImportMode = "merge",
): Promise<ImportReport> {
  const text = await file.text();
  const { settings: incoming, report } = parseBackup(text);

  if (mode === "replace") {
    writeSettings(incoming);
    return {
      ...report,
      mode,
      soundsAdded: incoming.customSounds.length,
      soundsSkipped: 0,
      favouritesAdded: incoming.favourites.length,
      tuningsMerged: Object.keys(incoming.tuning).length,
    };
  }

  const merged = mergeBackup(readSettings(), incoming);
  writeSettings(merged.settings);
  return {
    ...report,
    mode,
    soundsAdded: merged.soundsAdded,
    soundsSkipped: merged.soundsSkipped,
    favouritesAdded: merged.favouritesAdded,
    tuningsMerged: merged.tuningsMerged,
  };
}
