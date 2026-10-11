/**
 * City shift-map preset feature flag.
 * City is the proposed new *default* only when enabled; legacy Road Feel maps remain
 * the default when the flag is off. Users may still pick City/Touring/Sport in Settings.
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

/** Opt-in: when true, new installs / missing setting default to City preset. */
export function isCityShiftPresetDefaultEnabled(): boolean {
  return (
    readFlag("VITE_CITY_SHIFT_PRESET", false) ||
    readFlag("ELCAMOSO_CITY_SHIFT_PRESET", false)
  );
}
