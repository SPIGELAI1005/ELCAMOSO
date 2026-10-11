/**
 * Drive Audio V3 / raw mechanical combustion renderer (Prompt 04).
 * Opt-in only — Current and Realism V2 remain the default path when off.
 */

function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[name] != null) {
    return String(process.env[name]).trim().toLowerCase();
  }
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
    const value = meta.env?.[name];
    return value != null ? String(value).trim().toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

function readFlag(name: string, defaultOn: boolean): boolean {
  const value = readEnv(name);
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return defaultOn;
}

/** When true, `realismEngine: "v3"` may select the raw mechanical path for pilots. */
export function isDriveAudioV3Enabled(): boolean {
  // Vite only statically replaces literal `import.meta.env.VITE_*` property access.
  // Dynamic `import.meta.env[name]` stays undefined in the browser bundle.
  let viteLiteral = false;
  try {
    const raw = import.meta.env?.["VITE_DRIVE_AUDIO_V3"];
    const v = raw != null ? String(raw).trim().toLowerCase() : "";
    viteLiteral = v === "1" || v === "true" || v === "yes";
  } catch {
    viteLiteral = false;
  }
  return (
    viteLiteral ||
    readFlag("VITE_DRIVE_AUDIO_V3", false) ||
    readFlag("ELCAMOSO_DRIVE_AUDIO_V3", false)
  );
}

/** Alias used in docs / PLAN — same opt-in gate as `isDriveAudioV3Enabled`. */
export const isDriveAudioV3FlagEnabled = isDriveAudioV3Enabled;
