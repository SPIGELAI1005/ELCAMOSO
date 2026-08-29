import {
  calibrationStatusLabel,
  gpsStatusLabel,
  motionStatusLabel,
  signalHealthLabel,
  type PhoneSensorStatusSnapshot,
} from "@/lib/motion/phone-sensor-status";

import { relayStatusLabel } from "@/lib/drive-relay/client";

import type { RelayConnectionState } from "@/lib/drive-relay/types";

interface PhoneSensorStatusProps {
  relayStatus: RelayConnectionState;
  displayConnected: boolean;
  sensor: PhoneSensorStatusSnapshot;
  className?: string;
  /** session: paired phone page — always show the five status rows */
  variant?: "session" | "alert-only";
}

function StatusRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">{label}</span>
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

function connectedLabel(relayStatus: RelayConnectionState, displayConnected: boolean): string {
  if (relayStatus === "connected") {
    return displayConnected ? "Connected" : "Connecting";
  }
  return relayStatusLabel(relayStatus);
}

/** Phone-side sensor status — connected, GPS, motion, calibration, signal health. */
export function PhoneSensorStatus({
  relayStatus,
  displayConnected,
  sensor,
  className = "",
  variant = "session",
}: PhoneSensorStatusProps) {
  const connected = connectedLabel(relayStatus, displayConnected);

  if (variant === "alert-only") {
    return (
      <section
        className={`rounded-xl border border-border/70 bg-surface-1/40 px-5 py-4 ${className}`}
        aria-label="Sensor alert"
      >
        <p className="text-sm text-foreground">
          Allow location and motion access so the car can follow the road.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`space-y-3 rounded-xl border border-border/70 bg-surface-1/40 px-5 py-5 ${className}`}
      aria-label="Phone sensor status"
    >
      <StatusRow label="Connected" value={connected} muted={connected !== "Connected"} />
      <StatusRow label="GPS" value={gpsStatusLabel(sensor.gps)} muted={sensor.gps !== "live"} />
      <StatusRow
        label="Motion"
        value={motionStatusLabel(sensor.motion)}
        muted={sensor.motion !== "live"}
      />
      <StatusRow
        label="Calibration"
        value={calibrationStatusLabel(sensor.calibration)}
        muted={sensor.calibration !== "ready"}
      />
      <StatusRow
        label="Signal health"
        value={signalHealthLabel(sensor.signalHealth)}
        muted={sensor.signalHealth === "weak" || sensor.signalHealth === "offline"}
      />
    </section>
  );
}
