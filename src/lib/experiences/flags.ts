/**
 * Motion experience feature flags.
 * Override with env: SYMPHONY_ENABLED=0 to disable Drive Symphony audio.
 */

function readEnv(name: string): string | undefined {
  return process.env[name]?.trim().toLowerCase();
}

function readFlag(name: string, defaultOn: boolean): boolean {
  const value = readEnv(name);
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return defaultOn;
}

/** Drive Symphony V1 engine - on by default; set SYMPHONY_ENABLED=0 to disable. */
export function isSymphonyEnabled(): boolean {
  return readFlag("SYMPHONY_ENABLED", true);
}

/** Engine + Symphony Fusion mixer. Default on for V1. */
export function isFusionEnabled(): boolean {
  return readFlag("FUSION_ENABLED", true);
}

/** Worlds reactive engine (Space / Cyber / Storm). Default on. */
export function isWorldsEngineEnabled(): boolean {
  return readFlag("WORLDS_ENGINE_ENABLED", true);
}

/** Drive Song composer - on by default. */
export function isDriveSongEnabled(): boolean {
  return readFlag("DRIVE_SONG_ENABLED", true);
}

/** Short social reel highlight. Default on with Drive Song. */
export function isDriveReelEnabled(): boolean {
  return readFlag("DRIVE_REEL_ENABLED", true);
}

export interface ExperienceFlags {
  symphony: boolean;
  fusion: boolean;
  worlds: boolean;
  driveSong: boolean;
  driveReel: boolean;
}

export function getExperienceFlags(): ExperienceFlags {
  return {
    symphony: isSymphonyEnabled(),
    fusion: isFusionEnabled(),
    worlds: isWorldsEngineEnabled(),
    driveSong: isDriveSongEnabled(),
    driveReel: isDriveReelEnabled(),
  };
}
