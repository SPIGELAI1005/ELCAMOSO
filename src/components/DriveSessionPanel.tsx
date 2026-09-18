import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

import { useDriveRelay, relayStatusLabel } from "@/lib/drive-relay/client";
import { formatPairingCode, pairPagePath } from "@/lib/drive-relay/protocol";
import { createDriveRelaySessionFn } from "@/lib/drive-relay/server-fns";
import { setClientRelaySessionId } from "@/lib/dynamic-drive-session/client-relay-id";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { RelayRemoteControlBridge } from "@/components/RelayRemoteControlBridge";
import { RelaySessionProbe } from "@/components/RelaySessionProbe";
import { DrivePipelineMetrics } from "@/components/DrivePipelineMetrics";
import { RELAY_MOTION_STREAM_ENABLED } from "@/lib/drive-relay/config";
import type { RelayMessage } from "@/lib/drive-relay/types";
import type { RelayMotionMessage } from "@/lib/motion/relay-sample";
import type { RelayTelemetryMessage } from "@/lib/motion/relay-telemetry";
import { dispatchTeslaEntitlementUpdate } from "@/lib/tesla-upgrade/events";
import { useSessionSelector } from "@/lib/store/session-store";

interface DriveSessionPanelProps {
  className?: string;
  /** Show relay diagnostics (latency, round-trip). Requires Settings → Drive debug. */
  devMode?: boolean;
  onRelaySessionChange?: (sessionId: string | null) => void;
  /** Compact row on idle Drive screen; expands when connecting. */
  compact?: boolean;
}

type PairUiState =
  | "idle"
  | "creating"
  | "waiting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "expired"
  | "failed";

/**
 * Tesla-side phone link: Free plan QR pairing + sensor relay.
 * Sound always plays on the car; phone is the preferred motion source.
 */
