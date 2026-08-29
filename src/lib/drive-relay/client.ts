import { useCallback, useEffect, useRef, useState } from "react";
import { buildRelayWsUrl, parseRelayMessage } from "@/lib/drive-relay/protocol";
import type {
  RelayConnectionState,
  RelayMessage,
  RelayPeerFlags,
  RelayRole,
} from "@/lib/drive-relay/types";
import { toRelayMotionPayload, type RelayMotionMessage } from "@/lib/motion/relay-sample";
import type { RelayTelemetryMessage } from "@/lib/motion/relay-telemetry";
import type { MotionSample } from "@/lib/motion/types";

const HEARTBEAT_MS = 15_000;
const RECONNECT_BASE_MS = 900;

export interface UseDriveRelayOptions {
  sessionId: string;
  role: RelayRole;
  token: string;
  enabled: boolean;
  /** Display-side ingest: called on every motion frame without React state updates. */
  onPhoneMotion?: (message: RelayMotionMessage) => void;
  /** Display-side ingest for fleet telemetry relay payloads. */
  onTelemetry?: (message: RelayTelemetryMessage) => void;
  /** Display-side: Drive+ unlocked via phone checkout. */
  onEntitlementUpdate?: (message: Extract<RelayMessage, { type: "entitlement-update" }>) => void;
}

export interface DriveRelayHandle {
  status: RelayConnectionState;
  peers: RelayPeerFlags;
  lastAction: RelayMessage | null;
  roundTripMs: number | null;
  connect: () => void;
  disconnect: () => void;
  sendAction: (kind: string, payload?: unknown) => void;
  sendMotion: (sample: MotionSample) => void;
  runLatencyTest: () => void;
}

export function useDriveRelay({
  sessionId,
  role,
  token,
  enabled,
  onPhoneMotion,
  onTelemetry,
  onEntitlementUpdate,
}: UseDriveRelayOptions): DriveRelayHandle {
  const [status, setStatus] = useState<RelayConnectionState>("idle");
  const [peers, setPeers] = useState<RelayPeerFlags>({
    display: false,
    phone: false,
    telemetry: false,
  });
  const [lastAction, setLastAction] = useState<RelayMessage | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const reconnectRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const pendingLatencyRef = useRef<Map<string, number>>(new Map());
  const enabledRef = useRef(enabled);
  const onPhoneMotionRef = useRef(onPhoneMotion);
  const onTelemetryRef = useRef(onTelemetry);
  const onEntitlementUpdateRef = useRef(onEntitlementUpdate);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onPhoneMotionRef.current = onPhoneMotion;
  }, [onPhoneMotion]);

  useEffect(() => {
    onTelemetryRef.current = onTelemetry;
  }, [onTelemetry]);

  useEffect(() => {
    onEntitlementUpdateRef.current = onEntitlementUpdate;
  }, [onEntitlementUpdate]);

  const clearTimers = useCallback(() => {
    if (reconnectRef.current !== null) {
      window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (heartbeatRef.current !== null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTimers();
    wsRef.current?.close(1000, "client-disconnect");
    wsRef.current = null;
    setStatus("disconnected");
  }, [clearTimers]);

  const handleMessage = useCallback(
    (event: MessageEvent<string>) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const msg = parseRelayMessage(parsed);
      if (!msg) return;

      if (msg.type === "status") {
        setPeers(msg.peers);
        return;
      }

      if (msg.type === "action") {
        setLastAction(msg);
        return;
      }

      if (msg.type === "motion" && msg.from === "phone") {
        onPhoneMotionRef.current?.(msg);
        return;
      }

      if (msg.type === "telemetry" && msg.from === "telemetry") {
        onTelemetryRef.current?.(msg);
        return;
      }

      if (msg.type === "entitlement-update") {
        onEntitlementUpdateRef.current?.(msg);
        return;
      }

      if (msg.type === "latency-ping" && msg.from !== role) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(
          JSON.stringify({
            type: "latency-pong",
            id: msg.id,
            from: role,
            sentAt: msg.sentAt,
            receivedAt: Date.now(),
          } satisfies RelayMessage),
        );
        return;
      }

      if (msg.type === "latency-pong" && msg.from !== role) {
        const started = pendingLatencyRef.current.get(msg.id);
        if (started !== undefined) {
          pendingLatencyRef.current.delete(msg.id);
          setRoundTripMs(Date.now() - started);
        }
      }
    },
    [role],
  );

  const connect = useCallback(() => {
    if (!enabledRef.current || !sessionId || !token) return;
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close(1000, "reconnect");
      wsRef.current = null;
    }

    setStatus("connecting");
    const url = buildRelayWsUrl(window.location.origin, sessionId, role, token);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      setStatus("connected");
      heartbeatRef.current = window.setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "heartbeat", at: Date.now() }));
      }, HEARTBEAT_MS);
    });

    ws.addEventListener("message", handleMessage);

    ws.addEventListener("close", (ev) => {
      clearTimers();
      wsRef.current = null;
      if (!enabledRef.current) {
        setStatus("disconnected");
        return;
      }
      if (ev.code === 1008 || ev.code === 4401) {
        setStatus("expired");
        return;
      }
      setStatus("reconnecting");
      reconnectRef.current = window.setTimeout(() => connect(), RECONNECT_BASE_MS);
    });

    ws.addEventListener("error", () => {
      setStatus("error");
    });
  }, [clearTimers, handleMessage, role, sessionId, token]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }
    connect();
    return disconnect;
  }, [enabled, connect, disconnect]);

  const sendAction = useCallback(
    (kind: string, payload?: unknown) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const message: RelayMessage = {
        type: "action",
        id: crypto.randomUUID(),
        from: role,
        kind,
        at: Date.now(),
        ...(payload !== undefined ? { payload } : {}),
      };
      ws.send(JSON.stringify(message));
    },
    [role],
  );

  const sendMotion = useCallback(
    (sample: MotionSample) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || role !== "phone") return;
      seqRef.current += 1;
      ws.send(
        JSON.stringify({
          type: "motion",
          from: "phone",
          at: Date.now(),
          seq: seqRef.current,
          sample: toRelayMotionPayload(sample),
        } satisfies RelayMotionMessage),
      );
    },
    [role],
  );

  const runLatencyTest = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const id = crypto.randomUUID();
    pendingLatencyRef.current.set(id, Date.now());
    setRoundTripMs(null);
    ws.send(
      JSON.stringify({
        type: "latency-ping",
        id,
        from: role,
        sentAt: Date.now(),
      } satisfies RelayMessage),
    );
  }, [role]);

  return {
    status,
    peers,
    lastAction,
    roundTripMs,
    connect,
    disconnect,
    sendAction,
    sendMotion,
    runLatencyTest,
  };
}

export function relayStatusLabel(status: RelayConnectionState): string {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting";
    case "expired":
      return "Session expired";
    case "error":
      return "Connection error";
    case "disconnected":
      return "Disconnected";
    default:
      return "Idle";
  }
}
