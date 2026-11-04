import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { DriveChart } from "@/components/drive/DriveChart";
import { getJourneyRepository, type JourneyTraceV1 } from "@/lib/journey-trace";
import {
  buildDriveChart,
  createDriveSongWithAudio,
  deleteJourney as deleteJourneySummary,
  saveJourney,
  summariseJourneyFromJourneyTrace,
  type JourneySummary,
} from "@/lib/journey";
import { downloadBlob } from "@/lib/sound/render";
import {
  getSilentCaptureGenre,
  listSilentCaptureGenres,
  setSilentCaptureGenre,
} from "@/lib/drive/silent-capture-genre";

type Phase = "loading" | "empty" | "rendering" | "ready" | "error";

async function loadTraceWithRetry(id: string): Promise<JourneyTraceV1 | null> {
  const repo = getJourneyRepository();
  for (let i = 0; i < 12; i++) {
    const t = await repo.loadJourney(id);
    if (t && t.samples.length > 0 && t.status !== "recording") return t;
    if (t && i >= 6 && t.samples.length > 0) return t;
    await new Promise((r) => setTimeout(r, 250));
  }
  return repo.loadJourney(id);
}

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
  const genres = useMemo(() => listSilentCaptureGenres(), []);
  const [trace, setTrace] = useState<JourneyTraceV1 | null>(null);
  const [packId, setPackId] = useState<string>(() => getSilentCaptureGenre());
  const [renderedPackId, setRenderedPackId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [journey, setJourney] = useState<JourneySummary | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runId = useRef(0);

  const createSong = async (t: JourneyTraceV1, pack: string) => {
    const id = ++runId.current;
    audioRef.current?.pause();
    setPlaying(false);
    setPhase("rendering");
    setError(null);
    try {
      const summary = summariseJourneyFromJourneyTrace(t);
      await saveJourney(summary);
      const result = await createDriveSongWithAudio(t.journeyId, { symphonyPackId: pack, trace: t });
      if (id !== runId.current) return;
      if (!result) throw new Error("Journey not found.");
      setJourney(result.journey);
      setRenderedPackId(pack);
      if (!result.audio) {
        setError(result.renderError ?? "The song could not be created.");
        setPhase("error");
        return;
      }
      setAudio(result.audio);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(result.audio!);
      });
      setPhase("ready");
    } catch (e) {
      if (id !== runId.current) return;
      setError(e instanceof Error ? e.message : "The song could not be created.");
      setPhase("error");
    }
  };

  useEffect(() => {
    let cancelled = false;
    void loadTraceWithRetry(journeyTraceId).then((t) => {
      if (cancelled) return;
      setTrace(t);
      if (!t || t.samples.length < 2) {
        setPhase("empty");
        return;
      }
      void createSong(t, getSilentCaptureGenre());
    });
    return () => {
      cancelled = true;
      runId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyTraceId]);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  const chart = useMemo(
    () => (trace && trace.samples.length ? buildDriveChart(trace, journey?.song) : null),
    [trace, journey?.song],
  );

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    // play() runs directly inside the tap → allowed by autoplay rules
    el.play()
      .then(() => setPlaying(true))
      .catch(() => setError("Playback was blocked. Tap Play again."));
  };

  const mins = trace ? Math.max(1, Math.round(trace.durationMs / 60000)) : 0;
  const km = trace ? trace.summary.distanceM / 1000 : 0;
  const genreName = (id: string | null) => genres.find((g) => g.id === id)?.name ?? "";
  const songTitle = journey?.song?.title ?? "Drive Song";

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black px-6 py-12"
      data-testid="post-silent-capture"
    >
      <div className="mx-auto w-full max-w-md text-center">
        <ElcamosoMark intensity={0.45} waveResponse={0.6} className="mx-auto h-9 w-auto" />
        <h1 className="mt-8 text-3xl font-light tracking-tight">YOUR DRIVE IS READY.</h1>
        {trace ? (
          <p className="mt-3 text-muted-foreground">
            {mins} min
            {km > 0.05 ? ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} km` : ""}
            {trace.summary.maxSpeedKmh > 0
              ? ` · top ${Math.round(trace.summary.maxSpeedKmh)} km/h`
              : ""}
          </p>
        ) : null}
        {capturePausedByBrowser || trace?.summary.browserPaused || (trace?.gaps.length ?? 0) > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Part of this drive was not recorded (the screen or browser was paused). The song
            bridges those parts.
          </p>
        ) : null}
        {trace?.status === "incomplete" ? (
          <p className="mt-2 text-sm text-muted-foreground">Recording ended unexpectedly.</p>
        ) : null}

        {phase === "empty" ? (
          <p className="mt-10 text-sm text-muted-foreground">
            No motion was recorded on this drive, so there is no song to create.
          </p>
        ) : (
          <div className="mt-8 border border-foreground/15 px-4 py-5">
            <label className="block text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
              Genre
              <select
                className="mt-2 block w-full border border-foreground/20 bg-black px-3 py-3 text-sm tracking-normal text-foreground normal-case"
                value={packId}
                onChange={(e) => {
                  setPackId(e.target.value);
                  setSilentCaptureGenre(e.target.value);
                }}
                disabled={phase === "rendering" || phase === "loading"}
                data-testid="silent-genre-select"
              >
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            {phase === "loading" || phase === "rendering" ? (
              <div className="mt-5" data-testid="song-rendering">
                <div className="h-1 w-full overflow-hidden bg-foreground/10">
                  <div className="h-full w-1/3 animate-pulse bg-foreground/60" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {phase === "loading"
                    ? "Loading your drive…"
                    : `Creating your ${genreName(packId)} song from the drive…`}
                </p>
              </div>
            ) : null}

            {phase === "error" ? (
              <p className="mt-4 text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}

            {phase === "ready" ? (
              <div className="mt-5">
                <p className="text-lg font-light" data-testid="song-title">
                  {songTitle}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {genreName(renderedPackId)} · {Math.round(journey?.song?.durationSec ?? 0)} s
                </p>
                {audioUrl ? (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    preload="auto"
                    onEnded={() => setPlaying(false)}
                    onPause={() => setPlaying(false)}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="mt-4 inline-flex h-14 w-full items-center justify-center rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase"
                  data-testid="silent-play"
                >
                  {playing ? "Pause" : "▶ Play song"}
                </button>
                <button
                  type="button"
                  onClick={() => audio && downloadBlob(audio, `${songTitle}.wav`)}
                  className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full border border-foreground/25 text-[10px] tracking-[0.22em] uppercase"
                >
                  Download
                </button>
              </div>
            ) : null}

            {trace &&
            (phase === "ready" || phase === "error") &&
            packId !== renderedPackId ? (
              <button
                type="button"
                onClick={() => void createSong(trace, packId)}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-foreground/40 text-[10px] tracking-[0.22em] uppercase"
              >
                Create in {genreName(packId)}
              </button>
            ) : null}
            {trace && phase === "error" && packId === renderedPackId ? (
              <button
                type="button"
                onClick={() => void createSong(trace, packId)}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-foreground/40 text-[10px] tracking-[0.22em] uppercase"
              >
                Try again
              </button>
            ) : null}
          </div>
        )}

        {chart ? (
          <div className="mt-6 border border-foreground/10 px-4 py-5" data-testid="drive-chart">
            <p className="mb-3 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              How your drive shaped the song
            </p>
            <DriveChart chart={chart} />
          </div>
        ) : null}

        <Link
          to="/journeys/$journeyId"
          params={{ journeyId: journeyTraceId }}
          className="mt-6 inline-block text-[10px] tracking-[0.22em] text-muted-foreground uppercase underline-offset-4 hover:underline"
        >
          Open in Journeys
        </Link>

        <div className="mt-6 flex justify-center gap-6">
          <button
            type="button"
            onClick={() => {
              audioRef.current?.pause();
              onDismiss();
            }}
            className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            Save & close
          </button>
          <button
            type="button"
            onClick={() => {
              audioRef.current?.pause();
              void getJourneyRepository().deleteJourney(journeyTraceId);
              void deleteJourneySummary(journeyTraceId);
              onDelete?.();
              onDismiss();
            }}
            className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
