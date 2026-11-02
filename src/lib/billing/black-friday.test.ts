import { describe, expect, it } from "vitest";

import {
  BLACK_FRIDAY_END_MS,
  MUSIC_TRIAL_MONTHS,
  addMonthsUtc,
  isMusicTrialOfferActive,
  musicTrialEndUnix,
} from "@/lib/billing/black-friday";

describe("Black Friday music trial", () => {
  it("is 4 months and ends 27.11.2026 23:59:59 Berlin", () => {
    expect(MUSIC_TRIAL_MONTHS).toBe(4);
    expect(BLACK_FRIDAY_END_MS).toBe(Date.parse("2026-11-27T22:59:59Z"));
    expect(isMusicTrialOfferActive(BLACK_FRIDAY_END_MS)).toBe(true);
    expect(isMusicTrialOfferActive(BLACK_FRIDAY_END_MS + 1)).toBe(false);
  });

  it("adds calendar months and clamps month ends", () => {
    expect(addMonthsUtc(Date.parse("2026-10-31T10:00:00Z"), 4)).toBe(
      Date.parse("2027-02-28T10:00:00Z"),
    );
    expect(musicTrialEndUnix(Date.parse("2026-11-27T12:00:00Z"))).toBe(
      Date.parse("2027-03-27T12:00:00Z") / 1000,
    );
  });
});
