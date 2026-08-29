import { useCallback, useEffect, useMemo, useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";

import { ElcamosoMark } from "@/components/ElcamosoLogo";

import { PhoneRemoteController } from "@/components/PhoneRemoteController";

import { useDriveRelay } from "@/lib/drive-relay/client";

import { RELAY_MOTION_STREAM_ENABLED } from "@/lib/drive-relay/config";

import { joinDriveRelaySessionFn } from "@/lib/drive-relay/server-fns";

import { phoneSensorAttentionMessage } from "@/lib/motion/phone-sensor-status";
import { usePhoneSensorClient } from "@/lib/motion/phone-sensor-client";

import { useSettings } from "@/lib/drive/useSettings";

export const Route = createFileRoute("/connect/$sessionId")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const token = typeof search["token"] === "string" ? search["token"] : undefined;
    return token ? { token } : {};
  },

  component: ConnectSessionScreen,

  head: ({ params }) => ({
    meta: [
      { title: `Connect - ${params.sessionId} - ELCAMOSO` },
      {
        name: "description",
        content: "Link your phone to ELCAMOSO in your car.",
      },
    ],
  }),
});

function ConnectSessionScreen() {
  const { sessionId } = Route.useParams();
  const { token: tokenFromUrl } = Route.useSearch();
  const { settings } = useSettings();

  const [pairingInput, setPairingInput] = useState("");
  const [joinSecret, setJoinSecret] = useState<string | null>(tokenFromUrl ?? null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) setJoinSecret(tokenFromUrl);
  }, [tokenFromUrl]);

  const relay = useDriveRelay({
    sessionId,
    role: "phone",
    token: joinSecret ?? "",
    enabled: Boolean(joinSecret),
  });

  const relayLinked = relay.status === "connected" && relay.peers.display;
  const sensorsEnabled = RELAY_MOTION_STREAM_ENABLED && relayLinked;

  const sendMotion = relay.sendMotion;
  const onSample = useCallback(
    (sample: Parameters<typeof sendMotion>[0]) => {
      sendMotion(sample);
    },
    [sendMotion],
  );

  const sensors = usePhoneSensorClient({
    enabled: sensorsEnabled,
    onSample,
    sensitivity: settings.motionSensitivity,
    initialNoiseFloor: settings.motionNoiseFloor,
  });

  const canJoin = useMemo(() => pairingInput.trim().length === 6, [pairingInput]);

  const submitPairingCode = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinDriveRelaySessionFn({
        data: { sessionId, pairingCode: pairingInput.trim() },
      });
      if (!result.ok) {
        setJoinError("Invalid code or expired link.");
        return;
      }
      setJoinSecret(result.joinSecret);
    } catch {
      setJoinError("Could not join. Check the code and try again.");
    } finally {
      setJoining(false);
    }
  };

  const linked = Boolean(joinSecret) && relayLinked;
  const showPermissionPrompt = sensorsEnabled && sensors.needsPermissionPrompt;
  const sensorAttention =
    sensorsEnabled && !showPermissionPrompt ? phoneSensorAttentionMessage(sensors.status) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <ElcamosoMark className="h-8 w-auto" />
        {!linked ? (
          <Link
            to="/drive"
            className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase"
          >
            Drive
          </Link>
        ) : null}
      </div>

      {!joinSecret ? (
        <div className="flex flex-1 flex-col gap-8">
          <div>
            <h1 className="text-2xl font-light">Link to your car</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Enter the six-digit code shown on the car display.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                Code
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={pairingInput}
                onChange={(e) => setPairingInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-2 w-full border-b border-border bg-transparent py-3 text-center font-mono text-3xl tracking-[0.35em] outline-none"
                placeholder="000000"
              />
            </label>

            {joinError ? <p className="text-xs text-muted-foreground">{joinError}</p> : null}

            <button
              type="button"
              disabled={!canJoin || joining}
              onClick={() => void submitPairingCode()}
              className="h-12 w-full rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-40"
            >
              {joining ? "Linking" : "Link"}
            </button>
          </div>
        </div>
      ) : linked ? (
        <div className="flex flex-1 flex-col gap-8">
          <div className="text-center">
            <ElcamosoMark animate className="mx-auto h-14 w-auto" />
            <h1 className="mt-6 text-2xl font-light">Phone linked</h1>
            <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
              {RELAY_MOTION_STREAM_ENABLED
                ? "Keep this screen open. Your drive stays on your devices."
                : "Connected to your car."}
            </p>
          </div>

          {showPermissionPrompt ? (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Allow location and motion so the car can follow the road.
              </p>
              <button
                type="button"
                onClick={() => void sensors.requestAccess()}
                className="h-12 w-full rounded-full border border-foreground text-[11px] tracking-[0.22em] uppercase"
              >
                Enable sensors
              </button>
            </div>
          ) : sensorAttention ? (
            <p className="text-center text-sm text-muted-foreground">{sensorAttention}</p>
          ) : null}

          <PhoneRemoteController relay={relay} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <ConnectLoader label="Linking" />
          <p className="text-sm text-muted-foreground">Connecting to your car…</p>
        </div>
      )}
    </main>
  );
}

function ConnectLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <ElcamosoMark animate className="h-12 w-auto opacity-80" />
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
