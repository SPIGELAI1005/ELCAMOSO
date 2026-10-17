"use client";

import { useEffect, useRef, useState } from "react";

import {
  HERO_MARK_RADIATE_DELAY_MS,
  HERO_WAVE_HANDOFF_MS,
  MARK_IDLE_RADIATE_CYCLE_MS,
  MARK_WAVE_IN_DURATION_MS,
  type HeroWavePhase,
} from "@/components/ElcamosoLogo";
import {
  HERO_SOUND_SLIDESHOW_IDS,
  profileHeroImageAlt,
  profileHeroImageSrc,
} from "@/lib/sound/profile-hero-image";
import { cn } from "@/lib/utils";

/** Curated hero stills linked to sound profile ids (no-branding assets). */
export const HERO_SOUND_IMAGES = HERO_SOUND_SLIDESHOW_IDS.map((id) => ({
  id,
  src: profileHeroImageSrc(id)!,
  alt: profileHeroImageAlt(id),
}));

/** Calm overlapping opacity crossfade. */
const CROSSFADE_MS = 2400;
/** Hold each still before the next fade. */
const SLIDE_MS = Math.round(MARK_IDLE_RADIATE_CYCLE_MS * 3.2);

interface HeroSoundBackdropProps {
  phase: HeroWavePhase;
  reducedMotion: boolean;
  className?: string;
}

/**
 * Full-bleed sound-profile stills behind the landing hero.
 * Soft fade-out / fade-in only. On small phones the subject is biased upward
 * so it reads behind the logo/tagline and clears the Start Drive button.
 */
export function HeroSoundBackdrop({ phase, reducedMotion, className }: HeroSoundBackdropProps) {
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(reducedMotion);
  const indexRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const revealAt =
      MARK_WAVE_IN_DURATION_MS + HERO_WAVE_HANDOFF_MS + HERO_MARK_RADIATE_DELAY_MS * 0.35;
    const t = window.setTimeout(() => setVisible(true), revealAt);
    return () => window.clearTimeout(t);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || HERO_SOUND_IMAGES.length < 2) return;
    if (phase !== "radiate") return;

    let clearTimer = 0;
    const id = window.setInterval(() => {
      const current = indexRef.current;
      const next = (current + 1) % HERO_SOUND_IMAGES.length;
      indexRef.current = next;
      setPrevIndex(current);
      setIndex(next);
      clearTimer = window.setTimeout(() => setPrevIndex(null), CROSSFADE_MS);
    }, SLIDE_MS);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(clearTimer);
    };
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (typeof window === "undefined" || HERO_SOUND_IMAGES.length < 2) return;
    const next = HERO_SOUND_IMAGES[(index + 1) % HERO_SOUND_IMAGES.length];
    if (!next) return;
    const img = new Image();
    img.src = next.src;
  }, [index]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background",
        className,
      )}
      aria-hidden="true"
    >
      {HERO_SOUND_IMAGES.map((slide, i) => {
        const isActive = i === index;
        const isOutgoing = i === prevIndex;
        const show = visible && (isActive || isOutgoing);

        return (
          <img
            key={slide.id}
            src={slide.src}
            alt={slide.alt}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "low"}
            className={cn(
              "hero-sound-frame absolute inset-0 h-full w-full",
              // Phone: keep subject above the CTA band. Tablet+: centered contain. Wide: cover.
              "object-contain object-[center_32%] px-2",
              "sm:object-center sm:px-4 md:px-8 lg:px-10",
              "xl:object-cover xl:object-center xl:px-0",
              "transition-opacity ease-in-out",
              show && isActive ? "opacity-100" : "opacity-0",
            )}
            style={{
              transitionDuration: `${CROSSFADE_MS}ms`,
              zIndex: isActive ? 2 : isOutgoing ? 1 : 0,
            }}
          />
        );
      })}

      {/* Dim + vignette so logo, tagline, and CTAs stay readable. */}
      <div className="absolute inset-0 z-[4] bg-background/40 sm:bg-background/45 md:bg-background/40" />
      <div className="absolute inset-0 z-[4] bg-gradient-to-b from-background/75 via-background/20 to-background/90 sm:from-background/70" />
      {/* Phone: stronger fade over the Start Drive band so vehicle detail does not collide with the CTA. */}
      <div className="absolute inset-x-0 bottom-0 z-[4] h-[38%] bg-gradient-to-t from-background via-background/85 to-transparent sm:hidden" />
      <div className="absolute inset-0 z-[4] bg-[radial-gradient(ellipse_at_center,transparent_8%,oklch(0_0_0_/_40%)_68%,oklch(0_0_0_/_78%)_100%)]" />
    </div>
  );
}
