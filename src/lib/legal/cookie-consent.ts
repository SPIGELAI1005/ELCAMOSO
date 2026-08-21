const STORAGE_KEY = "elcamoso-cookie-consent-v1";

export type CookieConsentChoice = "essential" | "all";

export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "essential" || raw === "all") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCookieConsent(choice: CookieConsentChoice) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
}

export function clearCookieConsent() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
