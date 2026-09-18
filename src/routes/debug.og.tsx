import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  SOCIAL_CARD_TEMPLATES,
  buildOgApiUrl,
  type OgCardVariant,
  normalizeOgCardData,
} from "@/lib/og";

/** First-batch six-card family + DNA/pricing extras */
const PRESETS: {
  id: string;
  label: string;
  variant: OgCardVariant;
  title?: string;
  subtitle?: string;
  experience?: string;
  archetype?: string;
  seed?: string;
  energySamples?: number[];
}[] = [
  { id: "brand", label: "Brand", variant: "brand" },
  { id: "engine", label: "Engine", variant: "engine", experience: "GT V8" },
  {
    id: "symphony",
    label: "Symphony",
    variant: "symphony",
    experience: "CINEMATIC ROCK",
  },
  { id: "world", label: "Worlds", variant: "world", experience: "SPACE DRIVE" },
  {
    id: "fusion",
    label: "Fusion",
    variant: "fusion",
    experience: "GT V8 × CINEMATIC ROCK",
  },
  {
    id: "drive-song",
    label: "Drive Song",
    variant: "drive-song",
    title: "THIS DRIVE\nMADE A SONG.",
    subtitle: "NIGHT MOTION",
    experience: "Cinematic Rock",
    archetype: "Progressive Cruiser",
    seed: "night-motion-demo",
    energySamples: [
      0.22, 0.28, 0.35, 0.48, 0.62, 0.55, 0.7, 0.82, 0.75, 0.88, 0.7, 0.58, 0.45, 0.38, 0.5, 0.66,
      0.72, 0.6, 0.42, 0.3,
    ],
  },
  {
    id: "journey",
    label: "Drive DNA",
    variant: "journey",
    title: "PROGRESSIVE CRUISER",
    subtitle: "Night Motion",
    archetype: "Progressive Cruiser",
    seed: "dna-demo",
  },
  { id: "pricing", label: "Pricing", variant: "pricing" },
];

export const Route = createFileRoute("/debug/og")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  component: OgDebugPage,
  head: () => ({
    meta: [{ title: "OG Cards · Debug · ELCAMOSO" }],
  }),
});

function OgDebugPage() {
  const [active, setActive] = useState(PRESETS[0]!.id);
  const preset = PRESETS.find((p) => p.id === active) || PRESETS[0]!;
  const data = useMemo(
    () =>
      normalizeOgCardData({
        variant: preset.variant,
        ...(preset.title ? { title: preset.title } : {}),
        ...(preset.subtitle ? { subtitle: preset.subtitle } : {}),
        ...(preset.experience ? { experienceName: preset.experience } : {}),
        ...(preset.archetype ? { archetype: preset.archetype } : {}),
        ...(preset.seed ? { imageSeed: preset.seed } : {}),
        ...(preset.energySamples ? { energySamples: preset.energySamples } : {}),
        ...(preset.variant === "journey"
          ? { driveDna: { energy: 82, flow: 74, rhythm: 69, variation: 61, regen: 88 } }
          : {}),
      }),
    [preset],
  );

  const ogUrl = useMemo(() => {
    return buildOgApiUrl(data.variant, {
      title: data.title.replace(/\n/g, "\\n"),
      subtitle: data.subtitle,
      experience: data.experienceName,
      archetype: data.archetype,
      seed: data.imageSeed,
    });
  }, [data]);

  const previewSrc = useMemo(() => {
    const u = new URL("/api/og", "http://local");
    u.searchParams.set("v", data.variant);
    if (data.title) u.searchParams.set("title", data.title);
    if (data.subtitle) u.searchParams.set("subtitle", data.subtitle);
    if (data.experienceName) u.searchParams.set("experience", data.experienceName);
    if (data.archetype) u.searchParams.set("archetype", data.archetype);
    if (data.imageSeed) u.searchParams.set("seed", data.imageSeed);
    if (data.driveDna) {
      u.searchParams.set(
        "dna",
        [
          data.driveDna.energy,
          data.driveDna.flow,
          data.driveDna.rhythm,
          data.driveDna.variation,
          data.driveDna.regen,
        ].join(","),
      );
    }
    if (data.energySamples?.length) {
      u.searchParams.set("energy", data.energySamples.map((n) => n.toFixed(3)).join(","));
    }
    return `${u.pathname}${u.search}`;
  }, [data]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 text-foreground">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Debug</p>
          <h1 className="mt-2 text-3xl font-light tracking-tight">Social cards</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Six-card family + Motion Signature. Dev only.
          </p>
        </div>
        <Link to="/debug" className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Back
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            className={
              active === p.id
                ? "border border-foreground/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]"
                : "border border-foreground/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-10 overflow-hidden border border-foreground/10 bg-black">
        <img
          src={previewSrc}
          alt={SOCIAL_CARD_TEMPLATES[data.variant].alt(data)}
          width={1200}
          height={630}
          className="h-auto w-full"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-[11px] tracking-wide">
        <a
          href={previewSrc}
          target="_blank"
          rel="noreferrer"
          className="uppercase tracking-[0.2em] underline-offset-4 hover:underline"
        >
          Open image
        </a>
        <button
          type="button"
          className="uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          onClick={() => void navigator.clipboard.writeText(ogUrl)}
        >
          Copy production OG URL
        </button>
      </div>

      <p className="mt-8 break-all font-mono text-[11px] text-muted-foreground">{ogUrl}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Fallback: {SOCIAL_CARD_TEMPLATES[data.variant].fallbackPath}
        {data.variant === "drive-song" ? " · Motion Signature from energy samples" : ""}
      </p>
    </main>
  );
}
