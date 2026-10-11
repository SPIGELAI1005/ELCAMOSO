import { createServerFn } from "@tanstack/react-start";

import { isRewardDiscountsEnabled } from "./flag";
import {
  applyRenewalRewardDiscount,
  getRewardDiscountTerms,
  previewRewardDiscount,
  retryApplyRenewalRewardDiscount,
} from "./service";

export const getRewardDiscountTermsFn = createServerFn({ method: "GET" }).handler(() => ({
  enabled: isRewardDiscountsEnabled(),
  terms: getRewardDiscountTerms(),
}));

export const previewRewardDiscountFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null; reservationId: string }) => data)
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const accountId = resolveAuthenticatedUserId(
      tryResolveRequestSessionToken(data.sessionToken),
    );
    return previewRewardDiscount({ accountId, reservationId: data.reservationId });
  });

export const applyRenewalRewardDiscountFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken?: string | null;
      reservationId: string;
      /** Ignored for ownership — verified via session + billing repository. */
      customerId?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const accountId = resolveAuthenticatedUserId(
      tryResolveRequestSessionToken(data.sessionToken),
    );
    return applyRenewalRewardDiscount({
      accountId,
      reservationId: data.reservationId,
      ...(data.customerId !== undefined ? { postedCustomerId: data.customerId } : {}),
    });
  });

export const retryApplyRenewalRewardDiscountFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null; reservationId: string }) => data)
  .handler(async ({ data }) => {
    const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const accountId = resolveAuthenticatedUserId(
      tryResolveRequestSessionToken(data.sessionToken),
    );
    return retryApplyRenewalRewardDiscount({
      accountId,
      reservationId: data.reservationId,
    });
  });
