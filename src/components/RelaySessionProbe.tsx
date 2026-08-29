import { useEffect, useRef, useState } from "react";
import type { DriveRelayHandle } from "@/lib/drive-relay/client";
import { relayStatusLabel } from "@/lib/drive-relay/client";
import {
  peerConnectedLabel,
  peerRowLabel,
  peersReadyForProbe,
  probeKindForRole,
  probeReceivedLabel,
  probeSendLabel,
  isRelayProbeKind,
} from "@/lib/drive-relay/probe";
import type { RelayPeerFlags, RelayRole } from "@/lib/drive-relay/types";

interface RelaySessionProbeProps {
  relay: DriveRelayHandle;
  role: RelayRole;
  className?: string;
}

const PEER_ROWS: Array<keyof RelayPeerFlags> = ["display", "phone", "telemetry"];

function PeerStatusRow({ role, connected }: { role: keyof RelayPeerFlags; connected: boolean }) {
  const waiting = !connected && role !== "telemetry";
  return (
    <div className="flex items-center justify-between gap-4 text-[11px] tracking-[0.06em]">
      <span className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        {peerRowLabel(role)}
      </span>
      <span className={waiting ? "text-muted-foreground" : "text-foreground"}>
        {peerConnectedLabel(connected, role)}
      </span>
    </div>
  );
}

/**
 * Pairing proof UI: peer flags, cross-device tap relay, round-trip latency.
 * No raw sensor values.
 */
export function RelaySessionProbe({ relay, role, className = "" }: RelaySessionProbeProps) {
  const [receivedFlash, setReceivedFlash] = useState<string | null>(null);
  const lastProbeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const msg = relay.lastAction;
    if (!msg || msg.type !== "action" || msg.from === role) return;
    if (!isRelayProbeKind(msg.kind)) return;
    if (msg.id === lastProbeIdRef.current) return;
    lastProbeIdRef.current = msg.id;
    setReceivedFlash(probeReceivedLabel(msg.from));
    const timer = window.setTimeout(() => setReceivedFlash(null), 2400);
    return () => window.clearTimeout(timer);
  }, [relay.lastAction, role]);

  const canProbe = relay.status === "connected" && peersReadyForProbe(relay.peers);

  const sendProbe = () => {
    if (!canProbe) return;
    relay.sendAction(probeKindForRole(role), { at: Date.now() });
  };

  return (
    <section
      className={`space-y-4 rounded-lg border border-border/50 bg-surface-2/30 px-4 py-4 ${className}`}
      aria-label="Session connection"
    >
      <div className="space-y-2">
        {PEER_ROWS.map((peerRole) => (
          <PeerStatusRow key={peerRole} role={peerRole} connected={relay.peers[peerRole]} />
        ))}
        <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-2 text-[11px]">
          <span className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            Relay
          </span>
          <span className="text-foreground">{relayStatusLabel(relay.status)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sendProbe}
          disabled={!canProbe}
          className="h-10 rounded-full border border-border px-4 text-[10px] tracking-[0.18em] uppercase disabled:opacity-40"
        >
          {probeSendLabel(role)}
        </button>
        <button
          type="button"
          onClick={() => relay.runLatencyTest()}
          disabled={!canProbe}
          className="h-10 rounded-full border border-border px-4 text-[10px] tracking-[0.18em] uppercase disabled:opacity-40"
        >
          Latency test
        </button>
      </div>

      {receivedFlash ? (
        <p className="text-xs text-foreground" role="status" aria-live="polite">
          {receivedFlash}
        </p>
      ) : null}

      {relay.roundTripMs !== null ? (
        <p className="text-xs text-muted-foreground">Round-trip: {relay.roundTripMs} ms</p>
      ) : null}
    </section>
  );
}
