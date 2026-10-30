import { useEffect, useState } from "react";
import {
  genreHeroImageSrc,
  profileHeroImageAlt,
  profileHeroImageSrc,
} from "@/lib/sound/profile-hero-image";
import { getGenreChoice, subscribeGenreChoice, type GenreChoice } from "@/lib/symphony/adaptive/genre-store";
import { cn } from "@/lib/utils";

interface DriveProfileBackdropProps {
  profileId: string | null | undefined;
  className?: string;
}

/**
 * Full-bleed sound-matched still behind drive chrome - same framing as the landing hero.
 */
export function DriveProfileBackdrop({ profileId, className }: DriveProfileBackdropProps) {
  const [choice, setChoice] = useState<GenreChoice>("auto");
  useEffect(() => {
    setChoice(getGenreChoice());
    return subscribeGenreChoice(setChoice);
  }, []);
  // Drive the Music profiles show the car of the genre picked on /symphony.
  const genreSrc =
    profileId?.startsWith("symphony-") && choice !== "auto" ? genreHeroImageSrc(choice) : null;
  const src = genreSrc ?? profileHeroImageSrc(profileId);
  if (!src || !profileId) return null;

  const alt = profileHeroImageAlt(profileId);

  return (
    <div
      className={cn(
        // Fixed full-viewport framing matches the landing hero stills.
        "pointer-events-none fixed inset-0 overflow-hidden bg-background",
        className,
      )}
      aria-hidden="true"
    >
      <img
        key={src}
        src={src}
        alt={alt}
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full object-center transition-opacity duration-700 ease-in-out",
          "object-contain px-2 sm:px-4 md:px-8 lg:px-10",
          "xl:object-cover xl:px-0",
          "opacity-100",
        )}
      />
      {/* Dim + vignette so instruments and CTAs stay readable (matches hero). */}
      <div className="absolute inset-0 bg-background/45 md:bg-background/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/20 to-background/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_8%,oklch(0_0_0_/_40%)_68%,oklch(0_0_0_/_78%)_100%)]" />
    </div>
  );
}
