import { createServerFn } from "@tanstack/react-start";

import {
  claimDriveRelayToken,
  createDriveRelaySession,
  getDriveRelaySession,
  joinDriveRelayByPairingCode,
  joinDriveRelaySession,
  peekClaimToken,
} from "@/lib/drive-relay/store";
import {
  isRemoteDriveRelayStoreEnabled,
  remoteClaimToken,
  remoteCreateSession,
  remoteJoinByCode,
  remotePeekClaim,
} from "@/lib/drive-relay/remote-store";

export const createDriveRelaySessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { assertServerEntitlement } = await import("@/lib/entitlements/server-assert");
    // Free includes phone_sensor (basic QR pairing). Drive+ is not required.
    await assertServerEntitlement(data.sessionToken, "phone_sensor");
    if (isRemoteDriveRelayStoreEnabled()) {
      const remote = await remoteCreateSession();
      if (!remote) throw new Error("Drive relay host unavailable");
      return remote;
    }
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
      claimExpiresAt: session.claimExpiresAt,
      claimUsed: session.claimUsedAt != null,
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

/** Manual entry on /pair - code only, no session id in the URL. */
export const joinDriveRelayByCodeFn = createServerFn({ method: "POST" })
  .inputValidator((data: { pairingCode: string }) => data)
  .handler(async ({ data }) => {
    if (isRemoteDriveRelayStoreEnabled()) {
      const joined = await remoteJoinByCode(data.pairingCode);
      if (!joined) return { ok: false as const };
      return {
        ok: true as const,
        sessionId: joined.sessionId,
        joinSecret: joined.joinSecret,
        expiresAt: joined.expiresAt,
      };
    }
    const joined = joinDriveRelayByPairingCode(data.pairingCode);
    if (!joined) return { ok: false as const };
    return {
      ok: true as const,
      sessionId: joined.sessionId,
      joinSecret: joined.joinSecret,
      expiresAt: joined.expiresAt,
    };
  });

/** Peek QR claim token without consuming it (UI state). */
export const peekDriveRelayClaimFn = createServerFn({ method: "POST" })
  .inputValidator((data: { claimToken: string }) => data)
  .handler(async ({ data }) => {
    if (isRemoteDriveRelayStoreEnabled()) {
      const peek = await remotePeekClaim(data.claimToken);
      if (!peek) return { ok: false as const };
      return {
        ok: true as const,
        expired: peek.expired,
        used: peek.used,
        phoneConnected: peek.phoneConnected,
      };
    }
    const peek = peekClaimToken(data.claimToken);
    if (!peek) return { ok: false as const };
    return {
      ok: true as const,
      expired: peek.expired,
      used: peek.used,
      phoneConnected: peek.phoneConnected,
    };
  });

/** One-time QR claim → session join secret. */
export const claimDriveRelayTokenFn = createServerFn({ method: "POST" })
  .inputValidator((data: { claimToken: string }) => data)
  .handler(async ({ data }) => {
    if (isRemoteDriveRelayStoreEnabled()) {
      const claimed = await remoteClaimToken(data.claimToken);
      if (!claimed) return { ok: false as const };
      return {
        ok: true as const,
        sessionId: claimed.sessionId,
        joinSecret: claimed.joinSecret,
        expiresAt: claimed.expiresAt,
      };
    }
    const claimed = claimDriveRelayToken(data.claimToken);
    if (!claimed) return { ok: false as const };
    return {
      ok: true as const,
      sessionId: claimed.sessionId,
      joinSecret: claimed.joinSecret,
      expiresAt: claimed.expiresAt,
    };
  });
