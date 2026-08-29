import { pushEntitlementUpdateToDisplay } from "@/lib/drive-relay/store";
import {
  completeTeslaUpgradeToken,
  completeTeslaUpgradeTokensForUser,
  getTeslaUpgradeToken,
} from "@/lib/tesla-upgrade/store";

/** After verified billing, notify in-car displays waiting on this upgrade. */
export function notifyTeslaUpgradeEntitlementGranted(
  userId: string,
  options?: { upgradeToken?: string; revision?: number },
): void {
  const revision = options?.revision ?? Date.now();
  const completed: ReturnType<typeof completeTeslaUpgradeTokensForUser> = [];

  if (options?.upgradeToken) {
    const direct = completeTeslaUpgradeToken(options.upgradeToken);
    if (direct) completed.push(direct);
  }

  for (const record of completeTeslaUpgradeTokensForUser(userId)) {
    if (!completed.some((item) => item.token === record.token)) {
      completed.push(record);
    }
  }

  for (const record of completed) {
    if (!record.relaySessionId) continue;
    pushEntitlementUpdateToDisplay(record.relaySessionId, {
      plan: "DRIVE_PLUS",
      revision,
      upgradeToken: record.token,
    });
  }
}

export function relaySessionIdForUpgradeToken(token: string): string | null {
  return getTeslaUpgradeToken(token)?.relaySessionId ?? null;
}
