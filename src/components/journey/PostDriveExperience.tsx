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
    <div className="fixed inset-0 z-[70] flex flex-col bg-black pt-[max(1rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {phase === "title" || !journey ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <ElcamosoMark intensity={0.55} waveResponse={0.8} className="mx-auto h-10 w-auto" />
          <p className="mt-8 text-[10px] tracking-[0.34em] text-muted-foreground uppercase [@media(max-height:820px)]:mt-5">
            ELCAMOSO
          </p>
          <h1 className="mt-5 text-3xl font-light tracking-tight sm:text-4xl [@media(max-height:820px)]:mt-3 [@media(max-height:820px)]:text-2xl">
            YOUR DRIVE HAS A SOUND.
          </h1>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/*
            Keep CTAs with the DNA (no viewport-bottom void). On tall tablets the
            block centers; on short viewports the whole card scrolls so Later stays reachable.
          */}
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-3 sm:py-5">
            <div className="shrink-0 text-center">
              <p className="text-[10px] tracking-[0.34em] text-muted-foreground uppercase">
                YOUR DRIVE HAS A SOUND.
              </p>
              <p className="mt-3 text-base font-light sm:mt-4 sm:text-lg [@media(max-height:820px)]:mt-2">
                {mins} min · {journey.experienceName}
              </p>
            </div>
            <div className="mt-5 text-left sm:mt-6 [@media(max-height:820px)]:mt-4">
              <DriveDnaViz dna={journey.dna} compact />
            </div>
            <div className="mt-6 flex shrink-0 flex-col gap-1 border-t border-border/40 pt-4 sm:mt-8 sm:gap-2 sm:pt-5 [@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:pt-3">
              {songEnabled ? (
                <Link
                  to="/journeys/$journeyId"
                  params={{ journeyId: journey.id }}
                  search={{ create: "1" }}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[10px] tracking-[0.22em] text-primary-foreground uppercase sm:h-14"
                >
                  Create Drive Song
                </Link>
              ) : (
                <Link
                  to="/journeys/$journeyId"
                  params={{ journeyId: journey.id }}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[10px] tracking-[0.22em] text-primary-foreground uppercase sm:h-14"
                >
                  View journey
                </Link>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="h-11 text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground sm:h-12"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
