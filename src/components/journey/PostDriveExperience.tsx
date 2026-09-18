import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DriveDnaViz } from "@/components/journey/DriveDnaViz";
import { getJourney, type JourneySummary } from "@/lib/journey";
import { isDriveSongEnabled } from "@/lib/experiences";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { getSession } from "@/lib/drive/session";

export function PostDriveExperience({
  journeyId,
  onDismiss,
}: {
  journeyId: string;
  onDismiss: () => void;
}) {
  const [journey, setJourney] = useState<JourneySummary | null>(() =>
    getSession().getLastJourney(),
  );
  const [phase, setPhase] = useState<"title" | "detail">("title");
  const songEnabled = isDriveSongEnabled();

  useEffect(() => {
    let cancelled = false;
    const cached = getSession().getLastJourney();
    if (cached && cached.id === journeyId) setJourney(cached);
    void getJourney(journeyId).then((j) => {
      if (!cancelled && j) setJourney(j);
    });
    const t = window.setTimeout(() => setPhase("detail"), 1600);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [journeyId]);

  const mins = journey ? Math.max(1, Math.round(journey.durationMs / 60000)) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black px-6">
      <div className="mx-auto w-full max-w-md text-center">
        {phase === "title" || !journey ? (
          <>
            <ElcamosoMark intensity={0.55} waveResponse={0.8} className="mx-auto h-10 w-auto" />
            <p className="mt-12 text-[10px] tracking-[0.34em] text-muted-foreground uppercase">
              ELCAMOSO
            </p>
            <h1 className="mt-6 text-3xl font-light tracking-tight sm:text-4xl">
              YOUR DRIVE HAS A SOUND.
            </h1>
          </>
        ) : (
          <>
            <p className="text-[10px] tracking-[0.34em] text-muted-foreground uppercase">
              YOUR DRIVE HAS A SOUND.
            </p>
            <p className="mt-6 text-lg font-light">
              {mins} min · {journey.experienceName}
            </p>
            <div className="mt-10 text-left">
              <DriveDnaViz dna={journey.dna} />
            </div>
            <div className="mt-12 flex flex-col gap-3">
              {songEnabled ? (
                <Link
                  to="/journeys/$journeyId"
                  params={{ journeyId: journey.id }}
                  search={{ create: "1" }}
                  className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 text-[10px] tracking-[0.22em] text-primary-foreground uppercase"
                >
                  Create Drive Song
                </Link>
              ) : (
                <Link
                  to="/journeys/$journeyId"
                  params={{ journeyId: journey.id }}
                  className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 text-[10px] tracking-[0.22em] text-primary-foreground uppercase"
                >
                  View journey
                </Link>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="h-12 text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground"
              >
                Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