export function DriveSessionPanel({
  className = "",
  devMode = false,
  onRelaySessionChange,
  compact = false,
}: DriveSessionPanelProps) {
  const { settings } = useSettings();
  const pipelineMetrics = useSessionSelector((snap) => snap.pipeline);

  const [creating, setCreating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [joinSecret, setJoinSecret] = useState<string | null>(null);
  const [pairPath, setPairPath] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [claimExpiresAt, setClaimExpiresAt] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  const pairUrl = useMemo(() => {
    if (!pairPath || typeof window === "undefined") return "";
    return new URL(pairPath, window.location.origin).toString();
  }, [pairPath]);

  useEffect(() => {
    if (!pairUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(pairUrl, {
      margin: 2,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [pairUrl]);

  const fleetTelemetryRef = useRef(settings.teslaFleetTelemetry);
  useEffect(() => {
    fleetTelemetryRef.current = settings.teslaFleetTelemetry;
  }, [settings.teslaFleetTelemetry]);

  const onPhoneMotion = useCallback((message: RelayMotionMessage) => {
    if (!RELAY_MOTION_STREAM_ENABLED) return;
    getSession().ingestPhoneRelayMotion(message);
  }, []);

  const onTelemetry = useCallback((message: RelayTelemetryMessage) => {
    if (!fleetTelemetryRef.current) return;
    getSession().ingestVehicleTelemetryRelay(message);
  }, []);

  const onEntitlementUpdate = useCallback(
    (message: Extract<RelayMessage, { type: "entitlement-update" }>) => {
      dispatchTeslaEntitlementUpdate({
        plan: message.plan,
        revision: message.revision,
        at: message.at,
        ...(message.upgradeToken ? { upgradeToken: message.upgradeToken } : {}),
      });
    },
    [],
  );

  const relay = useDriveRelay({
    sessionId: sessionId ?? "",
    role: "display",
    token: joinSecret ?? "",
    enabled: Boolean(sessionId && joinSecret),
    onPhoneMotion,
    onTelemetry,
    onEntitlementUpdate,
  });

  const prevPhonePeer = useRef(relay.peers.phone);
  const [hadPhone, setHadPhone] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const session = getSession();
    if (prevPhonePeer.current && !relay.peers.phone) {
      session.onPhoneRelayPeerLost();
    } else if (!prevPhonePeer.current && relay.peers.phone) {
      session.onPhoneRelayPeerAvailable();
    }
    prevPhonePeer.current = relay.peers.phone;
    if (relay.peers.phone) setHadPhone(true);
  }, [relay.peers.phone]);

  // Re-render when claim QR TTL elapses.
  useEffect(() => {
    if (!claimExpiresAt || relay.peers.phone) return;
    const ms = claimExpiresAt - Date.now();
    if (ms <= 0) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), ms + 50);
    return () => window.clearTimeout(id);
  }, [claimExpiresAt, relay.peers.phone]);

  const claimExpired =
    claimExpiresAt != null && claimExpiresAt <= Date.now() && !relay.peers.phone && !hadPhone;

  const uiState: PairUiState = (() => {
    if (error && !sessionId) return "failed";
    if (creating) return "creating";
    if (!sessionId) return "idle";
    if (relay.peers.phone && (relay.status === "connected" || relay.status === "reconnecting")) {
      return relay.status === "reconnecting" ? "reconnecting" : "connected";
    }
    if (relay.status === "reconnecting") return "reconnecting";
    if (hadPhone && !relay.peers.phone) return "disconnected";
    if (claimExpired) return "expired";
    if (relay.status === "error") return "failed";
    if (relay.status === "disconnected" && sessionId) return "disconnected";
    return "waiting";
  })();

  const createSession = async () => {
    setCreating(true);
    setError(null);
    setExpanded(true);
    try {
      const created = await createDriveRelaySessionFn({
        data: { sessionToken: null },
      });
      setSessionId(created.sessionId);
      setPairingCode(created.pairingCode);
      setJoinSecret(created.joinSecret);
      setPairPath(created.pairPath ?? pairPagePath(created.claimToken));
      setExpiresAt(created.expiresAt);
      setClaimExpiresAt(created.claimExpiresAt);
      setHadPhone(false);
      onRelaySessionChange?.(created.sessionId);
      setClientRelaySessionId(created.sessionId);
    } catch {
      setError("Could not start pairing. Try again while parked.");
    } finally {
      setCreating(false);
    }
  };

  const resetPairing = () => {
    setSessionId(null);
    setPairingCode(null);
    setJoinSecret(null);
    setPairPath(null);
    setExpiresAt(null);
    setClaimExpiresAt(null);
    setQrDataUrl(null);
    setError(null);
    setHadPhone(false);
    onRelaySessionChange?.(null);
    setClientRelaySessionId(null);
    if (compact) setExpanded(false);
  };

  const statusHeadline = (() => {
    switch (uiState) {
      case "creating":
        return "Creating pairing…";
      case "waiting":
        return hadPhone ? "Phone disconnected" : "Waiting for phone…";
      case "connected":
        return "Phone connected";
      case "disconnected":
        return "Phone disconnected";
      case "reconnecting":
        return "Reconnecting…";
      case "expired":
        return "Pairing expired";
      case "failed":
        return "Pairing failed";
      default:
        return "Phone sensor";
    }
  })();

  const phoneLinked = uiState === "connected";
  const showQr = Boolean(sessionId) && !phoneLinked && uiState !== "expired";

  if (compact && !expanded && !sessionId) {
    return (
      <section
        className={`w-full max-w-md rounded-xl border border-border/70 bg-surface-1/40 px-5 py-4 text-left ${className}`}
        aria-label="Phone sensor"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-light text-foreground">Phone sensor</p>
            <p className="mt-1 text-xs text-muted-foreground">Not connected</p>
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={() => void createSession()}
            className="h-11 shrink-0 rounded-full border border-foreground px-5 text-[10px] tracking-[0.22em] uppercase disabled:opacity-40"
          >
            Connect phone
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Optional. Improves motion quality. Pair while parked or let a passenger connect.
        </p>
      </section>
    );
  }

  if (compact && !expanded && phoneLinked) {
    return (
      <section
        className={`w-full max-w-md rounded-xl border border-border/70 bg-surface-1/40 px-5 py-4 text-left ${className}`}
        aria-label="Phone sensor"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-light text-foreground">Phone sensor</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foreground"
                aria-hidden
              />
              Connected
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
          >
            Details
          </button>
        </div>
        <RelayRemoteControlBridge relay={relay} />
      </section>
    );
  }

  return (
    <>
      <RelayRemoteControlBridge relay={relay} />

      <section
        className={`w-full max-w-md rounded-xl border border-border/70 bg-surface-1/40 px-5 py-5 text-left ${className}`}
        aria-label="Connect phone"
      >
        {!sessionId ? (
          <>
            <p className="text-center text-sm tracking-[0.28em] text-foreground uppercase">
              Connect phone
            </p>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
              Scan a QR with your phone so motion sensors reach this drive. Sound stays on the car.
              Do this while parked or have a passenger help. ELCAMOSO does not control the vehicle.
            </p>
            {error ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">{error}</p>
            ) : null}
            <button
              type="button"
              disabled={creating}
              onClick={() => void createSession()}
              className="mt-5 h-12 w-full rounded-full border border-foreground text-[10px] tracking-[0.22em] uppercase disabled:opacity-40"
            >
              {creating ? "Creating pairing…" : "Connect phone"}
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-sm tracking-[0.28em] text-foreground uppercase">
              Connect phone
            </p>
            <p className="mt-2 text-center text-sm font-light text-foreground">{statusHeadline}</p>

            {showQr ? (
              <div className="mt-5 flex flex-col items-center gap-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR code to pair your phone"
                    className="h-[280px] w-[280px] rounded-lg border-2 border-foreground bg-white p-2 sm:h-[320px] sm:w-[320px]"
                  />
                ) : (
                  <div className="h-[280px] w-[280px] animate-pulse rounded-lg border border-border bg-surface-2 sm:h-[320px] sm:w-[320px]" />
                )}
                <p className="text-sm text-foreground">Scan with your phone</p>
                <div className="text-center">
                  <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                    Code
                  </p>
                  <p className="mt-1 font-mono text-3xl tracking-[0.2em] text-foreground">
                    {pairingCode ? formatPairingCode(pairingCode) : "- - -"}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Or open elcamoso.com/pair and enter the code
                  </p>
                </div>
              </div>
            ) : null}

            {uiState === "expired" ? (
              <div className="mt-5 space-y-3 text-center">
                <p className="text-xs text-muted-foreground">
                  The QR expired. Create a new one while parked.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    resetPairing();
                    void createSession();
                  }}
                  className="h-11 w-full rounded-full border border-foreground text-[10px] tracking-[0.22em] uppercase"
                >
                  New pairing
                </button>
              </div>
            ) : null}

            {phoneLinked ? (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Motion is coming from your phone. Drive continues if the phone drops; the car
                sensors take over smoothly.
              </p>
            ) : null}

            {devMode ? (
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Relay: {relayStatusLabel(relay.status)}
                {expiresAt != null
                  ? ` · session ${Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000))} min`
                  : ""}
              </p>
            ) : null}

            {devMode ? (
              <>
                <RelaySessionProbe relay={relay} role="display" className="mt-5" />
                {phoneLinked && RELAY_MOTION_STREAM_ENABLED ? (
                  <DrivePipelineMetrics metrics={pipelineMetrics} className="mt-4" />
                ) : null}
              </>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {compact ? (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
                >
                  Hide
                </button>
              ) : null}
              <button
                type="button"
                onClick={resetPairing}
                className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
              >
                End pairing
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
