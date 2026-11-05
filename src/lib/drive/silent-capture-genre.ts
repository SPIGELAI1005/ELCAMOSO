import { listSymphonyPacks } from "@/lib/symphony/experience-pack";

const KEY = "elcamoso.silentCapture.packId";
export const DEFAULT_SILENT_CAPTURE_PACK = "symphony-latino-fiesta";

export interface SilentCaptureGenre {
  id: string;
  name: string;
}

export function listSilentCaptureGenres(): SilentCaptureGenre[] {
  return listSymphonyPacks().map((p) => ({ id: p.id, name: p.name }));
}

export function getSilentCaptureGenre(): string {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (v && listSilentCaptureGenres().some((g) => g.id === v)) return v;
  } catch {
    /* private mode */
  }
  return DEFAULT_SILENT_CAPTURE_PACK;
}

export function setSilentCaptureGenre(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
