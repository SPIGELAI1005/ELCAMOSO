import { useCallback, useState } from "react";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { PhoneRemoteController } from "@/components/PhoneRemoteController";
import { useDriveRelay } from "@/lib/drive-relay/client";
import { RELAY_MOTION_STREAM_ENABLED } from "@/lib/drive-relay/config";
import { phoneSensorAttentionMessage } from "@/lib/motion/phone-sensor-status";
import { usePhoneSensorClient } from "@/lib/motion/phone-sensor-client";
import { useSettings } from "@/lib/drive/useSettings";

export interface PhonePairCredentials {
  sessionId: string;
  joinSecret: string;
  expiresAt: number;
}

const RELAY_CRED_KEY = "elcamoso.relay.cred";

export function readStoredRelayCred(): PhonePairCredentials | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RELAY_CRED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhonePairCredentials;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.joinSecret !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(RELAY_CRED_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredRelayCred(cred: PhonePairCredentials) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(RELAY_CRED_KEY, JSON.stringify(cred));
}

export function clearStoredRelayCred() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(RELAY_CRED_KEY);
}

/** Phone UI after claim or code entry — sensors only; sound stays on the car. */
export function PhonePairSession({
  sessionId,
  joinSecret,
  onDisconnect,
  confirmFirst = false,
}: {
  sessionId: string;
  joinSecret: string;
  onDisconnect: () => void;
  confirmFirst?: boolean;
}) {
  const { settings } = useSettings();
  const [confirmed, setConfirmed] = useState(!confirmFirst);

  const relay = useDriveRelay({
    sessionId,
    role: "phone",
    token: joinSecret,
    enabled: confirmed,
  });

  const relayLinked = relay.status === "connected" && relay.peers.display;
  const sensorsEnabled = confirmed && RELAY_MOTION_STREAM_ENABLED && relayLinked;

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

  const showPermissionPrompt = sensorsEnabled && sensors.needsPermissionPrompt;
  const sensorAttention =
    sensorsEnabled && !showPermissionPrompt ? phoneSensorAttentionMessage(sensors.status) : null;

  const motionActive = sensors.status.motion === "live" || sensors.status.motion === "calibrating";
  const gpsActive = sensors.status.gps === "live" || sensors.status.gps === "weak";
  const sending =
    sensorsEnabled && !showPermissionPrompt && !sensorAttention && sensors.status.sendHz > 0;

  if (!confirmed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
        <ElcamosoMark className="mb-8 h-8 w-auto" />
        <h1 className="text-2xl font-light">Connect this phone to your ELCAMOSO drive?</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Your phone sends motion and location to the car. Sound stays on the Tesla. You can
          disconnect anytime.
        </p>
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="mt-10 h-14 w-full rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase"
        >
          Connect
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          className="mt-4 text-center text-[10px] tracking-[0.24em] text-muted-foreground uppercase"
        >
          Cancel
        </button>
      </main>
    );
  }

  if (!relayLinked) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <ElcamosoMark animate className="h-12 w-auto opacity-80" />
        <p className="text-sm text-muted-foreground">
          {relay.status === "reconnecting" ? "Reconnecting…" : "Connecting to your car…"}
        </p>
        <button
          type="button"
          onClick={() => {
            relay.disconnect();
            onDisconnect();
          }}
          className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase"
        >
          Cancel
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <ElcamosoMark className="h-8 w-auto" />
        <button
          type="button"
          onClick={() => {
            relay.disconnect();
            onDisconnect();
          }}
          className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
        >
          Disconnect
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-8">
        <div className="text-center">
          <ElcamosoMark animate className="mx-auto h-14 w-auto" />
          <h1 className="mt-6 text-2xl font-light">Connected to car</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
            Keep this screen open. Sound plays in the car — this phone is the motion sensor.
          </p>
        </div>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            Motion {motionActive ? <span className="text-foreground">active</span> : <span>waiting</span>}
          </li>
          <li>
            GPS {gpsActive ? <span className="text-foreground">active</span> : <span>waiting</span>}
          </li>
          <li>
            Sensor data{" "}
            {sending ? <span className="text-foreground">sending</span> : <span>paused</span>}
          </li>
        </ul>

        {showPermissionPrompt ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Allow motion and location so the car can follow the road. Data stays on this link for
              the drive session.
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
    </main>
  );
}
