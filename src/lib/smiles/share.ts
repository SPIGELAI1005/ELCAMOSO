/** Smiles share helpers: plain text (no emojis), intent links, phone card link. */
export interface SmilesShareInfo {
  score: number;
  distance: string;
  profileName: string;
  /** Referral code: share links carry ?ref= so new sign-ups reward the sharer. */
  refCode?: string | null;
}

export function smilesShareText(i: SmilesShareInfo): string {
  return `${i.score} smiles on a ${i.distance} drive with ${i.profileName}. elcamoso.com`;
}

export function smilesCardUrl(i: SmilesShareInfo): string {
  const u = new URL("https://www.elcamoso.com/smiles-card");
  u.searchParams.set("s", String(Math.max(0, Math.min(100, Math.round(i.score)))));
  u.searchParams.set("d", i.distance.slice(0, 16));
  u.searchParams.set("p", i.profileName.slice(0, 40));
  if (i.refCode) u.searchParams.set("ref", i.refCode);
  return u.toString();
}

export function shareIntentLinks(text: string, url?: string) {
  const t = encodeURIComponent(text);
  return {
    x: `https://twitter.com/intent/tweet?text=${t}`,
    whatsapp: `https://wa.me/?text=${t}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url ?? "https://www.elcamoso.com",
    )}&quote=${t}`,
  };
}
