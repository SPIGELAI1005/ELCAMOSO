import { describe, expect, it, beforeEach } from "vitest";
import {
  attachRelayPeer,
  createDriveRelaySession,
  detachRelayPeer,
  joinDriveRelaySession,
  pushTelemetryToDisplay,
  relayToPeer,
  resetDriveRelayStoreForTests,
  validateRelayToken,
} from "@/lib/drive-relay/store";
import { parseRelayMessage } from "@/lib/drive-relay/protocol";

describe("drive-relay store", () => {
  beforeEach(() => {
    resetDriveRelayStoreForTests();
  });

  it("creates a session with pairing code and secret", () => {
    const created = createDriveRelaySession();
    expect(created.sessionId.length).toBeGreaterThan(8);
    expect(created.pairingCode).toMatch(/^\d{6}$/);
    expect(created.joinSecret.length).toBeGreaterThan(12);
  });

  it("joins with pairing code and validates token", () => {
    const created = createDriveRelaySession();
    const joined = joinDriveRelaySession(created.sessionId, created.pairingCode);
    expect(joined?.joinSecret).toBe(created.joinSecret);
    expect(validateRelayToken(created.sessionId, created.joinSecret)?.id).toBe(created.sessionId);
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
