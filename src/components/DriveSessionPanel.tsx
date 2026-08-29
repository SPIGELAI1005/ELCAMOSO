import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import QRCode from "qrcode";

import { useDriveRelay, relayStatusLabel } from "@/lib/drive-relay/client";

import { connectPagePath } from "@/lib/drive-relay/protocol";

import { createDriveRelaySessionFn } from "@/lib/drive-relay/server-fns";
import { setClientRelaySessionId } from "@/lib/dynamic-drive-session/client-relay-id";
import { useAccount } from "@/lib/account/AccountProvider";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";

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
}

/**

 * Tesla-side phone link: create session, pair, then fade to a quiet "linked" state.

 */

export function DriveSessionPanel({
  className = "",
  devMode = false,
  onRelaySessionChange,
}: DriveSessionPanelProps) {
  const { settings } = useSettings();
  const { session } = useAccount();
  const pipelineMetrics = useSessionSelector((snap) => snap.pipeline);

  const [creating, setCreating] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const [joinSecret, setJoinSecret] = useState<string | null>(null);

  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [showDetails, setShowDetails] = useState(false);

  const connectUrl = useMemo(() => {
    if (!sessionId || !joinSecret || typeof window === "undefined") return "";

    const url = new URL(connectPagePath(sessionId), window.location.origin);

    url.searchParams.set("token", joinSecret);

    return url.toString();
  }, [joinSecret, sessionId]);

  useEffect(() => {
    if (!connectUrl) {
      setQrDataUrl(null);

      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(connectUrl, {
      margin: 1,

      width: 220,

      color: { dark: "#F5F5F7", light: "#00000000" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [connectUrl]);

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
        upgradeToken: message.upgradeToken,
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

  useEffect(() => {
    const session = getSession();

    if (prevPhonePeer.current && !relay.peers.phone) {
      session.onPhoneRelayPeerLost();
    } else if (!prevPhonePeer.current && relay.peers.phone) {
      session.onPhoneRelayPeerAvailable();
    }

    prevPhonePeer.current = relay.peers.phone;
  }, [relay.peers.phone]);

  const createSession = async () => {
    setCreating(true);

    setError(null);

    try {
      const created = await createDriveRelaySessionFn({
        data: { sessionToken: session?.sessionToken ?? null },
      });

      setSessionId(created.sessionId);

      setPairingCode(created.pairingCode);

      setJoinSecret(created.joinSecret);

      setExpiresAt(created.expiresAt);
      onRelaySessionChange?.(created.sessionId);
      setClientRelaySessionId(created.sessionId);

      setShowDetails(true);
    } catch {
      setError("Could not start a link. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const phoneLinked = relay.status === "connected" && relay.peers.phone;

  const minutesLeft =
    expiresAt !== null ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000)) : null;

  return (
    <>
      <RelayRemoteControlBridge relay={relay} />

      <PremiumFeatureGate context="phone_pairing" promptVariant="compact">
      <section
        className={`w-full max-w-md rounded-xl border border-border/70 bg-surface-1/40 px-5 py-5 text-left ${className}`}

        aria-label="Phone link"
      >
        {!sessionId ? (
          <>
            <p className="text-sm font-light text-foreground">Link your phone</p>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Pair once so motion from your phone reaches the car. Sound always plays here.
            </p>

            {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}

            <button
              type="button"

              disabled={creating}

              onClick={() => void createSession()}

              className="mt-5 h-11 rounded-full border border-foreground px-6 text-[10px] tracking-[0.22em] uppercase disabled:opacity-40"
            >
              {creating ? "Starting" : "Start link"}
            </button>
          </>
        ) : phoneLinked && !devMode && !showDetails ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-light text-foreground">Phone linked</p>

              <p className="mt-1 text-xs text-muted-foreground">
                Motion is coming from your phone.
              </p>
            </div>

            <button
              type="button"

              onClick={() => setShowDetails(true)}

              className="shrink-0 text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
            >
              Details
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-light text-foreground">
                  {phoneLinked ? "Phone linked" : "Waiting for your phone"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {phoneLinked
                    ? "Motion is coming from your phone."
                    : "Scan the code or enter the six digits on your phone."}
                </p>
              </div>

              {phoneLinked && !devMode ? (
                <button
                  type="button"

                  onClick={() => setShowDetails(false)}

                  className="shrink-0 text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
                >
                  Hide
                </button>
              ) : null}
            </div>

            {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}

            <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}

                  alt="QR code to link your phone"

                  className="mx-auto h-[220px] w-[220px] rounded-lg border border-border/60 bg-black"
                />
              ) : (
                <div className="mx-auto h-[220px] w-[220px] animate-pulse rounded-lg border border-border/60 bg-surface-2" />
              )}

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                    Code
                  </p>

                  <p className="mt-1 font-mono text-3xl tracking-[0.35em] text-foreground">
                    {pairingCode}
                  </p>
                </div>

                {minutesLeft !== null ? (
                  <p className="text-[11px] text-muted-foreground">
                    Session expires in {minutesLeft} min
                  </p>
                ) : null}

                {devMode ? (
                  <p className="text-[11px] text-muted-foreground">
                    Relay: {relayStatusLabel(relay.status)}
                  </p>
                ) : null}
              </div>
            </div>

            {devMode ? (
              <>
                <RelaySessionProbe relay={relay} role="display" className="mt-5" />
                {phoneLinked && RELAY_MOTION_STREAM_ENABLED ? (
                  <DrivePipelineMetrics metrics={pipelineMetrics} className="mt-4" />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </section>
      </PremiumFeatureGate>
    </>
  );
}
