import type { RelayMessage } from "./types";

export type DriveRelayTransportState =
  "idle" | "connecting" | "open" | "closing" | "closed" | "error";

export interface DriveRelayTransportHandlers {
  onOpen?: () => void;
  onMessage?: (data: string) => void;
  onClose?: (code: number, reason: string) => void;
  onError?: () => void;
}

/**
 * Transport abstraction for phone ↔ Tesla drive relay.
 * Components must not hard-code environment-specific WebSocket URLs.
 */
export interface DriveRelayTransport {
  readonly state: DriveRelayTransportState;
  connect(url: string, handlers: DriveRelayTransportHandlers): void;
  send(data: string | RelayMessage): void;
  close(code?: number, reason?: string): void;
}

/** Browser WebSocket implementation (Tesla + phone). */
export function createBrowserWebSocketTransport(): DriveRelayTransport {
  let ws: WebSocket | null = null;
  let state: DriveRelayTransportState = "idle";

  return {
    get state() {
      return state;
    },
    connect(url, handlers) {
      this.close(1000, "reconnect");
      state = "connecting";
      const socket = new WebSocket(url);
      ws = socket;
      socket.addEventListener("open", () => {
        if (ws !== socket) return;
        state = "open";
        handlers.onOpen?.();
      });
      socket.addEventListener("message", (ev) => {
        if (ws !== socket) return;
        if (typeof ev.data === "string") handlers.onMessage?.(ev.data);
      });
      socket.addEventListener("close", (ev) => {
        if (ws !== socket) return;
        state = "closed";
        ws = null;
        handlers.onClose?.(ev.code, ev.reason);
      });
      socket.addEventListener("error", () => {
        if (ws !== socket) return;
        state = "error";
        handlers.onError?.();
      });
    },
    send(data) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
    },
    close(code = 1000, reason = "client-disconnect") {
      if (!ws) {
        state = "closed";
        return;
      }
      state = "closing";
      try {
        ws.close(code, reason);
      } catch {
        /* ignore */
      }
      ws = null;
      state = "closed";
    },
  };
}
