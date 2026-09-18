import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettings } from "@/lib/drive/useSettings";
import { scopeSummaryForUi, TESLA_MINIMUM_SCOPES } from "@/lib/tesla/scopes";
import {
  disconnectTeslaFn,
  getTeslaConnectionStatusFn,
  refreshTeslaVehiclesFn,
  selectTeslaVehicleFn,
  startTeslaOAuthFn,
} from "@/lib/tesla/server-fns";
import type { TeslaConnectionStatus } from "@/lib/tesla/types";

function createLinkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface TeslaVehicleConnectProps {
  flash?: string | null;
  flashMessage?: string | null;
}

export function TeslaVehicleConnect({ flash, flashMessage }: TeslaVehicleConnectProps) {
  const { settings, update } = useSettings();
  const [status, setStatus] = useState<TeslaConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopeLines = useMemo(() => scopeSummaryForUi(), []);

  const linkId = settings.teslaLinkId;

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getTeslaConnectionStatusFn({ data: { linkId: linkId ?? null } });
      setStatus(next);
    } catch {
      setError("Could not reach the server.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [linkId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (flash === "connected" && linkId) {
      update({ teslaLinkedAt: Date.now() });
    }
  }, [flash, linkId, update]);

  useEffect(() => {
    if (status?.selectedVin && status.selectedVin !== settings.teslaVehicleVin) {
      update({ teslaVehicleVin: status.selectedVin });
    }
  }, [status?.selectedVin, settings.teslaVehicleVin, update]);

  const ensureLinkId = () => {
    if (linkId) return linkId;
    const id = createLinkId();
    update({ teslaLinkId: id });
    return id;
  };

  const connect = async () => {
    if (!consent) {
      setError("Please confirm consent before connecting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = ensureLinkId();
      const result = await startTeslaOAuthFn({ data: { linkId: id, consentAccepted: true } });
      if (!result.ok || !result.authorizeUrl) {
        setError(result.message ?? "Could not start authorization.");
        return;
      }
      window.location.assign(result.authorizeUrl);
    } catch {
      setError("Authorization could not be started.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!linkId) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectTeslaFn({ data: { linkId } });
      update({
        teslaVehicleVin: null,
        teslaLinkedAt: null,
        teslaLinkId: createLinkId(),
        teslaFleetTelemetry: false,
      });
      await refreshStatus();
    } catch {
      setError("Disconnect failed.");
    } finally {
      setBusy(false);
    }
  };

  const pickVehicle = async (vin: string) => {
    if (!linkId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await selectTeslaVehicleFn({ data: { linkId, vin } });
      if (!result.ok) {
        setError(result.message ?? "Could not select vehicle.");
        return;
      }
      update({ teslaVehicleVin: vin });
      await refreshStatus();
    } catch {
      setError("Could not select vehicle.");
    } finally {
      setBusy(false);
    }
  };

  const reloadVehicles = async () => {
    if (!linkId) return;
    setBusy(true);
    try {
      const next = await refreshTeslaVehiclesFn({ data: { linkId } });
      setStatus(next);
      if (next.selectedVin) update({ teslaVehicleVin: next.selectedVin });
    } catch {
      setError("Could not refresh vehicle list.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !status) {
    return (
      <BlockShell title="Connect Vehicle">
        <p className="mt-2 text-sm text-muted-foreground">Checking server…</p>
      </BlockShell>
    );
  }

  if (!status?.available) {
    return (
      <BlockShell title="Connect Vehicle">
        <p className="mt-2 text-sm text-muted-foreground">
          Optional link to your vehicle for future motion streaming. Not configured on this server.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          See <code className="text-foreground">docs/dynamic-drive/tesla-oauth-env.md</code> for
          server setup. Dynamic Drive works without this using phone or browser sensors.
        </p>
      </BlockShell>
    );
  }

  return (
    <BlockShell title="Connect Vehicle">
      <p className="mt-2 text-sm text-muted-foreground">
        Optional. Authorize read-only vehicle data for motion-linked sound. Set up while parked.
        Tokens stay on the server - never in this browser.
      </p>

      {flash ? (
        <p className="mt-4 text-xs text-foreground">
          {flash === "connected"
            ? "Vehicle authorization completed."
            : flash === "denied"
              ? "Authorization was declined."
              : "Authorization did not complete."}
          {flashMessage ? ` ${flashMessage}` : ""}
        </p>
      ) : null}

      {error ? <p className="mt-4 text-xs text-muted-foreground">{error}</p> : null}

      {status.linked ? (
        <div className="mt-6 space-y-5">
          <div className="text-[11px] tracking-[0.08em] text-muted-foreground">
            <p>Environment: {status.environment}</p>
            <p className="mt-1">
              Scopes:{" "}
              {status.scopes.length ? status.scopes.join(", ") : TESLA_MINIMUM_SCOPES.join(", ")}
            </p>
          </div>

          {status.vehicles.length > 1 ? (
            <label className="block">
              <span className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                Vehicle
              </span>
              <select
                value={status.selectedVin ?? settings.teslaVehicleVin ?? ""}
                disabled={busy}
                onChange={(e) => void pickVehicle(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none disabled:opacity-40"
              >
                <option value="" disabled>
                  Select a vehicle
                </option>
                {status.vehicles.map((v) => (
                  <option key={v.vin} value={v.vin} className="bg-background text-foreground">
                    {v.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : status.vehicles.length === 1 ? (
            <p className="text-sm text-foreground">{status.vehicles[0]!.displayName}</p>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void reloadVehicles()}
              className="h-10 rounded-full border border-border px-4 text-[10px] tracking-[0.18em] uppercase disabled:opacity-40"
            >
              Load vehicles
            </button>
          )}

          {status.virtualKeyUrl ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Fleet Telemetry later requires a virtual key on the vehicle. Pair when parked:{" "}
              <a
                href={status.virtualKeyUrl}
                className="text-foreground underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Open Tesla app
              </a>
            </p>
          ) : null}

          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={settings.teslaFleetTelemetry}
              onChange={(e) => update({ teslaFleetTelemetry: e.target.checked })}
              className="mt-1 accent-foreground"
            />
            <span>
              Use vehicle motion for Drive when a motion stream is available. Phone sensors still
              help with instant response.
            </span>
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.2em] uppercase disabled:opacity-40"
          >
            Disconnect
          </button>

          {status.consentRevokeUrl ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              You can also revoke access in your{" "}
              <a
                href={status.consentRevokeUrl}
                className="text-foreground underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Tesla account
              </a>
              .
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="rounded-lg border border-border/60 px-4 py-4">
            <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              What you authorize
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {scopeLines.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              ELCAMOSO will not unlock, start, or change your vehicle. Revoke access anytime in your
              Tesla account or here.
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 accent-foreground"
            />
            <span>
              I am parked or not driving. I agree to connect my Tesla account for read-only vehicle
              data as described above.
            </span>
          </label>

          <button
            type="button"
            disabled={busy || !consent}
            onClick={() => void connect()}
            className="h-12 w-full rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-40"
          >
            Connect Vehicle
          </button>
        </div>
      )}
    </BlockShell>
  );
}

function BlockShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-1/30 px-5 py-5">
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  );
}
