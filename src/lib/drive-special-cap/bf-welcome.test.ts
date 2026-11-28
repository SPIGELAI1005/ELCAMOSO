import { beforeEach, describe, expect, it } from "vitest";

import { BLACK_FRIDAY_WINDOW, DRIVE_SPECIAL_END_MS } from "@/lib/billing/drive-special";
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
const CM = Date.parse("2026-11-29T12:00:00+01:00");
const AFTER = DRIVE_SPECIAL_END_MS;

describe("Black Friday welcome modal", () => {
  beforeEach(() => {
    resetBlackFridayWelcomeForTests();
    resetBfWelcomeServerForTests();
  });

  it("shows once per account during the window and not after dismiss or after the window", () => {
    expect(shouldShowBlackFridayWelcome("acc-1", IN)).toBe(true);
    expect(shouldShowBlackFridayWelcome(null, IN)).toBe(false);
    markBlackFridayWelcomeSeen("acc-1", IN);
    expect(hasSeenBlackFridayWelcome("acc-1", IN)).toBe(true);
    expect(shouldShowBlackFridayWelcome("acc-1", IN)).toBe(false);
    expect(shouldShowBlackFridayWelcome("acc-2", IN)).toBe(true);
    expect(shouldShowBlackFridayWelcome("acc-2", AFTER)).toBe(false);
  });

  it("persists seen state server-side so another browser does not show it again", async () => {
    expect(await hasSeenBlackFridayWelcomeServer("acc-server", IN)).toBe(false);
    await markBlackFridayWelcomeSeenServer("acc-server", "a@example.com", IN);
    expect(await hasSeenBlackFridayWelcomeServer("acc-server", IN)).toBe(true);
  });

  it("shows the Cyber Monday welcome once more to accounts that saw Black Friday's", () => {
    markBlackFridayWelcomeSeen("acc-bf", IN);
    expect(shouldShowBlackFridayWelcome("acc-bf", IN)).toBe(false);
    expect(shouldShowBlackFridayWelcome("acc-bf", CM)).toBe(true);
    markBlackFridayWelcomeSeen("acc-bf", CM);
    expect(shouldShowBlackFridayWelcome("acc-bf", CM)).toBe(false);
    // Another account that never saw either gets it once during Cyber Monday.
    expect(shouldShowBlackFridayWelcome("acc-new", CM)).toBe(true);
    expect(shouldShowBlackFridayWelcome("acc-new", AFTER)).toBe(false);
    // The Black Friday key is unchanged (accounts that dismissed it before this change).
    expect(shouldShowBlackFridayWelcome("acc-bf", BLACK_FRIDAY_WINDOW.endMs - 1)).toBe(false);
  });

  it("server seen-state is per special: a Black Friday sighting does not hide Cyber Monday's", async () => {
    await markBlackFridayWelcomeSeenServer("acc-s2", null, IN);
    expect(await hasSeenBlackFridayWelcomeServer("acc-s2", IN)).toBe(true);
    expect(await hasSeenBlackFridayWelcomeServer("acc-s2", CM)).toBe(false);
    await markBlackFridayWelcomeSeenServer("acc-s2", null, CM);
    expect(await hasSeenBlackFridayWelcomeServer("acc-s2", CM)).toBe(true);
    // Seen exactly at the Cyber Monday start counts for it.
    await markBlackFridayWelcomeSeenServer("acc-s3", null, BLACK_FRIDAY_WINDOW.endMs);
    expect(await hasSeenBlackFridayWelcomeServer("acc-s3", CM)).toBe(true);
    expect(await hasSeenBlackFridayWelcomeServer("acc-s3", BLACK_FRIDAY_WINDOW.endMs - 1)).toBe(
      true,
    );
  });
});
