import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  attachRelayPeer,
  claimDriveRelayToken,
  createDriveRelaySession,
  detachRelayPeer,
  DRIVE_RELAY_CLAIM_TTL_MS,
  joinDriveRelayByPairingCode,
  joinDriveRelaySession,
  peekClaimToken,
  pushTelemetryToDisplay,
  relayToPeer,
  resetDriveRelayStoreForTests,
  validateRelayToken,
} from "@/lib/drive-relay/store";
import { formatPairingCode, parseRelayMessage } from "@/lib/drive-relay/protocol";

describe("drive-relay store", () => {
  beforeEach(() => {
    resetDriveRelayStoreForTests();
  });

  it("creates a session with pairing code, claim token, and secrets", () => {
    const created = createDriveRelaySession();
    expect(created.sessionId.length).toBeGreaterThan(8);
    expect(created.pairingCode).toMatch(/^\d{6}$/);
    expect(created.joinSecret.length).toBeGreaterThan(12);
    expect(created.claimToken.length).toBeGreaterThan(16);
    expect(created.pairPath).toBe(`/pair/${encodeURIComponent(created.claimToken)}`);
    expect(created.claimExpiresAt).toBeGreaterThan(Date.now());
    expect(created.claimExpiresAt - Date.now()).toBeLessThanOrEqual(DRIVE_RELAY_CLAIM_TTL_MS + 50);
  });

  it("joins with pairing code and validates token", () => {
    const created = createDriveRelaySession();
    const joined = joinDriveRelaySession(created.sessionId, created.pairingCode);
    expect(joined?.joinSecret).not.toBe(created.joinSecret);
    expect(validateRelayToken(created.sessionId, "display", created.joinSecret)?.id).toBe(
      created.sessionId,
    );
    expect(validateRelayToken(created.sessionId, "phone", joined?.joinSecret ?? "")?.id).toBe(
      created.sessionId,
    );
    expect(validateRelayToken(created.sessionId, "phone", created.joinSecret)).toBeNull();
    expect(validateRelayToken(created.sessionId, "display", joined?.joinSecret ?? "")).toBeNull();
  });

  it("joins by pairing code alone (manual /pair entry)", () => {
    const created = createDriveRelaySession();
    const joined = joinDriveRelayByPairingCode(formatPairingCode(created.pairingCode));
    expect(joined?.sessionId).toBe(created.sessionId);
    expect(joined?.joinSecret).not.toBe(created.joinSecret);
  });

  it("claims QR token once and rejects reuse", () => {
    const created = createDriveRelaySession();
    const peek = peekClaimToken(created.claimToken);
    expect(peek?.expired).toBe(false);
    expect(peek?.used).toBe(false);

    const claimed = claimDriveRelayToken(created.claimToken);
    expect(claimed?.sessionId).toBe(created.sessionId);
    expect(claimed?.joinSecret).not.toBe(created.joinSecret);

    expect(claimDriveRelayToken(created.claimToken)).toBeNull();
    expect(peekClaimToken(created.claimToken)?.used).toBe(true);
  });

  it("rejects expired claim tokens", () => {
    vi.useFakeTimers();
    const created = createDriveRelaySession();
    // Keep session alive past claim TTL (idle sessions purge on heartbeat stale).
    attachRelayPeer(created.sessionId, "display", { id: "display-1", send: () => {} });
    vi.advanceTimersByTime(DRIVE_RELAY_CLAIM_TTL_MS + 1_000);
    expect(claimDriveRelayToken(created.claimToken)).toBeNull();
    expect(peekClaimToken(created.claimToken)?.expired).toBe(true);
    vi.useRealTimers();
  });

  it("rejects a second phone while one is connected", () => {
    const created = createDriveRelaySession();
    attachRelayPeer(created.sessionId, "phone", { id: "phone-1", send: () => {} });
    expect(joinDriveRelayByPairingCode(created.pairingCode)).toBeNull();
    expect(claimDriveRelayToken(created.claimToken)).toBeNull();
    expect(
      attachRelayPeer(created.sessionId, "phone", { id: "phone-2", send: () => {} }),
    ).toBeNull();
  });

  it("allows reconnect after phone disconnects via pairing code", () => {
    const created = createDriveRelaySession();
    claimDriveRelayToken(created.claimToken);
    attachRelayPeer(created.sessionId, "phone", { id: "phone-1", send: () => {} });
    detachRelayPeer(created.sessionId, "phone", "phone-1");
    const rejoined = joinDriveRelayByPairingCode(created.pairingCode);
    expect(rejoined?.joinSecret).not.toBe(created.joinSecret);
  });

  it("relays messages between display and phone peers", () => {
    const created = createDriveRelaySession();
    const phoneMessages: unknown[] = [];
    attachRelayPeer(created.sessionId, "display", {
      id: "display-1",
      send: () => {},
    });
    attachRelayPeer(created.sessionId, "phone", {
      id: "phone-1",
      send: (msg) => phoneMessages.push(msg),
    });

    relayToPeer(created.sessionId, "display", {
      type: "action",
      id: "a1",
      from: "display",
      kind: "tesla-ui-tap",
      at: Date.now(),
    });

    expect(phoneMessages.filter((m) => (m as { type?: string }).type === "action")).toHaveLength(1);
    detachRelayPeer(created.sessionId, "phone", "phone-1");
  });

  it("pushes telemetry records to the display peer", () => {
    const created = createDriveRelaySession();
    const displayMessages: unknown[] = [];
    attachRelayPeer(created.sessionId, "display", {
      id: "display-1",
      send: (msg) => displayMessages.push(msg),
    });

    const ok = pushTelemetryToDisplay(
      created.sessionId,
      { receivedAt: Date.now(), fields: { VehicleSpeed: 55 } },
      1,
    );
    expect(ok).toBe(true);
    const telemetryMsg = displayMessages.find((m) => parseRelayMessage(m)?.type === "telemetry");
    expect(telemetryMsg).toBeTruthy();
  });
});

describe("drive-relay protocol", () => {
  it("formats pairing codes for display", () => {
    expect(formatPairingCode("482193")).toBe("482 193");
  });

  it("rate-limits pairing code brute force attempts", () => {
    for (let i = 0; i < 12; i++) {
      expect(joinDriveRelayByPairingCode("000000")).toBeNull();
    }
    // 13th attempt on same key is rejected by rate limit (still null)
    expect(joinDriveRelayByPairingCode("000000")).toBeNull();
  });

  it("rate-limits rotating candidate codes by actor", () => {
    for (let i = 0; i < 12; i += 1) {
      expect(joinDriveRelayByPairingCode(String(100_000 + i), "client-1")).toBeNull();
    }
    const created = createDriveRelaySession();
    expect(joinDriveRelayByPairingCode(created.pairingCode, "client-1")).toBeNull();
    expect(joinDriveRelayByPairingCode(created.pairingCode, "client-2")).not.toBeNull();
  });

  it("parses action and latency messages", () => {
    expect(
      parseRelayMessage({
        type: "action",
        id: "1",
        from: "phone",
        kind: "phone-ui-tap",
        at: 1,
      })?.kind,
    ).toBe("phone-ui-tap");
    expect(
      parseRelayMessage({
        type: "latency-pong",
        id: "p1",
        from: "display",
        sentAt: 10,
        receivedAt: 12,
      })?.receivedAt,
    ).toBe(12);
  });
});
