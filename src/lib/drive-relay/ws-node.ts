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
import type { RelayUpgradeContext } from "./types";

function peerHandle(peer: Peer): RelayPeerLike {
  const context = peer.context as unknown as RelayUpgradeContext;
  return {
    id: peer.id,
    context,
    send: (data: unknown) => peer.send(data),
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
