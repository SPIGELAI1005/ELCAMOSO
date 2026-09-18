import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { listJourneys, type JourneyExperienceKind, type JourneySummary } from "@/lib/journey";
import { getJourneyRepository, type JourneyTraceV1 } from "@/lib/journey-trace";

export const Route = createFileRoute("/journeys")({
  component: JourneysPage,
  head: () => createSeoHeadFromPath("/journeys"),
});

type Filter = "all" | "songs" | "traces" | JourneyExperienceKind;

function JourneysPage() {
  const [items, setItems] = useState<JourneySummary[]>([]);
  const [traces, setTraces] = useState<JourneyTraceV1[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    void listJourneys().then(setItems);
    void getJourneyRepository()
      .listJourneys()
      .then((rows) => setTraces(rows.filter((t) => t.status !== "recording")));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "songs") return items.filter((j) => Boolean(j.song));
    if (filter === "traces") return [];
    return items.filter((j) => j.experienceKind === filter);
  }, [items, filter]);

  const showTraces = filter === "all" || filter === "traces";

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "traces", label: "Captures" },
    { id: "songs", label: "Songs" },
    { id: "engine", label: "Engine" },
    { id: "symphony", label: "Symphony" },
    { id: "world", label: "World" },
    { id: "fusion", label: "Fusion" },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-8 pb-24 sm:px-10">
      <p className="text-[10px] tracking-[0.32em] text-muted-foreground uppercase">Journeys</p>
      <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl">
        Every drive creates a different song.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Replay a captured drive through any experience - or turn it into a Drive Song.
      </p>

      <div className="mt-10 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-4 py-2 text-[10px] tracking-[0.18em] uppercase ${
              f.id === filter
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showTraces && traces.length > 0 ? (
        <ul className="mt-12 divide-y divide-border border-y border-border">
          {traces.map((t) => (
            <li key={t.journeyId}>
              <Link
                to="/journeys/$journeyId"
                params={{ journeyId: t.journeyId }}
                className="flex items-start justify-between gap-4 py-7 hover:opacity-90"
              >
                <div>
                  <p className="text-lg font-light">Silent Capture</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {Math.max(1, Math.round(t.durationMs / 60000))} min · {t.summary.sampleCount}{" "}
                    samples · Hear this drive
                  </p>
                </div>
                <span className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  Replay
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {filter !== "traces" && filtered.length === 0 && !(showTraces && traces.length) ? (
        <p className="mt-16 text-sm text-muted-foreground">
          No journeys yet. Finish a drive on{" "}
          <Link to="/drive" className="text-foreground underline underline-offset-4">
            Drive
          </Link>
          .
        </p>
      ) : filter !== "traces" && filtered.length > 0 ? (
        <ul className="mt-12 divide-y divide-border border-y border-border">
          {filtered.map((j) => (
            <li key={j.id}>
              <Link
                to="/journeys/$journeyId"
                params={{ journeyId: j.id }}
                className="flex items-start justify-between gap-4 py-7 hover:opacity-90"
              >
                <div>
                  <p className="text-lg font-light">{j.song?.title ?? j.experienceName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {Math.max(1, Math.round(j.durationMs / 60000))} min · {j.experienceKind}
                    {j.song ? " · Drive Song" : ""}
                  </p>
                </div>
                <span className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  Open
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
