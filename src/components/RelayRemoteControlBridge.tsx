import { useCallback, useEffect, useRef } from "react";
import type { DriveRelayHandle } from "@/lib/drive-relay/client";
import {
  buildDriveRemoteState,
  isStopDriveAction,
  patchFromPhoneRemoteAction,
  RELAY_CONTROL_KINDS,
} from "@/lib/drive-relay/remote-control";
import { getTuning, readSettings } from "@/lib/drive/settings";
import { useSettings } from "@/lib/drive/useSettings";
import { getSession } from "@/lib/drive/session";
import { useSessionSelector } from "@/lib/store/session-store";

interface RelayRemoteControlBridgeProps {
  relay: DriveRelayHandle;
}

/** Applies phone remote controls on Tesla and broadcasts drive state back to the phone. */
export function RelayRemoteControlBridge({ relay }: RelayRemoteControlBridgeProps) {
  const { settings, update } = useSettings();
  const sessionSlice = useSessionSelector((snap) => ({
    kind: snap.kind,
    status: snap.status,
  }));
  const lastActionIdRef = useRef<string | null>(null);

  const broadcastState = useCallback(() => {
    if (relay.status !== "connected" || !relay.peers.phone) return;
    relay.sendAction(RELAY_CONTROL_KINDS.STATE_SYNC, buildDriveRemoteState(settings, sessionSlice));
  }, [relay, settings, sessionSlice]);

  useEffect(() => {
    if (relay.peers.phone) broadcastState();
  }, [relay.peers.phone, broadcastState]);

  const soundIntensity = getTuning(settings, settings.profileId).response;

  useEffect(() => {
    broadcastState();
  }, [
    settings.profileId,
    settings.volume,
    settings.dynamicDrive,
    settings.shiftFeel.revMatch,
    soundIntensity,
    sessionSlice.kind,
    sessionSlice.status,
    broadcastState,
  ]);

  useEffect(() => {
    const msg = relay.lastAction;
    if (!msg || msg.type !== "action" || msg.from !== "phone") return;
    if (msg.id === lastActionIdRef.current) return;
    lastActionIdRef.current = msg.id;

    if (isStopDriveAction(msg.kind)) {
      getSession().stop();
      broadcastState();
      return;
    }

    const patch = patchFromPhoneRemoteAction(msg.kind, msg.payload, settings);
    if (!patch) return;

    update(patch);
    if (relay.status === "connected" && relay.peers.phone) {
      relay.sendAction(
        RELAY_CONTROL_KINDS.STATE_SYNC,
        buildDriveRemoteState(readSettings(), sessionSlice),
      );
    }
  }, [relay.lastAction, relay, settings, sessionSlice, update, broadcastState]);

  return null;
}
