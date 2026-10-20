/** In-app feedback: shared types + validation (client and server). */
export const FEEDBACK_CATEGORIES = ["issue", "suggestion", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  issue: "Issue",
  suggestion: "Suggestion",
  other: "Other",
};
export const FEEDBACK_MIN_CHARS = 3;
export const FEEDBACK_MAX_CHARS = 1500;
export const FEEDBACK_MAX_CONTACT = 120;

export interface FeedbackContext {
  soundProfileId?: string | undefined;
  soundProfileName?: string | undefined;
  device?: string | undefined;
  screen?: string | undefined;
  path?: string | undefined;
  appVersion?: string | undefined;
}

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  contact?: string | undefined;
  clientId: string;
  context?: FeedbackContext | undefined;
  /** Honeypot: must stay empty. */
  website?: string | undefined;
  /** ms since the sheet opened (bots submit instantly). */
  elapsedMs?: number | undefined;
}

export interface FeedbackRecord {
  id: string;
  at: string;
  category: FeedbackCategory;
  message: string;
  contact?: string | undefined;
  clientId: string;
  context: FeedbackContext;
  userAgent?: string | undefined;
  status: "new" | "read" | "test";
}

const clip = (v: unknown, n: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
        .trim()
        .slice(0, n)
    : undefined;

export type FeedbackValidation =
  | { ok: true; value: Omit<FeedbackInput, "website" | "elapsedMs">; spam: boolean }
  | { ok: false; error: string };

export function validateFeedback(raw: unknown): FeedbackValidation {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request." };
  const r = raw as Record<string, unknown>;
  const category = r["category"];
  if (!FEEDBACK_CATEGORIES.includes(category as FeedbackCategory))
    return { ok: false, error: "Pick a category." };
  const message = clip(r["message"], FEEDBACK_MAX_CHARS + 1) ?? "";
  if (message.length < FEEDBACK_MIN_CHARS) return { ok: false, error: "Message is too short." };
  if (message.length > FEEDBACK_MAX_CHARS)
    return { ok: false, error: `Message is too long (max ${FEEDBACK_MAX_CHARS}).` };
  const clientId = clip(r["clientId"], 64) ?? "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(clientId)) return { ok: false, error: "Invalid client." };
  const ctxRaw = (r["context"] && typeof r["context"] === "object" ? r["context"] : {}) as Record<
    string,
    unknown
  >;
  const context: FeedbackContext = {};
  for (const k of [
    "soundProfileId",
    "soundProfileName",
    "device",
    "screen",
    "path",
    "appVersion",
  ] as const) {
    const v = clip(ctxRaw[k], 80);
    if (v) context[k] = v;
  }
  const contact = clip(r["contact"], FEEDBACK_MAX_CONTACT) || undefined;
  const links = (message.match(/https?:\/\//g) ?? []).length;
  const spam =
    Boolean(clip(r["website"], 200)) ||
    (typeof r["elapsedMs"] === "number" && r["elapsedMs"] < 1500) ||
    links > 3;
  return {
    ok: true,
    value: { category: category as FeedbackCategory, message, contact, clientId, context },
    spam,
  };
}

export function detectDevice(ua: string, width: number): string {
  if (/Tesla|QtCarBrowser/i.test(ua)) return "tesla";
  if (/iPhone|Android.*Mobile/i.test(ua) || width < 640) return "phone";
  if (/iPad|Android/i.test(ua) || width < 1024) return "tablet";
  return "desktop";
}
