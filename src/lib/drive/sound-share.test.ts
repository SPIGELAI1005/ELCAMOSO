import { describe, expect, it, vi } from "vitest";
import {
  buildShareMessage,
  buildSoundShare,
  buildSoundShareUrl,
  parseSharedSoundParam,
  SHARE_MESSAGE_TEMPLATES,
  shareIntentUrls,
  shareSound,
  soundShareSocialMeta,
} from "./sound-share";

describe("sound share", () => {
  it("builds the deep link", () => {
    expect(buildSoundShareUrl("traby")).toBe("https://www.elcamoso.com/drive?sound=traby");
  });
  it("accepts only known built-in profile ids", () => {
    expect(parseSharedSoundParam("traby")).toBe("traby");
    expect(parseSharedSoundParam(" Ge-Squared-90 ")).toBe("ge-squared-90");
    expect(parseSharedSoundParam("nope")).toBeUndefined();
    expect(parseSharedSoundParam("<script>")).toBeUndefined();
    expect(parseSharedSoundParam(42)).toBeUndefined();
  });
  it("uses one template per language with only the sound name filled in", () => {
    expect(buildShareMessage("Traby", "en")).toBe(
      "Turn your car into Traby! Tap the link and hear it on the Drive page.",
    );
    expect(buildShareMessage("Traby", "de")).toMatch(/^Verwandle dein Auto in Traby!/);
    expect(buildShareMessage("Traby", "ro")).toMatch(/^Transformă-ți mașina în Traby!/);
    for (const tpl of Object.values(SHARE_MESSAGE_TEMPLATES)) {
      expect(tpl).not.toMatch(/tesla/i);
      expect(tpl).toContain("{sound}");
    }
  });
  it("builds intent urls", () => {
    const s = buildSoundShare("traby", "en");
    const i = shareIntentUrls(s);
    expect(i.whatsapp).toContain(encodeURIComponent(s.url));
    expect(i.x).toContain("url=" + encodeURIComponent(s.url));
    expect(i.email.startsWith("mailto:?subject=")).toBe(true);
  });
  it("gives per-sound social meta with the car image", () => {
    const m = soundShareSocialMeta("traby");
    expect(m.title).toContain("Traby");
    expect(m.image).toBe("https://www.elcamoso.com/hero/sound-profiles/traby.png");
    expect(m.path).toBe("/drive?sound=traby");
  });
  it("uses navigator.share when present, else clipboard", async () => {
    const s = buildSoundShare("traby");
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareSound(s, { share, canShare: () => true } as never)).toBe("shared");
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareSound(s, { clipboard: { writeText } } as never)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(`${s.text} ${s.url}`);
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    expect(await shareSound(s, { share: vi.fn().mockRejectedValue(abort) } as never)).toBe("cancelled");
    expect(await shareSound(s, {} as never)).toBe("failed");
  });
});
