/**
 * Remembers which Drive+ sound a free user picked when the app quietly swapped
 * it for the free fallback (EntitlementEnforcer), so the UI can explain it.
 */
import { useEffect, useState } from "react";

const KEY = "elcamoso.lockedFallback.v1";
const listeners = new Set<(id: string | null) => void>();
let memory: string | null = null;

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}
function write(id: string | null) {
  memory = id;
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(id);
}

export const noteLockedFallback = (profileId: string) => write(profileId);
export const clearLockedFallback = () => write(null);
export const getLockedFallback = () => read();

export function useLockedFallback(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(read());
    listeners.add(setId);
    return () => void listeners.delete(setId);
  }, []);
  return id;
}

/** Short demo clip for a locked sound, when one exists. */
export function demoClipForProfile(profileId: string): string | null {
  if (profileId.startsWith("symphony-") || profileId.startsWith("fusion-"))
    return "/demos/drive-the-music.m4a";
  return null;
}
