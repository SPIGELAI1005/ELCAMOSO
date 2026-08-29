import type { RelayPeerFlags, RelayRole } from "./types";

/** UI tap relay kinds for pairing proof (no motion payload). */
export const RELAY_PROBE_KINDS = {
  DISPLAY_TAP: "tesla-ui-tap",
  PHONE_TAP: "phone-ui-tap",
} as const;

export type RelayProbeKind = (typeof RELAY_PROBE_KINDS)[keyof typeof RELAY_PROBE_KINDS];

export function isRelayProbeKind(kind: string): kind is RelayProbeKind {
  return kind === RELAY_PROBE_KINDS.DISPLAY_TAP || kind === RELAY_PROBE_KINDS.PHONE_TAP;
}

export function probeKindForRole(role: RelayRole): RelayProbeKind {
  return role === "display" ? RELAY_PROBE_KINDS.DISPLAY_TAP : RELAY_PROBE_KINDS.PHONE_TAP;
}

export function probeKindFromPeer(role: RelayRole): RelayProbeKind {
  return role === "display" ? RELAY_PROBE_KINDS.PHONE_TAP : RELAY_PROBE_KINDS.DISPLAY_TAP;
}

export function peerRowLabel(role: RelayRole): string {
  switch (role) {
    case "display":
      return "Display";
    case "phone":
      return "Phone";
    case "telemetry":
      return "Vehicle";
  }
}

export function peerConnectedLabel(connected: boolean, role: RelayRole): string {
  if (role === "telemetry" && !connected) return "Future";
  return connected ? "Connected" : "Waiting";
}

export function probeSendLabel(role: RelayRole): string {
  return role === "display" ? "Signal phone" : "Signal display";
}

export function probeReceivedLabel(from: RelayRole): string {
  return from === "display" ? "Display signaled" : "Phone signaled";
}

export function peersReadyForProbe(peers: RelayPeerFlags): boolean {
  return peers.display && peers.phone;
}
