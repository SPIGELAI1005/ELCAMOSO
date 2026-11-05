import { useEffect, useState } from "react";
import { getJourneyRepository, type JourneyTraceV1 } from "@/lib/journey-trace";

/** On launch: offer recover / discard for incomplete Silent Capture journeys. */
export function IncompleteJourneyRecovery({
  onRecover,
}: {
  /** Open the result screen (song + chart) for the recovered journey. */
  onRecover?: (journeyId: string) => void;
} = {}) {
  const [incomplete, setIncomplete] = useState<JourneyTraceV1 | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const repo = getJourneyRepository();
      // Recordings left over from the retired "live + capture" mode came from normal engine
      // drives. Remove them quietly instead of offering a song nobody asked for.
      const isStaleLiveRecording = (t: JourneyTraceV1) => t.outputMode === "live-and-capture";
      const activeId = await repo.getActiveJourneyId();
      if (activeId) {
        const t = await repo.loadJourney(activeId);
        if (t && isStaleLiveRecording(t) && t.status !== "complete") {
          await repo.cleanupIncompleteJourney(t.journeyId).catch(() => undefined);
          await repo.setActiveJourneyId(null).catch(() => undefined);
        } else if (!cancelled && t && t.status === "recording") {
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
      for (const j of list) {
        if (isStaleLiveRecording(j) && j.status !== "complete") {
          await repo.cleanupIncompleteJourney(j.journeyId).catch(() => undefined);
        }
      }
      const hit = list.find(
        (j) => !isStaleLiveRecording(j) && (j.status === "incomplete" || j.status === "recording"),
      );
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
          onClick={() => {
            onRecover?.(incomplete.journeyId);
            setIncomplete(null);
          }}
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
