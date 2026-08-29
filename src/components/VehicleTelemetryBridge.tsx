import { useEffect, useRef } from "react";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { pullVehicleTelemetryFn } from "@/lib/tesla/server-fns";
import { useSessionSelector } from "@/lib/store/session-store";

const POLL_MS = 800;

/**
 * Ingests vehicle motion into Sensor Fusion during Drive when enabled.
 * Primary path: Fleet Telemetry stream (server cache / relay).
 * Fallback: read-only vehicle_data poll on the server (rate-limited).
 */
export function VehicleTelemetryBridge() {
  const { settings } = useSettings();
  const { active: driveActive } = useSessionSelector((snap) => ({
    active: snap.kind === "drive" && snap.status === "running",
  }));
  const inFlight = useRef(false);

  useEffect(() => {
    const linkId = settings.teslaLinkId;
    if (!settings.teslaFleetTelemetry || !linkId || !driveActive) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || inFlight.current) return;
      inFlight.current = true;
      try {
        const result = await pullVehicleTelemetryFn({
          data: { linkId, vin: settings.teslaVehicleVin ?? null },
        });
        if (!cancelled && result.ok && result.record) {
          getSession().ingestVehicleTelemetry(result.record);
        }
      } catch {
        /* server unavailable — fusion falls back to phone/browser */
      } finally {
        inFlight.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [driveActive, settings.teslaFleetTelemetry, settings.teslaLinkId, settings.teslaVehicleVin]);

  return null;
}
