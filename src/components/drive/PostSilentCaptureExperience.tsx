import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { MotionSignature } from "@/components/MotionSignature";
import {
  energySamplesFromJourneyTrace,
  getJourneyRepository,
  type JourneyTraceV1,
} from "@/lib/journey-trace";

export function PostSilentCaptureExperience({
  journeyTraceId,
  capturePausedByBrowser,
  onDismiss,
  onDelete,
}: {
  journeyTraceId: string;
  capturePausedByBrowser?: boolean;
  onDismiss: () => void;
  onDelete?: () => void;
}) {
  const [trace, setTrace] = useState<JourneyTraceV1 | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getJourneyRepository()
      .loadJourney(journeyTraceId)
      .then((t) => {
        if (!cancelled) setTrace(t);
      });
    return () => {
      cancelled = true;
    };
  }, [journeyTraceId]);

  const mins = trace ? Math.max(1, Math.round(trace.durationMs / 60000)) : 0;
  const km = trace ? trace.summary.distanceM / 1000 : 0;
  const energy = trace ? energySamplesFromJourneyTrace(trace, 24) : [];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black px-6 py-16">
      <div className="mx-auto w-full max-w-md text-center">
        <ElcamosoMark intensity={0.45} waveResponse={0.6} className="mx-auto h-9 w-auto" />
        <p className="mt-10 text-[10px] tracking-[0.34em] text-muted-foreground uppercase">
          ELCAMOSO
        </p>
        <h1 className="mt-6 text-3xl font-light tracking-tight">YOUR DRIVE IS READY.</h1>
        {trace ? (
          <p className="mt-4 text-muted-foreground">
            {mins} min
            {km > 0.05 ? ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} km` : ""}
          </p>
        ) : null}
        {capturePausedByBrowser || trace?.summary.browserPaused ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Capture was paused by the browser for part of this drive.
          </p>
        ) : null}
        {trace?.status === "incomplete" ? (
          <p className="mt-3 text-sm text-muted-foreground">Recording ended unexpectedly.</p>
        ) : null}

        <div className="mt-10 border border-foreground/10 bg-black px-4 py-6">
          <p className="mb-4 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Motion Signature
          </p>
          <MotionSignature
            seed={journeyTraceId}
            energy={energy}
            family="drive-song"
            ribbons={4}
            width={360}
            height={200}
            className="mx-auto h-40 w-full text-foreground"
            accent="rgba(180,210,255,0.75)"
            label="Motion Signature for this drive"
          />
        </div>

        <p className="mt-10 text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
          Hear this drive
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              ["Engine", "/sounds"],
              ["Symphony", "/symphony"],
              ["World", "/worlds"],
              ["Fusion", "/fusion"],
            ] as const
          ).map(([label, to]) => (
            <Link
              key={label}
              to={to}
              className="border border-foreground/20 py-3 text-[10px] tracking-[0.18em] uppercase"
            >
              {label}
            </Link>
          ))}
        </div>

        <Link
          to="/journeys/$journeyId"
          params={{ journeyId: journeyTraceId }}
          search={{ create: "1" }}
          className="mt-4 inline-flex h-14 w-full items-center justify-center rounded-full bg-primary text-[10px] tracking-[0.22em] text-primary-foreground uppercase"
        >
          Create Drive Song
        </Link>

        <div className="mt-8 flex gap-4 justify-center">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              void getJourneyRepository().deleteJourney(journeyTraceId);
              onDelete?.();
              onDismiss();
            }}
            className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
