import { beforeEach, describe, expect, it } from "vitest";

import {
  createMagicLinkToken,
  resetAccountAuthStoreForTests,
  saveAccountSession,
} from "@/lib/account/session-store";
import { resolveAuthenticatedUserId } from "@/lib/account/resolve-authenticated-user";
import {
  memoryDynamicDriveTrialRepository,
  resetDynamicDriveTrialStoreForTests,
} from "@/lib/dynamic-drive-trial/repository-memory";
import {
  DynamicDriveTrialService,
  resetDynamicDriveTrialServiceForTests,
} from "@/lib/dynamic-drive-trial/service";

describe("Dynamic Drive trial auth gate", () => {
  beforeEach(() => {
    resetAccountAuthStoreForTests();
    resetDynamicDriveTrialStoreForTests();
    resetDynamicDriveTrialServiceForTests();
  });

  it("requires authentication to start preview", () => {
    expect(() => resolveAuthenticatedUserId("invalid")).toThrow(/Authentication required/i);
  });

  it("starts preview only for authenticated user id from session", async () => {
    const userId = "22222222-2222-4222-8222-222222222222";
    saveAccountSession({
      token: "session-token",
      userId,
      email: "driver@example.com",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const resolved = resolveAuthenticatedUserId("session-token");
    expect(resolved).toBe(userId);

    const service = new DynamicDriveTrialService(memoryDynamicDriveTrialRepository);
    const snapshot = await service.startPreview(resolved);
    expect(snapshot.status).toBe("active");
    expect(snapshot.userId).toBe(userId);
  });
});
