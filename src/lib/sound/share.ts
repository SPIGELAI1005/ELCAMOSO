import {
  DEFAULT_TWEAKS,
  type CustomSound,
  type StudioTweaks,
} from "@/lib/drive/settings";
import { DEFAULT_LAYER_MIX, normalizeMix, type LayerMix } from "@/lib/sound/environments";
import { SOUND_PROFILES } from "@/lib/sound/profiles";

export interface SharePayload {
  v: 1;
  sound: {
    name: string;
    baseId: string;
    tweaks: StudioTweaks;
    note?: string;
    environmentId?: string;
    mix?: LayerMix;
  };
}

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(text: string) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((text.length * 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeSharePayload(sound: CustomSound): string {
  const payload: SharePayload = {
    v: 1,
    sound: {
      name: sound.name,
      baseId: sound.baseId,
      tweaks: { ...DEFAULT_TWEAKS, ...sound.tweaks },
      ...(sound.note ? { note: sound.note } : {}),
      ...(sound.environmentId ? { environmentId: sound.environmentId } : {}),
      ...(sound.mix ? { mix: normalizeMix(sound.mix) } : {}),
    },
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeSharePayload(raw: string): CustomSound | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(raw));
    const data = JSON.parse(json) as SharePayload;
    if (data.v !== 1 || !data.sound?.baseId) return null;
    if (!SOUND_PROFILES.some((p) => p.id === data.sound.baseId)) return null;
    return {
      id: `shared-${Date.now().toString(36)}`,
      name: (data.sound.name || "Shared sound").slice(0, 40),
      baseId: data.sound.baseId,
      createdAt: Date.now(),
      tweaks: { ...DEFAULT_TWEAKS, ...data.sound.tweaks },
      ...(data.sound.note ? { note: data.sound.note.slice(0, 160) } : {}),
      ...(data.sound.environmentId ? { environmentId: data.sound.environmentId } : {}),
      mix: normalizeMix(data.sound.mix ?? DEFAULT_LAYER_MIX),
    };
  } catch {
    return null;
  }
}

export function shareUrlFor(sound: CustomSound, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/share?p=${encodeURIComponent(encodeSharePayload(sound))}`;
}

export async function copyShareLink(sound: CustomSound): Promise<string> {
  const url = shareUrlFor(sound);
  if (typeof navigator === "undefined") return url;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: `${sound.name} - ELCAMOSO`,
        text: "Audition this Studio sound personality.",
        url,
      });
      return url;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return url;
    }
  }
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
  return url;
}
