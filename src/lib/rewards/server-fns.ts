import { createServerFn } from "@tanstack/react-start";

import { resolveRewardAudience } from "./audience";
import { isRewardsEnabled } from "./flag";
import {
  claimSoundSpin,
  getAccountRewardExtras,
  getClaimForAccount,
  getSoundSpinStatus,
} from "./service";

export const getRewardsPublicFlagFn = createServerFn({ method: "GET" }).handler(() => ({
  rewardsEnabled: isRewardsEnabled(),
}));

export const getSoundSpinStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    const accountId = session?.userId ?? null;
    const audience = accountId ? resolveRewardAudience(accountId) : null;
    const status = getSoundSpinStatus({ accountId, audience });
    const extras = accountId ? getAccountRewardExtras(accountId) : null;
    return {
      authenticated: Boolean(session),
      email: session?.email ?? null,
      status,
      extras,
    };
  });

export const claimSoundSpinFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null; idempotencyKey: string }) => data)
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const accountId = resolveAuthenticatedUserId(
      tryResolveRequestSessionToken(data.sessionToken),
    );
    const audience = resolveRewardAudience(accountId);
    return claimSoundSpin({
      accountId,
      audience,
      idempotencyKey: data.idempotencyKey,
    });
  });

/** Scoped read — returns null when claim is missing or belongs to another account. */
export const getSoundSpinClaimFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null; claimId: string }) => data)
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const accountId = resolveAuthenticatedUserId(
      tryResolveRequestSessionToken(data.sessionToken),
    );
    return { claim: getClaimForAccount(accountId, data.claimId) };
  });
