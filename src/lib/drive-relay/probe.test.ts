import { describe, expect, it } from "vitest";
import {
  isRelayProbeKind,
  peerConnectedLabel,
  peersReadyForProbe,
  probeKindForRole,
  probeKindFromPeer,
  RELAY_PROBE_KINDS,
} from "@/lib/drive-relay/probe";

describe("drive-relay probe", () => {
  it("maps roles to probe kinds", () => {
    expect(probeKindForRole("display")).toBe(RELAY_PROBE_KINDS.DISPLAY_TAP);
    expect(probeKindForRole("phone")).toBe(RELAY_PROBE_KINDS.PHONE_TAP);
    expect(probeKindFromPeer("display")).toBe(RELAY_PROBE_KINDS.PHONE_TAP);
    expect(probeKindFromPeer("phone")).toBe(RELAY_PROBE_KINDS.DISPLAY_TAP);
  });

  it("recognizes probe action kinds", () => {
    expect(isRelayProbeKind("tesla-ui-tap")).toBe(true);
    expect(isRelayProbeKind("phone-ui-tap")).toBe(true);
    expect(isRelayProbeKind("set-profile")).toBe(false);
  });

  it("requires display and phone for probe", () => {
    expect(peersReadyForProbe({ display: true, phone: true, telemetry: false })).toBe(true);
    expect(peersReadyForProbe({ display: true, phone: false, telemetry: false })).toBe(false);
  });

  it("labels telemetry slot as future when disconnected", () => {
    expect(peerConnectedLabel(false, "telemetry")).toBe("Future");
    expect(peerConnectedLabel(false, "phone")).toBe("Waiting");
  });
});
