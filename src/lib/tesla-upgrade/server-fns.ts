import { createServerFn } from "@tanstack/react-start";

import { getAccountSession } from "@/lib/account/auth-service";
import { tryResolveRequestSessionToken } from "@/lib/account/session-request";
import { isBillingAvailable } from "@/lib/billing/billing-available";
import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import { getDrivePlusYearlyDisplay } from "@/lib/billing/plan-display";
import {
  bindUserToTeslaUpgradeToken,
  createTeslaUpgradeToken,
  resolveTeslaUpgradeToken,
} from "@/lib/tesla-upgrade/store";

export const createTeslaUpgradeTokenFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken?: string | null;
      clientDriveSessionId: string;
      relaySessionId?: string | null;
      origin?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!isBillingAvailable()) {
      throw new Error("Billing is not available");
    }
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    const created = createTeslaUpgradeToken({
      userId: session?.userId ?? null,
      clientDriveSessionId: data.clientDriveSessionId,
      relaySessionId: data.relaySessionId ?? null,
    });
    const origin = data.origin?.trim().replace(/\/$/, "") ?? "";
    const upgradeUrl = origin ? `${origin}${created.upgradePath}` : created.upgradePath;
    const yearly = getDrivePlusYearlyDisplay();
    return {
      ...created,
      upgradeUrl,
      displayPrice: yearly.amount,
      displayCadence: "year",
      equivalentMonthly: yearly.equivalentMonthly ?? null,
    };
  });

export const resolveTeslaUpgradeTokenFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const resolved = resolveTeslaUpgradeToken(data.token);
    const yearly = getDrivePlusYearlyDisplay();
    return {
      valid: resolved.valid,
      expired: resolved.expired,
      status: resolved.status,
      billingAvailable: isBillingAvailable(),
      displayPrice: yearly.amount,
      displayCadence: "year",
      equivalentMonthly: yearly.equivalentMonthly ?? null,
    };
  });

export const beginTeslaUpgradeCheckoutFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      sessionToken?: string | null;
      origin: string;
      returnPath?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) throw new Error("Sign in required");

    bindUserToTeslaUpgradeToken(data.token, session.userId);

    return beginDrivePlusCheckout({
      userId: session.userId,
      email: session.email,
      origin: data.origin,
      request: {
        plan: "drive_plus",
        interval: "yearly",
        returnPath: data.returnPath ?? `/upgrade/${encodeURIComponent(data.token)}`,
        source: "tesla_upgrade",
        upgradeToken: data.token,
      },
    });
  });
