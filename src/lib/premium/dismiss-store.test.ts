import { beforeEach, describe, expect, it } from "vitest";

import {
  dismissPremiumPrompt,
  isPremiumPromptDismissed,
  resetPremiumPromptDismissalsForTests,
} from "@/lib/premium/dismiss-store";

describe("premium dismiss store", () => {
  beforeEach(() => {
    resetPremiumPromptDismissalsForTests();
  });

  it("persists dismissals per context in localStorage", () => {
    expect(isPremiumPromptDismissed("phone_pairing")).toBe(false);
    dismissPremiumPrompt("phone_pairing");
    expect(isPremiumPromptDismissed("phone_pairing")).toBe(true);
    expect(isPremiumPromptDismissed("dynamic_drive")).toBe(false);
  });
});
