import { describe, expect, it } from "vitest";

import {
  formatTrialRemainingMinutes,
  resolveTrialUpgradeMilestone,
  trialUpgradeMilestoneMessage,
} from "@/lib/dynamic-drive-trial/display";

describe("dynamic drive trial display", () => {
  it("formats remaining time in whole minutes", () => {
    expect(formatTrialRemainingMinutes(1380)).toBe("23 min remaining");
    expect(formatTrialRemainingMinutes(61)).toBe("2 min remaining");
    expect(formatTrialRemainingMinutes(0)).toBe("0 min remaining");
  });

  it("surfaces upgrade milestones once each near 10, 5, and 1 minutes", () => {
    const ack = new Set<number>();
    expect(resolveTrialUpgradeMilestone(23 * 60, ack)).toBeNull();
    expect(resolveTrialUpgradeMilestone(10 * 60, ack)).toBe(10);
    ack.add(10);
    expect(resolveTrialUpgradeMilestone(9 * 60, ack)).toBeNull();
    expect(resolveTrialUpgradeMilestone(5 * 60, ack)).toBe(5);
    ack.add(5);
    expect(resolveTrialUpgradeMilestone(60, ack)).toBe(1);
    expect(trialUpgradeMilestoneMessage(1)).toContain("preview remaining");
  });
});
