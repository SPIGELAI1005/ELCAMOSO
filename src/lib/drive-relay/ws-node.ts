import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import nodeAdapter from "crossws/adapters/node";
import type { Message, Peer } from "crossws";
import {
  onRelayClose,
  onRelayMessage,
  onRelayOpen,
  validateRelayUpgrade,
  type RelayPeerLike,
} from "./hub";
import { RELAY_MAX_MESSAGE_BYTES } from "./config";
import type { RelayUpgradeContext } from "./types";

function peerHandle(peer: Peer): RelayPeerLike {
  const context = peer.context as unknown as RelayUpgradeContext;
  return {
    id: peer.id,
    context,
    send: (data: unknown) => peer.send(data),
    close: (code?: number, reason?: string) => peer.close(code, reason),
  };
}

export const relayWsAdapter = nodeAdapter({
  hooks: {
    async upgrade(request) {
      const url = new URL(request.url);
      try {
        const context = validateRelayUpgrade({
          sessionId: url.searchParams.get("sessionId"),
          role: url.searchParams.get("role"),
          token: url.searchParams.get("token"),
        });
        return {
          namespace: `drive-relay:${context.sessionId}`,
          context: { ...context },
        };
      } catch (error) {
        if (error instanceof Response) return error;
        throw error;
      }
    },
    open(peer) {
      onRelayOpen(peerHandle(peer));
    },
    message(peer, message: Message) {
      let payload: unknown;
      try {
        // Prefer JSON parse; reject oversized string payloads when available
        const asText =
          typeof (message as { text?: () => string }).text === "function"
            ? (message as { text: () => string }).text()
            : null;
        if (typeof asText === "string" && asText.length > RELAY_MAX_MESSAGE_BYTES) {
          peer.send({ type: "error", code: "message-too-large", message: "Payload exceeds limit" });
          return;
        }
        payload = message.json();
      } catch {
        return;
      }
      onRelayMessage(peerHandle(peer), payload);
    },
    close(peer) {
      onRelayClose(peerHandle(peer));
    },
  },
});

export const RELAY_WS_PATH = "/api/drive-relay/ws";

export function attachRelayWsUpgrade(server: {
  on(
    event: "upgrade",
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): void;
}) {
  server.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    if (!url.startsWith(RELAY_WS_PATH)) return;
    void relayWsAdapter.handleUpgrade(req, socket, head);
  });
}
