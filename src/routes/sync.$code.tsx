import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { formatPairCode, normalizePairCode } from "@/lib/phone-sync/protocol";
import {
  requestMotionPermission,
  startPhoneStreaming,
  type StreamerStatus,
} from "@/lib/phone-sync/phone-streamer";
import { keepScreenAwake, type KeepAwake } from "@/lib/phone-sync/wake-lock";

export const Route = createFileRoute("/sync/$code")({
  component: PhoneSyncPage,
  head: () => ({
    meta: [{ title: "Phone paired · ELCAMOSO" }, { name: "robots", content: "noindex" }],
  }),
});

function PhoneSyncPage() {
  const { code: raw } = Route.useParams();
  const code = normalizePairCode(raw);
  const [status, setStatus] = useState<StreamerStatus | null>(null);
  const [awake, setAwake] = useState<KeepAwake["mode"] | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const awakeRef = useRef<KeepAwake | null>(null);

  useEffect(
    () => () => {
      stopRef.current?.();
      awakeRef.current?.release();
    },
    [],
  );

  if (!code) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-light">Invalid code</h1>
        <Link to="/sync" className="mt-4 inline-block underline">
          Enter the code again
        </Link>
      </main>
    );
  }

  const start = async () => {
    // Both need the tap: iOS motion permission and wake lock.
    const motionOk = await requestMotionPermission();
    const ka = await keepScreenAwake();
    awakeRef.current = ka;
    setAwake(ka.mode);
    stopRef.current = await startPhoneStreaming(code, motionOk, setStatus);
  };

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    awakeRef.current?.release();
    awakeRef.current = null;
    setStatus(null);
    setAwake(null);
  };

  const live = status?.channel === "live" && !status.carClosed;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Pair phone</p>
      <h1 className="mt-2 text-2xl font-light">Code {formatPairCode(code)}</h1>

      <div className="mt-6 rounded-2xl border border-amber-400/50 p-4 text-sm">
        <p className="font-medium">Keep this page open and the screen on while driving.</p>
        <p className="mt-2 text-muted-foreground">
          Mount the phone safely before you set off. Do not handle the phone while driving.
        </p>
      </div>

      {!status ? (
        <button
          type="button"
          className="mt-6 w-full rounded-full bg-foreground px-4 py-4 text-background"
          onClick={() => void start()}
        >
          Start sharing with car
        </button>
      ) : (
        <>
          <ul className="mt-6 space-y-2 text-sm">
            <li>
              Car link:{" "}
              {status.carClosed
                ? "car ended pairing"
                : status.channel === "live"
                  ? "connected"
                  : status.channel === "error"
                    ? "could not connect"
                    : "connecting…"}
            </li>
            <li>
              Location:{" "}
              {status.gps === "ok" ? "on" : status.gps === "denied" ? "not allowed" : "waiting…"}
            </li>
            <li>
              Motion:{" "}
              {status.motion === "ok"
                ? "on"
                : status.motion === "denied"
                  ? "not allowed"
                  : "not available"}
            </li>
            <li>
              Screen stays on:{" "}
              {awake === "wakelock" || awake === "video"
                ? "yes"
                : "not supported — set Auto-Lock to Never"}
            </li>
          </ul>
          {live && (
            <p className="mt-4 text-emerald-400">
              Sharing live. You can put the phone in its mount.
            </p>
          )}
          <button
            type="button"
            className="mt-6 w-full rounded-full border border-border px-4 py-3"
            onClick={stop}
          >
            Stop sharing
          </button>
        </>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Location and motion are sent live to the car only and are never stored.
      </p>
    </main>
  );
}
