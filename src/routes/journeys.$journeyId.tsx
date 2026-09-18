import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DriveDnaViz } from "@/components/journey/DriveDnaViz";
import { JourneyPlayer } from "@/components/journey/JourneyPlayer";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { listSymphonyPacks } from "@/lib/symphony";
import {
  buildJourneySharePayload,
  createDriveSongForJourney,
  deleteJourney,
  encodeJourneyShare,
  getJourney,
  getSongAudio,
  journeyShareUrl,
  saveJourney,
  SHARE_DISCLOSURE,
  summariseJourneyFromJourneyTrace,
  type JourneySummary,
} from "@/lib/journey";
import { getJourneyRepository, type JourneyTraceV1 } from "@/lib/journey-trace";
import { isDriveSongEnabled, isDriveReelEnabled } from "@/lib/experiences";
import { downloadBlob } from "@/lib/sound/render";
import { createSeoHeadFromPath } from "@/lib/seo";

export const Route = createFileRoute("/journeys/$journeyId")({
  validateSearch: (search: Record<string, unknown>): { create?: string } => {
    const create = typeof search["create"] === "string" ? search["create"] : undefined;
    return create ? { create } : {};
  },
  component: JourneyDetailPage,
  head: () => createSeoHeadFromPath("/journeys"),
});

