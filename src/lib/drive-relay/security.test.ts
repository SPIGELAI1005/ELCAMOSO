import { beforeEach, describe, expect, it } from "vitest";
import { onRelayMessage, onRelayOpen, validateRelayUpgrade, type RelayPeerLike } from "./hub";
import { RELAY_MAX_MESSAGE_BYTES } from "./config";
import { buildRelayWsUrl, parseRelayMessage } from "./protocol";
import { resolveDriveRelayWsOrigin } from "./config";
import {
  claimDriveRelayToken,
  createDriveRelaySession,
  resetDriveRelayStoreForTests,
} from "./store";

describe("drive-relay security", () => {
  beforeEach(() => resetDriveRelayStoreForTests());

  it("rejects oversized motion-like payloads", () => {
    const sent: unknown[] = [];
    const peer: RelayPeerLike = {
      id: "p1",
      context: { sessionId: "s", role: "phone", credential: "j" },
      send: (d) => sent.push(d),
    };
    const huge = "x".repeat(RELAY_MAX_MESSAGE_BYTES + 10);
    onRelayMessage(peer, huge);
    expect(sent[0]).toMatchObject({ code: "message-too-large" });
  });

  it("rejects unknown message shapes", () => {
    const sent: unknown[] = [];
    const peer: RelayPeerLike = {
      id: "p1",
      context: { sessionId: "s", role: "phone", credential: "j" },
      send: (d) => sent.push(d),
    };
    onRelayMessage(peer, { type: "admin-wipe", secret: "x" });
    expect(sent[0]).toMatchObject({ code: "bad-message" });
  });

  it("does not put join secret in QR pair path builder", async () => {
    const { pairPagePath } = await import("./protocol");
    const path = pairPagePath("claim-token-abc");
    expect(path).toBe("/pair/claim-token-abc");
    expect(path).not.toMatch(/join/i);
    expect(path).not.toMatch(/secret/i);
  });

  it("buildRelayWsUrl always targets path and never embeds secrets in path", () => {
    const url = buildRelayWsUrl("https://www.elcamoso.com", "sid", "display", "tok");
    expect(url).toContain("/api/drive-relay/ws");
    expect(url).toContain("sessionId=sid");
    expect(url).toContain("token=tok");
    expect(url.startsWith("wss://")).toBe(true);
    expect(parseRelayMessage({ type: "heartbeat", at: 1 })).toEqual({
      type: "heartbeat",
      at: 1,
    });
    expect(resolveDriveRelayWsOrigin("https://fallback.example")).toBeTruthy();
  });

  it("binds each relay credential to one role", () => {
    const created = createDriveRelaySession();
    const phone = claimDriveRelayToken(created.claimToken);
    expect(phone).not.toBeNull();

    expect(
      validateRelayUpgrade({
        sessionId: created.sessionId,
        role: "display",
        token: created.joinSecret,
      }).role,
    ).toBe("display");
    expect(() =>
      validateRelayUpgrade({
        sessionId: created.sessionId,
        role: "phone",
        token: created.joinSecret,
      }),
    ).toThrow();
    expect(() =>
      validateRelayUpgrade({
        sessionId: created.sessionId,
        role: "display",
        token: phone?.joinSecret ?? "",
      }),
    ).toThrow();
  });

  it("closes a rejected second peer and never relays its messages", () => {
    const created = createDriveRelaySession();
    const phone = claimDriveRelayToken(created.claimToken);
    const displayMessages: unknown[] = [];
    const displayContext = validateRelayUpgrade({
      sessionId: created.sessionId,
      role: "display",
      token: created.joinSecret,
    });
    const phoneContext = validateRelayUpgrade({
      sessionId: created.sessionId,
      role: "phone",
      token: phone?.joinSecret ?? "",
    });
    onRelayOpen({ id: "display-1", context: displayContext, send: (m) => displayMessages.push(m) });
    onRelayOpen({ id: "phone-1", context: phoneContext, send: () => {} });

    const rejectedMessages: unknown[] = [];
    const closeCalls: Array<[number | undefined, string | undefined]> = [];
    const rejected: RelayPeerLike = {
      id: "phone-2",
      context: phoneContext,
      send: (message) => rejectedMessages.push(message),
      close: (code, reason) => closeCalls.push([code, reason]),
    };
    expect(onRelayOpen(rejected)).toBe(false);
    onRelayMessage(rejected, {
      type: "action",
      id: "forged",
      from: "phone",
      kind: "should-not-relay",
      at: Date.now(),
    });

    expect(closeCalls[0]?.[0]).toBe(4409);
    expect(rejectedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "role-already-connected" }),
        expect.objectContaining({ code: "peer-not-attached" }),
      ]),
    );
    expect(displayMessages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "should-not-relay" })]),
    );
  });
});
