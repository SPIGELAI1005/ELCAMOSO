import type { ElcamosoSettings } from "@/lib/drive/settings";

/** Client-visible account profile. Session token lives only in an HttpOnly cookie. */
export interface PersistedAccountSession {
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
    const parsed = JSON.parse(raw) as PersistedAccountSession & { sessionToken?: unknown };
    if (
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
    // Drop any legacy sessionToken that may still be in storage.
    return {
      userId: parsed.userId,
      email: parsed.email,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function writePersistedAccountSession(session: PersistedAccountSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      userId: session.userId,
      email: session.email,
      expiresAt: session.expiresAt,
    }),
  );
}

export function clearPersistedAccountSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function accountSessionToSettingsPatch(
  session: PersistedAccountSession,
): Partial<ElcamosoSettings> {
  return {
    accountSessionToken: null,
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