function JourneyDetailPage() {
  const { journeyId } = Route.useParams();
  const { create } = Route.useSearch();
  const navigate = useNavigate();
  const [journey, setJourney] = useState<JourneySummary | null>(null);
  const [trace, setTrace] = useState<JourneyTraceV1 | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [includeDuration, setIncludeDuration] = useState(false);
  const [packId, setPackId] = useState("symphony-cinematic-rock");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const [j, t] = await Promise.all([
      getJourney(journeyId),
      getJourneyRepository().loadJourney(journeyId),
    ]);
    setJourney(j);
    setTrace(t?.samples.length ? t : null);
    if (j?.symphonyPackId) setPackId(j.symphonyPackId);
    if (j?.song?.symphonyPackId) setPackId(j.song.symphonyPackId);
    if (j?.song) {
      const blob = await getSongAudio(j.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    }
    setLoaded(true);
  };

  useEffect(() => {
    void load();
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId]);

  useEffect(() => {
    if (create === "1" && (journey || trace) && !journey?.song && isDriveSongEnabled()) {
      void handleCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, journey?.id, trace?.journeyId]);

  const handleCreate = async () => {
    if (!isDriveSongEnabled()) {
      setNote("Drive Song is disabled (DRIVE_SONG_ENABLED).");
      return;
    }
    setBusy(true);
    setNote("Composing…");
    try {
      let sourceJourney = journey;
      if (!sourceJourney) {
        const sourceTrace = trace ?? (await getJourneyRepository().loadJourney(journeyId));
        if (!sourceTrace?.samples.length) {
          setNote("Drive Song needs motion samples from a finished drive.");
          return;
        }
        sourceJourney = summariseJourneyFromJourneyTrace(sourceTrace);
        await saveJourney(sourceJourney);
        setJourney(sourceJourney);
      }
      const next = await createDriveSongForJourney(journeyId, { symphonyPackId: packId });
      if (next) {
        setJourney(next);
        setNote(next.song?.audioBlobId ? "Drive Song ready." : "Structure ready (render skipped).");
        const blob = await getSongAudio(journeyId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          setAudioUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not create song.");
    } finally {
      setBusy(false);
    }
  };

  const rename = async (title: string) => {
    if (!journey?.song) return;
    const next = { ...journey, song: { ...journey.song, title: title.slice(0, 48) } };
    await saveJourney(next);
    setJourney(next);
  };

  const togglePlay = async () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      await audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleDelete = async () => {
    await deleteJourney(journeyId);
    await getJourneyRepository().deleteJourney(journeyId);
    void navigate({ to: "/journeys" });
  };

  const handleShare = async () => {
    if (!journey?.song) return;
    const payload = buildJourneySharePayload(journey, { includeDuration });
    if (!payload) return;
    const encoded = encodeJourneyShare(payload);
    const url = journeyShareUrl(encoded);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setNote("Share link copied - no route or GPS included.");
    } else {
      setNote(url);
    }
    setShareOpen(false);
  };

  const handleSaveWav = async () => {
    const blob = await getSongAudio(journeyId);
    if (blob) downloadBlob(blob, `${journey?.song?.title ?? "drive-song"}.wav`);
  };

  if (!loaded) {
    return (
      <main className="mx-auto max-w-lg px-6 pt-20 text-center">
        <p className="text-muted-foreground">Loading journey…</p>
      </main>
    );
  }

  if (!journey && !trace) {
    return (
      <main className="mx-auto max-w-lg px-6 pt-20 text-center">
        <h1 className="text-2xl font-light">Journey not found</h1>
        <Link to="/journeys" className="mt-8 inline-block text-[10px] tracking-[0.22em] uppercase">
          All journeys
        </Link>
      </main>
    );
  }

  const chapters = journey?.song?.sections.map((s) => s.chapter) ?? [
    "INTRO",
    "BUILD",
    "FLOW",
    "PEAK",
    "RELEASE",
  ];
  const displayedDurationMs = journey?.durationMs ?? trace?.durationMs ?? 0;
  const durationLabel = displayedDurationMs
    ? `${Math.max(1, Math.round(displayedDurationMs / 60000))} min`
    : null;
  const driveDate = journey?.createdAt ?? trace?.startedAt ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-6 pt-10 pb-28 sm:px-10">
      <p className="text-center text-[10px] tracking-[0.34em] text-muted-foreground uppercase">
        ELCAMOSO
      </p>
      <h1 className="mt-4 text-center text-3xl font-light tracking-tight">YOUR DRIVE</h1>
      {durationLabel || driveDate ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {durationLabel}
          {journey?.experienceName ? ` · ${journey.experienceName}` : ""}
          {driveDate ? ` · ${new Date(driveDate).toLocaleDateString()}` : ""}
        </p>
      ) : null}

      {/* -- Replay drive (real-time) -- */}
      <section className="mt-12 border-t border-border/60 pt-10">
        <p className="text-center text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Replay drive
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Hear the journey exactly as it happened.
        </p>
        <JourneyPlayer journeyId={journeyId} />
      </section>

      {/* -- Drive Song (condensed) -- */}
      <section className="mt-16 border-t border-border/60 pt-10">
        <p className="text-center text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Drive Song
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Turn the journey into a 2–3 minute composition.
        </p>

        {journey?.song ? (
          <input
            className="mt-8 w-full border-b border-border bg-transparent py-3 text-center text-2xl font-light outline-none"
            value={journey.song.title}
            onChange={(e) => void rename(e.target.value)}
            aria-label="Song title"
          />
        ) : (
          <p className="mt-8 text-center text-xl font-light text-muted-foreground">
            {journey?.experienceName ?? "Create a condensed piece"}
          </p>
        )}

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            disabled={!audioUrl || busy}
            onClick={() => void togglePlay()}
            className="flex h-28 w-28 items-center justify-center rounded-full border border-foreground text-[10px] tracking-[0.22em] uppercase disabled:opacity-40"
          >
            {playing ? "Pause" : "Play"}
          </button>
        </div>
        {audioUrl ? (
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
        ) : null}

        <div className="mt-12">
          <ElcamosoMark intensity={0.45} waveResponse={0.7} className="mx-auto h-8 w-auto" />
        </div>

        {journey ? (
          <div className="mt-12">
            <DriveDnaViz dna={journey.dna} />
          </div>
        ) : null}

        {journey ? (
          <section className="mt-12">
            <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              Musical chapters
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {chapters.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase text-muted-foreground"
                >
                  {c === "GROOVE" ? "FLOW" : c}
                </span>
              ))}
            </div>
            <div className="mt-6 h-16 overflow-hidden border border-border/60">
              <div className="flex h-full items-end gap-px px-1" aria-hidden>
                {journey.energyTimeline.map((pt, i) => (
                  <div
                    key={`${pt.t}-${i}`}
                    className="flex-1 bg-foreground/40"
                    style={{ height: `${Math.max(8, pt.energy * 100)}%` }}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {!journey?.song && (journey || trace) ? (
          <div className="mt-10 space-y-4">
            <label className="block text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
              Music pack
              <select
                value={packId}
                onChange={(e) => setPackId(e.target.value)}
                className="mt-2 w-full border-b border-border bg-transparent py-3 text-base font-light outline-none"
              >
                {listSymphonyPacks().map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !isDriveSongEnabled()}
              onClick={() => void handleCreate()}
              className="h-14 w-full rounded-full bg-primary text-[10px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-50"
            >
              {busy ? "Composing…" : "Create Drive Song"}
            </button>
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {journey?.song ? (
            <>
              <button
                type="button"
                onClick={() => void handleSaveWav()}
                className="h-11 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setPackId(journey.song?.symphonyPackId ?? packId);
                  void handleCreate();
                }}
                className="h-11 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase"
              >
                Remix song
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="h-11 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase"
              >
                Share
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="h-11 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase text-muted-foreground"
          >
            Delete
          </button>
        </div>
      </section>

      {isDriveReelEnabled() && journey?.reel ? (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Drive Reel highlight · {journey.reel.label} · {journey.reel.startSec.toFixed(0)}–
          {journey.reel.endSec.toFixed(0)}s
        </p>
      ) : null}

      {note ? <p className="mt-6 text-center text-sm text-muted-foreground">{note}</p> : null}

      {shareOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md border border-border bg-background px-6 py-8">
            <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              Before sharing
            </p>
            <p className="mt-4 text-xl font-light">Exactly what is shared</p>
            <ul className="mt-6 space-y-2 text-sm">
              {SHARE_DISCLOSURE.shared.map((s) => (
                <li key={s}>✓ {s}</li>
              ))}
            </ul>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {SHARE_DISCLOSURE.notShared.map((s) => (
                <li key={s}>✕ {s}</li>
              ))}
            </ul>
            <label className="mt-6 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={includeDuration}
                onChange={(e) => setIncludeDuration(e.target.checked)}
              />
              Include journey duration
            </label>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="h-12 flex-1 rounded-full bg-primary text-[10px] tracking-[0.2em] text-primary-foreground uppercase"
              >
                Copy share link
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="h-12 px-4 text-[10px] tracking-[0.2em] uppercase text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-14 text-center text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
        <Link to="/journeys" className="hover:text-foreground">
          All journeys
        </Link>
      </p>
    </main>
  );
}
