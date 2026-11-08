"use client";

import { useEffect, useState } from "react";

import { profileHeroImageAlt, profileHeroImageSrc } from "@/lib/sound/profile-hero-image";
import { cn } from "@/lib/utils";

/** Music-sound stills for the Symphony hero (same no-branding assets as the landing hero). */
export const SYMPHONY_HERO_IDS = [
  "symphony-motion-orchestra",
  "symphony-piano-flow",
  "symphony-neon-run",
  "symphony-jazz-cruise",
  "symphony-latino-fiesta",
  "symphony-cinematic-rock",
] as const;

const SLIDE_MS = 7000;

function heroSlides(profileIds: readonly string[]) {
  const seen = new Set<string>();
  return profileIds
    .map((id) => ({ id, src: profileHeroImageSrc(id), alt: profileHeroImageAlt(id) }))
    .filter((slide): slide is { id: string; src: string; alt: string } => {
      if (!slide.src || seen.has(slide.src)) return false;
      seen.add(slide.src);
      return true;
    });
}

/**
 * Lightweight backdrop: one interval timer + CSS opacity transition.
 * No per-frame JS animation; static under reduced motion.
 * Pass `profileIds` to fade a different set of car stills. Defaults to the Symphony cars.
 */
export function SymphonyHeroBackdrop({
  className,
  profileIds = SYMPHONY_HERO_IDS,
}: {
  className?: string;
  profileIds?: readonly string[];
}) {
  const slides = heroSlides(profileIds);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
      aria-hidden="true"
    >
      {slides.map((slide, i) => {
        const near = i === index || i === (index + 1) % slides.length || i === 0;
        return near ? (
          <img
            key={slide.id}
            src={slide.src}
            alt=""
            decoding="async"
            loading={i === 0 ? "eager" : "lazy"}
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-[2000ms] ease-in-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null;
      })}
      <div className="absolute inset-0 bg-background/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/25 to-background" />
    </div>
  );
}
