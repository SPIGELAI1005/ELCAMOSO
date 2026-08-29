import { describe, expect, it } from "vitest";

import {
  PREMIUM_CONTEXTS,
  entitlementForPremiumContext,
  getPremiumContext,
} from "@/lib/premium/contexts";

describe("premium contexts", () => {
  it("maps each product context to an entitlement without exposing ids in copy", () => {
    expect(entitlementForPremiumContext("locked_sound")).toBe("all_sound_profiles");
    expect(entitlementForPremiumContext("dynamic_drive")).toBe("dynamic_drive");
    expect(entitlementForPremiumContext("phone_pairing")).toBe("phone_sensor");
    expect(entitlementForPremiumContext("advanced_controls")).toBe("advanced_controls");
  });

  it("uses benefit language instead of entitlement terminology", () => {
    for (const context of Object.keys(PREMIUM_CONTEXTS) as Array<keyof typeof PREMIUM_CONTEXTS>) {
      const copy = getPremiumContext(context);
      const userFacing = [copy.title, copy.body, copy.ctaLabel, copy.badge, copy.footnote ?? ""]
        .join(" ")
        .toLowerCase();
      expect(userFacing).not.toContain("entitlement");
      expect(userFacing).not.toContain("all_sound_profiles");
      expect(userFacing).not.toContain("phone_sensor");
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
  });

  it("allows dismissal for inline prompts unless explicitly required at call site", () => {
    expect(getPremiumContext("locked_sound").dismissible).toBe(true);
    expect(getPremiumContext("dynamic_drive").dismissible).toBe(true);
    expect(getPremiumContext("phone_pairing").dismissible).toBe(true);
    expect(getPremiumContext("advanced_controls").dismissible).toBe(true);
  });
});
