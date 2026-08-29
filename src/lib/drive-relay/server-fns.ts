import { createServerFn } from "@tanstack/react-start";

import { assertServerEntitlement } from "@/lib/entitlements/server-assert";
import {
  createDriveRelaySession,
  getDriveRelaySession,
  joinDriveRelaySession,
} from "@/lib/drive-relay/store";

export const createDriveRelaySessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    await assertServerEntitlement(data.sessionToken, "phone_sensor");
    return createDriveRelaySession();
  });

export const getDriveRelaySessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) => data)
  .handler(({ data }) => {
    const session = getDriveRelaySession(data.sessionId);
    if (!session) return { ok: false as const };
    return {
      ok: true as const,
      sessionId: session.id,
      expiresAt: session.expiresAt,
      peers: {
        display: session.displayConnected,
        phone: session.phoneConnected,
        telemetry: session.telemetryConnected,
      },
    };
  });

export const joinDriveRelaySessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; pairingCode: string }) => data)
  .handler(({ data }) => {
    const joined = joinDriveRelaySession(data.sessionId, data.pairingCode);
    if (!joined) return { ok: false as const };
    return { ok: true as const, joinSecret: joined.joinSecret, expiresAt: joined.expiresAt };
  });
