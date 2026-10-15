"use client";

import { useEffect, useRef, useState } from "react";

import {
  HERO_MARK_RADIATE_DELAY_MS,
  HERO_WAVE_HANDOFF_MS,
  MARK_IDLE_RADIATE_CYCLE_MS,
  MARK_WAVE_IN_DURATION_MS,
  type HeroWavePhase,
} from "@/components/ElcamosoLogo";
import { cn } from "@/lib/utils";

/** Curated hero stills: engines, worlds, and character experiences. */
export const HERO_SOUND_IMAGES = [
  "/hero/sound-profiles/muscle-v8.png",
  "/hero/sound-profiles/dragon.png",
  "/hero/sound-profiles/gt-v8.png",
  "/hero/sound-profiles/stallion.png",
  "/hero/sound-profiles/flat-six.png",
  "/hero/sound-profiles/carriage.png",
  "/hero/sound-profiles/cyber-pulse.png",
  "/hero/sound-profiles/stagecoach.png",
  "/hero/sound-profiles/racing-v10.png",
  "/hero/sound-profiles/tank.png",
  "/hero/sound-profiles/cyber-city.png",
  "/hero/sound-profiles/submarine.png",
  "/hero/sound-profiles/thunder-beast.png",
  "/hero/sound-profiles/flying-saucer.png",
  "/hero/sound-profiles/zen-drive.png",
  "/hero/sound-profiles/turbine-jet.png",
  "/hero/sound-profiles/space-ship.png",
  "/hero/sound-profiles/steam-train.png",
  "/hero/sound-profiles/superbike.png",
  "/hero/sound-profiles/maglev.png",
  "/hero/sound-profiles/heartbeat.png",
  "/hero/sound-profiles/open-wind.png",
  "/hero/sound-profiles/santa-sleigh.png",
  "/hero/sound-profiles/interstellar.png",
  "/hero/sound-profiles/kazoo-kart.png",
  "/hero/sound-profiles/micro-hatch.png",
  "/hero/sound-profiles/big-twin.png",
] as const;

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
 * Soft fade-out / fade-in only - no zoom, blur, or bloom.
 * Uses contain on phone/tablet so vehicles are not cropped at the sides.
 */

function heroAltFromSrc(src: string): string {
  const id = src.split("/").pop()?.replace(/\.png$/i, "") ?? "sound";
  const label = id.replace(/-/g, " ");
  return `ELCAMOSO ${label} sound experience`;
}

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
    img.src = next;
  }, [index]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background",
        className,
      )}
      aria-hidden="true"
    >
      {HERO_SOUND_IMAGES.map((src, i) => {
        const isActive = i === index;
        const isOutgoing = i === prevIndex;
        const show = visible && (isActive || isOutgoing);

        return (
          <img
            key={src}
            src={src}
            alt={heroAltFromSrc(src)}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "low"}
            className={cn(
              // Contain on phone/tablet so cars stay fully framed; soft cover only on wide desktops.
              "hero-sound-frame absolute inset-0 h-full w-full object-center",
              "object-contain px-2 sm:px-4 md:px-8 lg:px-10",
              "xl:object-cover xl:px-0",
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
      <div className="absolute inset-0 z-[4] bg-background/45 md:bg-background/40" />
      <div className="absolute inset-0 z-[4] bg-gradient-to-b from-background/70 via-background/20 to-background/90" />
      <div className="absolute inset-0 z-[4] bg-[radial-gradient(ellipse_at_center,transparent_8%,oklch(0_0_0_/_40%)_68%,oklch(0_0_0_/_78%)_100%)]" />
    </div>
  );
}
