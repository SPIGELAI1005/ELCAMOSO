import { beforeEach, describe, expect, it } from "vitest";

import { DRIVE_SPECIAL_END_MS } from "@/lib/billing/drive-special";
import {
  hasSeenBlackFridayWelcome,
  markBlackFridayWelcomeSeen,
  resetBlackFridayWelcomeForTests,
  shouldShowBlackFridayWelcome,
} from "@/lib/drive-special-cap/bf-welcome";
import {
  hasSeenBlackFridayWelcomeServer,
  markBlackFridayWelcomeSeenServer,
  resetBfWelcomeServerForTests,
} from "@/lib/drive-special-cap/bf-welcome.server";

const IN = Date.parse("2026-11-15T12:00:00+01:00");
const AFTER = DRIVE_SPECIAL_END_MS;

describe("Black Friday welcome modal", () => {
  beforeEach(() => {
    resetBlackFridayWelcomeForTests();
    resetBfWelcomeServerForTests();
  });

  it("shows once per account during the window and not after dismiss or after the window", () => {
    expect(shouldShowBlackFridayWelcome("acc-1", IN)).toBe(true);
    expect(shouldShowBlackFridayWelcome(null, IN)).toBe(false);
    markBlackFridayWelcomeSeen("acc-1");
    expect(hasSeenBlackFridayWelcome("acc-1")).toBe(true);
    expect(shouldShowBlackFridayWelcome("acc-1", IN)).toBe(false);
    expect(shouldShowBlackFridayWelcome("acc-2", IN)).toBe(true);
    expect(shouldShowBlackFridayWelcome("acc-2", AFTER)).toBe(false);
  });

  it("persists seen state server-side so another browser does not show it again", async () => {
    expect(await hasSeenBlackFridayWelcomeServer("acc-server")).toBe(false);
    await markBlackFridayWelcomeSeenServer("acc-server", "a@example.com");
    expect(await hasSeenBlackFridayWelcomeServer("acc-server")).toBe(true);
  });
});
