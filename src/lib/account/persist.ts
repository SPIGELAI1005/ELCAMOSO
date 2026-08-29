import type { ElcamosoSettings } from "@/lib/drive/settings";

export interface PersistedAccountSession {
  sessionToken: string;
  userId: string;
  email: string;
  expiresAt: number;
}

const STORAGE_KEY = "elcamoso.account.session";

export function readPersistedAccountSession(): PersistedAccountSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAccountSession;
    if (
      typeof parsed.sessionToken !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedAccountSession(session: PersistedAccountSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearPersistedAccountSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function accountSessionToSettingsPatch(
  session: PersistedAccountSession,
): Partial<ElcamosoSettings> {
  return {
    accountSessionToken: session.sessionToken,
    accountUserId: session.userId,
    accountEmail: session.email,
  };
}

export function clearAccountSettingsPatch(): Partial<ElcamosoSettings> {
  return {
    accountSessionToken: null,
    accountUserId: null,
    accountEmail: null,
  };
}
