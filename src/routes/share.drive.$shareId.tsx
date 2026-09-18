import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoMetadata, driveSongSocialMeta } from "@/lib/seo";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { DriveDnaViz } from "@/components/journey/DriveDnaViz";
import {
  decodeJourneyShare,
  renderDriveSong,
  type JourneySharePayload,
  type JourneySummary,
} from "@/lib/journey";

export const Route = createFileRoute("/share/drive/$shareId")({
  component: ShareDriveSongPage,
  head: ({ params }) => {
    const social = driveSongSocialMeta({
      title: "This drive made a song.",
      description: "Created with ELCAMOSO. No route or GPS is shared.",
      sharePayload: params.shareId,
    });
    return createSeoMetadata({
      title: social.title.includes("ELCAMOSO") ? social.title : `${social.title} | ELCAMOSO`,
      description: social.description,
      path: `/share/drive/${params.shareId}`,
      image: social.image,
      imageAlt: "Drive Song created with ELCAMOSO",
      robots: "noindex, follow",
      ogTitle: social.title,
      ogDescription: social.description,
      socialCard: { variant: "drive-song" },
    });
  },
});

function ShareDriveSongPage() {
  const { shareId } = Route.useParams();
  const payload = useMemo(() => decodeJourneyShare(decodeURIComponent(shareId)), [shareId]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    const run = async () => {
      try {
        const synthetic = sharePayloadToJourney(payload);
        const blob = await renderDriveSong(synthetic, {
          title: payload.title,
          symphonyPackId: payload.symphonyPackId,
          seed: payload.seed,
          durationSec: payload.sections[payload.sections.length - 1]?.songEndSec ?? 120,
          sections: payload.sections,
          format: "audio/wav",
        });
        if (cancelled) return;
        setAudioUrl(URL.createObjectURL(blob));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not render preview.");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [payload]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  if (!payload) {
    return (
      <main className="mx-auto max-w-lg px-6 pt-20 text-center">
        <h1 className="text-3xl font-light">This share could not be read</h1>
        <p className="mt-4 text-muted-foreground">Ask for a fresh Drive Song link.</p>
        <Link to="/" className="mt-10 inline-block text-[10px] tracking-[0.22em] uppercase">
          Open ELCAMOSO
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-6 pt-12 pb-28 text-center sm:px-10">
      <p className="text-[10px] tracking-[0.34em] text-muted-foreground uppercase">ELCAMOSO</p>
      <h1 className="mt-4 text-3xl font-light tracking-tight">This drive made a song.</h1>
      <p className="mt-3 text-sm text-muted-foreground">Created with ELCAMOSO.</p>

      <ElcamosoMark intensity={0.5} waveResponse={0.75} className="mx-auto mt-10 h-10 w-auto" />
      <p className="mt-8 text-2xl font-light">{payload.title}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {payload.experienceName}
        {payload.durationMs ? ` · ${Math.max(1, Math.round(payload.durationMs / 60000))} min` : ""}
      </p>

      <button
        type="button"
        disabled={!audioUrl}
        onClick={async () => {
          if (!audioRef.current) return;
          if (playing) {
            audioRef.current.pause();
            setPlaying(false);
          } else {
            await audioRef.current.play();
            setPlaying(true);
          }
        }}
        className="mx-auto mt-10 flex h-24 w-24 items-center justify-center rounded-full border border-foreground text-[10px] tracking-[0.22em] uppercase disabled:opacity-40"
      >
        {playing ? "Pause" : "Play"}
      </button>
      {audioUrl ? <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} /> : null}
      {error ? <p className="mt-4 text-sm text-muted-foreground">{error}</p> : null}

      <div className="mt-12 text-left">
        <DriveDnaViz dna={payload.dna} />
      </div>

      <div className="mt-12 flex flex-col gap-3">
        <Link
          to="/drive"
          className="inline-flex h-14 items-center justify-center rounded-full bg-primary text-[10px] tracking-[0.22em] text-primary-foreground uppercase"
        >
          Make your own drive
        </Link>
        <Link
          to="/"
          className="inline-flex h-12 items-center justify-center text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground"
        >
          Open ELCAMOSO
        </Link>
      </div>
    </main>
  );
}

function sharePayloadToJourney(payload: JourneySharePayload): JourneySummary {
  return {
    id: "shared-preview",
    createdAt: Date.now(),
    durationMs: payload.durationMs ?? 600000,
    distanceM: null,
    profileId: payload.symphonyPackId,
    experienceKind: payload.experienceKind,
    experienceName: payload.experienceName,
    symphonyPackId: payload.symphonyPackId,
    seed: payload.seed,
    energyTimeline: payload.energyTimeline,
    semanticEvents: [],
    gearChanges: [],
    energyPeaks: [],
    cruisePeriods: [],
    regenPeriods: [],
    arrangementTimeline: [],
    dna: payload.dna,
    song: {
      title: payload.title,
      symphonyPackId: payload.symphonyPackId,
      seed: payload.seed,
      durationSec: payload.sections[payload.sections.length - 1]?.songEndSec ?? 120,
      sections: payload.sections,
      format: "audio/wav",
    },
    reel: payload.reel ?? null,
    shareId: null,
  };
}
