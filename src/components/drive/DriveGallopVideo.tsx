import { useEffect, useRef, useState } from "react";
import { GALLOP_VIDEO, gallopPlaybackRate, sampleDriveFxSpeed } from "@/lib/drive/car-fx";
import { profileHeroImageSrc } from "@/lib/sound/profile-hero-image";
import { cn } from "@/lib/utils";

interface DriveGallopVideoProps {
  profileId: string;
  /** metres per second */
  speed: number;
  reducedMotion: boolean;
  className?: string;
}

/**
 * Looping motion clip over the profile still (same framing as DriveProfileBackdrop). Paused on its
 * first frame at 0 km/h; playbackRate follows the shared drive-fx speed. Hidden (still shows) under
 * reduced motion or if the clip fails to load.
 */
export function DriveGallopVideo({ profileId, speed, reducedMotion, className }: DriveGallopVideoProps) {
  const src = GALLOP_VIDEO[profileId];
  const poster = profileHeroImageSrc(profileId) ?? undefined;
  const ref = useRef<HTMLVideoElement>(null);
  const kmhRef = useRef(speed * 3.6);
  kmhRef.current = speed * 3.6;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!src || reducedMotion || failed || typeof requestAnimationFrame === "undefined") return;
    let raf = 0;
    const tick = (now: number) => {
      const v = ref.current;
      if (v) {
        const rate = gallopPlaybackRate(sampleDriveFxSpeed(now, kmhRef.current));
        if (rate === 0) {
          if (!v.paused) v.pause();
        } else {
          if (Math.abs(v.playbackRate - rate) > 0.02) v.playbackRate = rate;
          if (v.paused) void v.play().catch(() => undefined);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [src, reducedMotion, failed]);

  if (!src || reducedMotion || failed) return null;
  return (
    <div className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)} aria-hidden="true" data-testid="drive-gallop-video">
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        onLoadedData={() => setReady(true)}
        onError={() => setFailed(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-center transition-opacity duration-500",
          "object-contain px-2 sm:px-4 md:px-8 lg:px-10",
          "xl:object-cover xl:px-0",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
      {/* same dim + vignette as the backdrop so chrome stays readable */}
      <div className="absolute inset-0 bg-background/45 md:bg-background/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/20 to-background/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_8%,oklch(0_0_0_/_40%)_68%,oklch(0_0_0_/_78%)_100%)]" />
    </div>
  );
}
