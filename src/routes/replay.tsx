import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listTraces, getTrace, type DriveTrace } from "@/lib/drive/traces";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettings } from "@/lib/drive/useSettings";
import { allProfiles } from "@/lib/sound/profiles";
import { downloadBlob, renderToAudio } from "@/lib/sound/render";
import { driveCoachFn } from "@/lib/cloud/server-fns";

export const Route = createFileRoute("/replay")({
  component: Replay,
  head: () => ({
    meta: [
      { title: "Replay - ELCAMOSO" },
      {
        name: "description",
        content: "Replay a recorded drive through any Sound Profile. Traces stay on this device.",
      },
      { property: "og:title", content: "Replay - ELCAMOSO" },
      {
        property: "og:description",
        content: "Replay a recorded drive through any Sound Profile.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/replay" },
    ],
    links: [{ rel: "canonical", href: "/replay" }],
  }),
});

function Replay() {
  const { settings, update } = useSettings();
  const snap = useSessionStore();
  const [traces, setTraces] = useState<DriveTrace[]>([]);
  const [coach, setCoach] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listTraces().then(setTraces);
  }, [snap.lastTraceId]);

  const play = async (id: string) => {
    const trace = await getTrace(id);
    if (trace) await getSession().startReplay(trace);
  };

  const exportClip = async (trace: DriveTrace) => {
    setBusy(true);
    try {
      const blob = await renderToAudio({ profileId: settings.profileId, trace });
      downloadBlob(blob, `elcamoso-${trace.id}.wav`);
    } finally {
      setBusy(false);
    }
  };

  const askCoach = async (trace: DriveTrace) => {
    const result = await driveCoachFn({ data: { aggregates: trace.aggregates } });
    setCoach(`${result.summary} ${result.suggestion}`);
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-6 pt-16 pb-28 sm:px-10">
        <h1 className="text-3xl font-light">Drive recordings</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last drives stay on this device. Replay any of them through the Sound Profile you have
          selected now.
        </p>

        {!traces.length ? (
          <p className="mt-12 text-sm text-muted-foreground">
            No recordings yet. Finish a drive first.
          </p>
        ) : (
          <ul className="mt-12 divide-y divide-border border-y border-border">
            {traces.map((trace) => (
              <li key={trace.id} className="flex flex-wrap items-center gap-4 py-6">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-light">{new Date(trace.startedAt).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(trace.durationMs / 1000)}s · peak{" "}
                    {Math.round(trace.aggregates.maxSpeedMps * 3.6)} km/h
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void play(trace.id)}
                  className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase"
                >
                  Replay
                </button>
                <button
                  type="button"
                  onClick={() => void exportClip(trace)}
                  disabled={busy}
                  className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase"
                >
                  Clip
                </button>
                <button
                  type="button"
                  onClick={() => void askCoach(trace)}
                  className="h-11 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase"
                >
                  Coach
                </button>
              </li>
            ))}
          </ul>
        )}

        {snap.kind === "replay" ? (
          <button
            type="button"
            onClick={() => getSession().stop()}
            className="mt-8 h-12 rounded-full bg-primary px-8 text-xs tracking-[0.2em] text-primary-foreground uppercase"
          >
            Stop replay
          </button>
        ) : null}

        {coach ? <p className="mt-8 text-sm text-muted-foreground">{coach}</p> : null}

        <label className="mt-12 flex items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={settings.includeDriveHistory}
            onChange={(e) => update({ includeDriveHistory: e.target.checked })}
            className="mt-1 h-4 w-4 accent-foreground"
          />
          Include drive history if I opt into ELCAMOSO Cloud. Raw GPS is never sent to the model.
        </label>

        <Link
          to="/drive"
          className="mt-10 inline-block text-[11px] tracking-[0.2em] text-muted-foreground uppercase"
        >
          Back to Drive
        </Link>
      </div>
    </main>
  );
}
