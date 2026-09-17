import { createServerFn } from "@tanstack/react-start";

async function resolveUserId(sessionToken?: string | null): Promise<string> {
  const { tryResolveRequestSessionToken } = await import(
    "@/lib/account/session-cookies.server"
  );
  const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
  return resolveAuthenticatedUserId(tryResolveRequestSessionToken(sessionToken));
}

export const getDynamicDriveTrialStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getDynamicDriveTrialService } = await import("@/lib/dynamic-drive-trial/service");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveTrialService().getStatus(userId);
  });

/** Explicit Dynamic Drive preview activation for an authenticated user. */
export const startDynamicDriveTrialFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { isMonetizationEnabled } = await import("@/lib/billing/monetization-flag");
    if (!isMonetizationEnabled()) {
      throw new Error("Dynamic Drive preview is not available");
    }
    const { getDynamicDriveTrialService } = await import("@/lib/dynamic-drive-trial/service");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveTrialService().startPreview(userId);
  });

export const startDynamicDriveTrialSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null; driveSessionId: string }) => data)
  .handler(async ({ data }) => {
    const { assertServerEntitlement } = await import("@/lib/entitlements/server-assert");
    const { getDynamicDriveTrialService } = await import("@/lib/dynamic-drive-trial/service");
    await assertServerEntitlement(data.sessionToken, "dynamic_drive");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveTrialService().startDriveSession(userId, data.driveSessionId);
  });

export const heartbeatDynamicDriveTrialFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken?: string | null;
      driveSessionId: string;
      dynamicDriveEnabled: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { assertServerEntitlement } = await import("@/lib/entitlements/server-assert");
    const { getDynamicDriveTrialService } = await import("@/lib/dynamic-drive-trial/service");
    await assertServerEntitlement(data.sessionToken, "dynamic_drive");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveTrialService().heartbeat(
      userId,
      data.driveSessionId,
      data.dynamicDriveEnabled,
    );
  });

export const endDynamicDriveTrialSessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken?: string | null;
      driveSessionId: string;
      dynamicDriveEnabled: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getDynamicDriveTrialService } = await import("@/lib/dynamic-drive-trial/service");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveTrialService().endDriveSession(
      userId,
      data.driveSessionId,
      data.dynamicDriveEnabled,
    );
  });
