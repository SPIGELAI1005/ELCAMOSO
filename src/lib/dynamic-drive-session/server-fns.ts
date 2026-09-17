import { createServerFn } from "@tanstack/react-start";

async function resolveUserId(sessionToken?: string | null): Promise<string> {
  const { tryResolveRequestSessionToken } = await import(
    "@/lib/account/session-cookies.server"
  );
  const { resolveAuthenticatedUserId } = await import("@/lib/account/resolve-authenticated-user");
  return resolveAuthenticatedUserId(tryResolveRequestSessionToken(sessionToken));
}

export const getDynamicDriveSessionStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getDynamicDriveSessionService } = await import("@/lib/dynamic-drive-session/service");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveSessionService().getSnapshot(userId);
  });

export const claimDynamicDriveSessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken?: string | null;
      driveSessionId: string;
      relaySessionId?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { assertServerEntitlement } = await import("@/lib/entitlements/server-assert");
    const { getDynamicDriveSessionService } = await import("@/lib/dynamic-drive-session/service");
    await assertServerEntitlement(data.sessionToken, "dynamic_drive");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveSessionService().claimSession({
      userId,
      driveSessionId: data.driveSessionId,
      relaySessionId: data.relaySessionId ?? null,
    });
  });

export const heartbeatDynamicDriveSessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sessionToken?: string | null;
      driveSessionId: string;
      relaySessionId?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getDynamicDriveSessionService } = await import("@/lib/dynamic-drive-session/service");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveSessionService().heartbeat({
      userId,
      driveSessionId: data.driveSessionId,
      relaySessionId: data.relaySessionId ?? null,
    });
  });

export const releaseDynamicDriveSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null; driveSessionId: string }) => data)
  .handler(async ({ data }) => {
    const { getDynamicDriveSessionService } = await import("@/lib/dynamic-drive-session/service");
    const userId = await resolveUserId(data.sessionToken);
    return getDynamicDriveSessionService().releaseSession({
      userId,
      driveSessionId: data.driveSessionId,
    });
  });

export { isDynamicDriveSessionConflictError } from "@/lib/dynamic-drive-session/conflict-error";
