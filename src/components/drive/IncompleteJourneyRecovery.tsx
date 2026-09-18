import { useEffect, useState } from "react";
import { getJourneyRepository, type JourneyTraceV1 } from "@/lib/journey-trace";

/** On launch: offer recover / discard for incomplete Silent Capture journeys. */
export function IncompleteJourneyRecovery() {
  const [incomplete, setIncomplete] = useState<JourneyTraceV1 | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const repo = getJourneyRepository();
      const activeId = await repo.getActiveJourneyId();
      if (activeId) {
        const t = await repo.loadJourney(activeId);
        if (!cancelled && t && t.status === "recording") {
          const finalized = {
            ...t,
            status: "incomplete" as const,
            endedAt: t.endedAt ?? Date.now(),
            summary: { ...t.summary, endedUnexpectedly: true },
          };
          await repo.finalizeJourney(finalized);
          if (!cancelled) setIncomplete(finalized);
          return;
        }
      }
      const list = await repo.listJourneys();
      const hit = list.find((j) => j.status === "incomplete" || j.status === "recording");
      if (!cancelled && hit) setIncomplete(hit);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!incomplete) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-foreground/15 bg-background/95 px-6 py-5 backdrop-blur">
      <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        Incomplete journey
      </p>
      <p className="mt-2 text-sm font-light">
        A Silent Capture ended unexpectedly. Recover or discard?
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="flex-1 border border-foreground/30 py-3 text-[10px] tracking-[0.2em] uppercase"
          onClick={() => setIncomplete(null)}
        >
          Recover journey
        </button>
        <button
          type="button"
          className="flex-1 py-3 text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
          onClick={() => {
            void getJourneyRepository().cleanupIncompleteJourney(incomplete.journeyId);
            setIncomplete(null);
          }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
