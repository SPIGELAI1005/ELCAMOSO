import { describe, expect, it } from "vitest";

import {
  DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS,
} from "@/lib/dynamic-drive-trial/config";
import {
  creditElapsedSeconds,
  effectiveTrialStatus,
} from "@/lib/dynamic-drive-trial/credit";
import type { DynamicDriveTrialRecord } from "@/lib/dynamic-drive-trial/types";

function trial(overrides: Partial<DynamicDriveTrialRecord> = {}): DynamicDriveTrialRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "trial-1",
    userId: "11111111-1111-1111-1111-111111111111",
    startedAt: now,
    expiresAt: new Date("2026-01-15T00:00:00.000Z"),
    allocatedSeconds: 1800,
    usedSeconds: 0,
    allocatedSessions: 3,
    usedSessions: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("creditElapsedSeconds", () => {
  it("credits only when Dynamic Drive is enabled", () => {
    const last = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date(last.getTime() + 30_000);
    expect(
      creditElapsedSeconds({
        lastCreditedAt: last,
        now,
        dynamicDriveEnabled: false,
        remainingSeconds: 100,
      }),
    ).toBe(0);
    expect(
      creditElapsedSeconds({
        lastCreditedAt: last,
        now,
        dynamicDriveEnabled: true,
        remainingSeconds: 100,
      }),
    ).toBe(30);
  });

  it("caps credit gap to prevent manipulated client clocks", () => {
    const last = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date(last.getTime() + 600_000);
    const credited = creditElapsedSeconds({
      lastCreditedAt: last,
      now,
      dynamicDriveEnabled: true,
      remainingSeconds: 1800,
    });
    expect(credited).toBe(Math.floor(DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS / 1000));
  });

  it("never credits beyond remaining allocation", () => {
    const last = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date(last.getTime() + 30_000);
    expect(
      creditElapsedSeconds({
        lastCreditedAt: last,
        now,
        dynamicDriveEnabled: true,
        remainingSeconds: 10,
      }),
    ).toBe(10);
  });
});

describe("effectiveTrialStatus", () => {
  it("expires by wall clock", () => {
    const t = trial({ expiresAt: new Date("2026-01-02T00:00:00.000Z") });
    expect(effectiveTrialStatus(t, new Date("2026-01-03T00:00:00.000Z"), false)).toBe("expired");
  });

  it("exhausts sessions only when no active drive session remains", () => {
    const t = trial({ usedSessions: 3 });
    expect(effectiveTrialStatus(t, new Date("2026-01-01T01:00:00.000Z"), false)).toBe("exhausted");
    expect(effectiveTrialStatus(t, new Date("2026-01-01T01:00:00.000Z"), true)).toBe("active");
  });
});
