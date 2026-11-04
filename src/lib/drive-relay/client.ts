import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { parseRelayMessage } from "@/lib/drive-relay/protocol";
import {
  createMotionSendGate,
  createPeerTracker,
  DRIVE_CHANNEL_PREFIX,
  isSafeKey,
  PEER_HEARTBEAT_MS,
  reconnectDelayMs,
} from "@/lib/drive-relay/realtime-link";
import { getRealtimeClient } from "@/lib/phone-sync/channel";
import type {
  RelayConnectionState,
  RelayMessage,
  RelayPeerFlags,
  RelayRole,
} from "@/lib/drive-relay/types";
import { toRelayMotionPayload, type RelayMotionMessage } from "@/lib/motion/relay-sample";
import type { RelayTelemetryMessage } from "@/lib/motion/relay-telemetry";
import type { MotionSample } from "@/lib/motion/types";

/** Live link to the peer (Supabase Realtime broadcast channel). */
interface LinkHandle {
  open: boolean;
  send: (message: RelayMessage) => void;
  close: () => void;
}

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

  const transportRef = useRef<LinkHandle | null>(null);
  const attemptRef = useRef(0);
  const motionGateRef = useRef(createMotionSendGate());
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
    transportRef.current?.close();
    transportRef.current = null;
    setStatus("disconnected");
  }, [clearTimers]);

  const handleMessage = useCallback(
    (raw: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
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
        transportRef.current?.send({
          type: "latency-pong",
          id: msg.id,
          from: role,
          sentAt: msg.sentAt,
          receivedAt: Date.now(),
        } satisfies RelayMessage);
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
    if (!enabledRef.current || !sessionId || !token || !isSafeKey(token)) return;
    clearTimers();
    transportRef.current?.close();
    transportRef.current = null;
    setStatus((prev) => (prev === "reconnecting" ? prev : "connecting"));

    let closed = false;
    const tracker = createPeerTracker();
    const pushPeers = () => {
      setPeers((prev) => {
        const next = tracker.flags(Date.now());
        return prev.display === next.display &&
          prev.phone === next.phone &&
          prev.telemetry === next.telemetry
          ? prev
          : next;
      });
    };

    const scheduleReconnect = () => {
      if (closed || !enabledRef.current) return;
      closed = true;
      clearTimers();
      handle.close();
      transportRef.current = null;
      setStatus("reconnecting");
      const delay = reconnectDelayMs(attemptRef.current);
      attemptRef.current += 1;
      reconnectRef.current = window.setTimeout(() => connect(), delay);
    };

    let channel: RealtimeChannel | null = null;
    let release: (() => void) | null = null;
    const handle: LinkHandle = {
      open: false,
      send: (message) => {
        if (!channel || !handle.open) return;
        void channel.send({ type: "broadcast", event: "msg", payload: message });
      },
      close: () => {
        handle.open = false;
        release?.();
        release = null;
      },
    };
    transportRef.current = handle;

    void getRealtimeClient().then((client) => {
      if (closed || transportRef.current !== handle) return;
      if (!client) {
        setStatus("error");
        scheduleReconnect();
        return;
      }
      const ch = client.channel(DRIVE_CHANNEL_PREFIX + token, {
        config: { broadcast: { self: false, ack: false } },
      });
      channel = ch;
      release = () => void client.removeChannel(ch);
      ch.on("broadcast", { event: "peer" }, (msg) => {
        const p = (msg["payload"] ?? {}) as { role?: unknown; bye?: unknown; hello?: unknown };
        if (p.role !== "display" && p.role !== "phone" && p.role !== "telemetry") return;
        if (p.role === role) return;
        if (p.bye === true) tracker.forget(p.role);
        else tracker.seen(p.role, Date.now());
        pushPeers();
        // Answer a newcomer right away so both sides see each other within one round trip.
        if (p.hello === true) {
          void ch.send({ type: "broadcast", event: "peer", payload: { role, at: Date.now() } });
        }
      });
      ch.on("broadcast", { event: "msg" }, (msg) => {
        const payload = msg["payload"];
        const from = (payload as { from?: unknown } | null)?.from;
        if (from === "phone" || from === "display" || from === "telemetry") {
          if (from !== role) {
            tracker.seen(from, Date.now());
          }
        }
        handleMessage(JSON.stringify(payload));
      });
      ch.subscribe((s) => {
        if (closed || transportRef.current !== handle) return;
        if (s === "SUBSCRIBED") {
          attemptRef.current = 0;
          handle.open = true;
          setStatus("connected");
          void ch.send({
            type: "broadcast",
            event: "peer",
            payload: { role, at: Date.now(), hello: true },
          });
          heartbeatRef.current = window.setInterval(() => {
            void ch.send({ type: "broadcast", event: "peer", payload: { role, at: Date.now() } });
            pushPeers();
          }, PEER_HEARTBEAT_MS);
          return;
        }
        if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          handle.open = false;
          scheduleReconnect();
        }
      });
      const origClose = handle.close;
      handle.close = () => {
        if (handle.open && channel) {
          void channel.send({ type: "broadcast", event: "peer", payload: { role, bye: true } });
        }
        origClose();
      };
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
      const transport = transportRef.current;
      if (!transport || !transport.open) return;
      const message: RelayMessage = {
        type: "action",
        id: crypto.randomUUID(),
        from: role,
        kind,
        at: Date.now(),
        ...(payload !== undefined ? { payload } : {}),
      };
      transport.send(message);
    },
    [role],
  );

  const sendMotion = useCallback(
    (sample: MotionSample) => {
      const transport = transportRef.current;
      if (!transport || !transport.open || role !== "phone") return;
      // Free-plan budget: ~10 msg/s while moving, ~4 msg/s when parked and still.
      if (!motionGateRef.current(performance.now(), sample)) return;
      seqRef.current += 1;
      transport.send({
        type: "motion",
        from: "phone",
        at: Date.now(),
        seq: seqRef.current,
        sample: toRelayMotionPayload(sample),
      } satisfies RelayMotionMessage);
    },
    [role],
  );

  const runLatencyTest = useCallback(() => {
    const transport = transportRef.current;
    if (!transport || !transport.open) return;
    const id = crypto.randomUUID();
    pendingLatencyRef.current.set(id, Date.now());
    setRoundTripMs(null);
    transport.send({
      type: "latency-ping",
      id,
      from: role,
      sentAt: Date.now(),
    } satisfies RelayMessage);
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
