import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DriveRelayHandle } from "@/lib/drive-relay/client";
import {
  buildDriveRemoteState,
  parseDriveRemoteState,
  RELAY_CONTROL_KINDS,
  remoteProfileOptions,
  type DriveRemoteState,
} from "@/lib/drive-relay/remote-control";
import { dynamicDriveStatusLabel } from "@/lib/drive/drive-connection";
import { useSettings } from "@/lib/drive/useSettings";
import { useSessionStore } from "@/lib/store/session-store";

interface PhoneRemoteControllerProps {
  relay: DriveRelayHandle;
  className?: string;
}

function driveStatusLabel(status: DriveRemoteState["driveStatus"]): string {
  switch (status) {
    case "running":
      return "Driving";
    case "starting":
      return "Starting";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

/**
 * Optional phone-side remote for paired Drive sessions.
 * Tesla remains the audio endpoint; controls sync over the relay WebSocket.
 */
export function PhoneRemoteController({ relay, className = "" }: PhoneRemoteControllerProps) {
  const { settings } = useSettings();
  const snap = useSessionStore();
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<DriveRemoteState>(() =>
    buildDriveRemoteState(settings, snap),
  );
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  const profiles = useMemo(() => remoteProfileOptions(settings), [settings]);

  const syncFromTesla = useCallback((next: DriveRemoteState) => {
    setRemote((prev) => (next.at >= prev.at ? next : prev));
  }, []);

  useEffect(() => {
    const msg = relay.lastAction;
    if (!msg || msg.type !== "action" || msg.from !== "display") return;
    if (msg.kind !== RELAY_CONTROL_KINDS.STATE_SYNC) return;
    const parsed = parseDriveRemoteState(msg.payload);
    if (parsed) syncFromTesla(parsed);
  }, [relay.lastAction, syncFromTesla]);

  const connected = relay.status === "connected" && relay.peers.display;
  const disabled = !connected;

  const send = useCallback(
    (kind: string, payload?: unknown) => {
      if (disabled) return;
      relay.sendAction(kind, payload);
    },
    [disabled, relay],
  );

  const setProfile = (profileId: string) => {
    const option = profiles.find((p) => p.id === profileId);
    setRemote((prev) => ({
      ...prev,
      profileId,
      profileName: option?.name ?? prev.profileName,
      at: Date.now(),
    }));
    send(RELAY_CONTROL_KINDS.SET_PROFILE, { profileId });
  };

  const setSoundIntensity = (response: number) => {
    setRemote((prev) => ({ ...prev, soundIntensity: response, at: Date.now() }));
    send(RELAY_CONTROL_KINDS.SET_SOUND_INTENSITY, {
      response,
      profileId: remoteRef.current.profileId,
    });
  };

  const setTransmission = (dynamicDrive: boolean) => {
    setRemote((prev) => ({ ...prev, dynamicDrive, at: Date.now() }));
    send(RELAY_CONTROL_KINDS.SET_TRANSMISSION, { dynamicDrive });
  };

  const setTransient = (revMatch: number) => {
    setRemote((prev) => ({ ...prev, transientIntensity: revMatch, at: Date.now() }));
    send(RELAY_CONTROL_KINDS.SET_TRANSIENT, { revMatch });
  };

  const setVolume = (volume: number) => {
    setRemote((prev) => ({ ...prev, volume, at: Date.now() }));
    send(RELAY_CONTROL_KINDS.SET_VOLUME, { volume });
  };

  const stopDrive = () => {
    send(RELAY_CONTROL_KINDS.STOP_DRIVE);
    setRemote((prev) => ({ ...prev, driveStatus: "idle", at: Date.now() }));
  };

  return (
    <section
      className={`rounded-xl border border-border/70 bg-surface-1/40 px-5 py-4 ${className}`}
      aria-label="Phone remote control"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            Before you drive
          </p>
          <p className="mt-1 text-sm font-light text-foreground">Optional controls</p>
        </div>
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open ? (
        <div className="mt-5 space-y-5 border-t border-border/50 pt-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sound plays in the car. Set your Sound Profile while parked — you do not need these
            controls while moving. Motion keeps flowing when this panel is closed.
          </p>

          <div className="flex items-center justify-between text-[11px] tracking-[0.08em] text-muted-foreground">
            <span>Tesla: {connected ? "Linked" : "Waiting"}</span>
            <span>Drive: {driveStatusLabel(remote.driveStatus)}</span>
          </div>

          <RemoteField label="Sound Profile" hint={remote.profileName}>
            <select
              value={remote.profileId}
              disabled={disabled}
              onChange={(e) => setProfile(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none disabled:opacity-40"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-background text-foreground">
                  {p.name}
                </option>
              ))}
            </select>
          </RemoteField>

          <RemoteSlider
            label="Sound intensity"
            value={remote.soundIntensity}
            min={0.2}
            max={2}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            disabled={disabled}
            onChange={setSoundIntensity}
          />

          <RemoteToggle
            label="Motion character"
            hint={dynamicDriveStatusLabel(remote.dynamicDrive)}
            checked={remote.dynamicDrive}
            disabled={disabled}
            onChange={setTransmission}
          />

          <RemoteSlider
            label="Shift feel"
            value={remote.transientIntensity}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            disabled={disabled}
            onChange={setTransient}
          />

          <RemoteSlider
            label="Master sound"
            value={remote.volume}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            disabled={disabled}
            onChange={setVolume}
          />

          <button
            type="button"
            disabled={disabled || remote.driveStatus === "idle"}
            onClick={stopDrive}
            className="h-12 w-full rounded-full border border-border text-[11px] tracking-[0.22em] uppercase disabled:opacity-40"
          >
            Stop Drive
          </button>
        </div>
      ) : null}
    </section>
  );
}

function RemoteField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">{label}</span>
      {hint ? <span className="mt-1 block text-xs text-foreground">{hint}</span> : null}
      {children}
    </label>
  );
}

function RemoteSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          {label}
        </span>
        <span className="font-mono text-xs text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-foreground disabled:opacity-40"
      />
    </label>
  );
}

function RemoteToggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 text-xs text-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${
          checked ? "border-foreground bg-foreground/90" : "border-border bg-surface-2"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-background transition-transform ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
