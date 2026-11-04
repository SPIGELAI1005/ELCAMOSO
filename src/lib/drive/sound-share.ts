/**
 * Share a Drive sound with friends: deep link, one friendly message (EN/DE/RO),
 * intent URLs and per-sound social meta for /drive?sound=<profile-id>.
 */
import type { Locale } from "@/lib/i18n";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import { profileHeroImageSrc } from "@/lib/sound/profile-hero-image";

export const SHARE_SOUND_PARAM = "sound";
export const SHARE_SITE_ORIGIN = "https://www.elcamoso.com";

/** One message for every sound; only {sound} is filled in. No brand names. */
export const SHARE_MESSAGE_TEMPLATES: Record<Locale, string> = {
  en: "Turn your car into {sound}! Tap the link and hear it on the Drive page.",
  de: "Verwandle dein Auto in {sound}! Tippe auf den Link und hör es dir auf der Drive-Seite an.",
  ro: "Transformă-ți mașina în {sound}! Apasă pe link și ascultă-l pe pagina Drive.",
};

export const SHARE_UI_STRINGS: Record<Locale, Record<"share" | "copied" | "copy" | "email" | "close" | "failed", string>> = {
  en: { share: "Share sound", copied: "Link copied", copy: "Copy link", email: "Email", close: "Close", failed: "Could not copy. Long-press the link to copy it." },
  de: { share: "Sound teilen", copied: "Link kopiert", copy: "Link kopieren", email: "E-Mail", close: "Schließen", failed: "Kopieren fehlgeschlagen. Link lange drücken zum Kopieren." },
  ro: { share: "Distribuie sunetul", copied: "Link copiat", copy: "Copiază linkul", email: "E-mail", close: "Închide", failed: "Nu s-a putut copia. Ține apăsat pe link pentru a-l copia." },
};

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Returns a known, shareable profile id, or undefined. */
export function parseSharedSoundParam(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const id = raw.trim().toLowerCase();
  if (!ID_RE.test(id)) return undefined;
  return SOUND_PROFILES.some((p) => p.id === id) ? id : undefined;
}

export function buildSoundShareUrl(profileId: string, origin = SHARE_SITE_ORIGIN): string {
  return `${origin.replace(/\/$/, "")}/drive?${SHARE_SOUND_PARAM}=${encodeURIComponent(profileId)}`;
}

export function soundDisplayName(profileId: string): string {
  return SOUND_PROFILES.find((p) => p.id === profileId)?.name ?? "ELCAMOSO";
}

export function buildShareMessage(soundName: string, locale: Locale = "en"): string {
  const tpl = SHARE_MESSAGE_TEMPLATES[locale] ?? SHARE_MESSAGE_TEMPLATES.en;
  return tpl.replace("{sound}", soundName);
}

export interface SoundShare {
  url: string;
  title: string;
  text: string;
}

export function buildSoundShare(profileId: string, locale: Locale = "en", origin?: string): SoundShare {
  const name = soundDisplayName(profileId);
  return {
    url: buildSoundShareUrl(profileId, origin),
    title: `${name} · ELCAMOSO`,
    text: buildShareMessage(name, locale),
  };
}

export function shareIntentUrls(share: SoundShare): { whatsapp: string; x: string; email: string } {
  const body = `${share.text} ${share.url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(body)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(share.text)}&url=${encodeURIComponent(share.url)}`,
    email: `mailto:?subject=${encodeURIComponent(share.title)}&body=${encodeURIComponent(body)}`,
  };
}

/** Social preview data for /drive?sound=<id> (server-rendered head). */
export function soundShareSocialMeta(profileId: string): {
  title: string;
  description: string;
  image?: string;
  imageAlt: string;
  path: string;
} {
  const name = soundDisplayName(profileId);
  const hero = profileHeroImageSrc(profileId);
  return {
    title: `${name} · ELCAMOSO Drive`,
    description: buildShareMessage(name, "en"),
    ...(hero ? { image: `${SHARE_SITE_ORIGIN}${hero}` } : {}),
    imageAlt: `${name} sound on ELCAMOSO Drive`,
    path: `/drive?${SHARE_SOUND_PARAM}=${encodeURIComponent(profileId)}`,
  };
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** navigator.share on phones; clipboard elsewhere (Tesla browser, desktop). */
export async function shareSound(
  share: SoundShare,
  nav: Pick<Navigator, "share" | "canShare" | "clipboard"> | undefined = typeof navigator !== "undefined" ? navigator : undefined,
  opts: { preferNative?: boolean } = {},
): Promise<ShareOutcome> {
  const preferNative = opts.preferNative ?? true;
  if (preferNative && nav && typeof nav.share === "function") {
    const data = { title: share.title, text: share.text, url: share.url };
    if (!nav.canShare || nav.canShare(data)) {
      try {
        await nav.share(data);
        return "shared";
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return "cancelled";
      }
    }
  }
  try {
    if (!nav?.clipboard?.writeText) return "failed";
    await nav.clipboard.writeText(`${share.text} ${share.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
