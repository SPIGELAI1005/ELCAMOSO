import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachRelayPeer,
  createDriveRelaySession,
  pushEntitlementUpdateToDisplay,
  resetDriveRelayStoreForTests,
} from "@/lib/drive-relay/store";
import { notifyTeslaUpgradeEntitlementGranted } from "@/lib/tesla-upgrade/notify";
import {
  createTeslaUpgradeToken,
  resetTeslaUpgradeStoreForTests,
  tokenStatusForTests,
} from "@/lib/tesla-upgrade/store";

describe("tesla upgrade tokens", () => {
  beforeEach(() => {
    resetTeslaUpgradeStoreForTests();
    resetDriveRelayStoreForTests();
  });

  it("creates non-guessable tokens linked to user and drive session", () => {
    const created = createTeslaUpgradeToken({
      userId: "user_1",
      clientDriveSessionId: "drive-tab-1",
      relaySessionId: "relay_1",
    });
    expect(created.token.length).toBeGreaterThan(20);
    expect(created.upgradePath).toContain("/upgrade/");
    expect(tokenStatusForTests(created.token)).toBe("pending");
  });

  it("broadcasts entitlement updates to relay display peers after checkout", () => {
    const send = vi.fn();
    const relaySession = createDriveRelaySession();
    attachRelayPeer(relaySession.sessionId, "display", { id: "display-peer", send });

    const upgrade = createTeslaUpgradeToken({
      userId: "user_1",
      clientDriveSessionId: "drive-tab-1",
      relaySessionId: relaySession.sessionId,
    });

    notifyTeslaUpgradeEntitlementGranted("user_1", { upgradeToken: upgrade.token });

    expect(tokenStatusForTests(upgrade.token)).toBe("completed");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "entitlement-update", plan: "DRIVE_PLUS" }),
    );
  });

  it("pushEntitlementUpdateToDisplay returns false without a connected display", () => {
    expect(pushEntitlementUpdateToDisplay("missing", { plan: "DRIVE_PLUS", revision: 1 })).toBe(
      false,
    );
  });
});
