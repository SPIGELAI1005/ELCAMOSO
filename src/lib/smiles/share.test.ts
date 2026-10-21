import { describe, expect, it } from "vitest";
import { shareIntentLinks, smilesCardUrl, smilesShareText } from "./share";

describe("smiles share", () => {
  const info = { score: 72, distance: "12.4 km", profileName: "Racing V10" };
  it("builds plain text without emojis", () => {
    const text = smilesShareText(info);
    expect(text).toBe("72 smiles on a 12.4 km drive with Racing V10. elcamoso.com");
    expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);
  });
  it("builds intent links and card url", () => {
    const l = shareIntentLinks("hi there");
    expect(l.x).toBe("https://twitter.com/intent/tweet?text=hi%20there");
    expect(l.whatsapp).toContain("wa.me/?text=hi%20there");
    expect(smilesCardUrl(info)).toBe(
      "https://www.elcamoso.com/smiles-card?s=72&d=12.4+km&p=Racing+V10",
    );
  });
});
