import type { EffortZoneId } from "@/lib/rumoso/types";

export const RUMOSO_ASSET = {
  lockup: "/rumoso/logo/rumoso-lockup-white.svg",
  mark: "/rumoso/logo/rumoso-mark-white.svg",
  heroMobile: "/rumoso/hero/rumoso-hero-mobile.webp",
  og: "/rumoso/hero/rumoso-og-1200x630.jpg",
} as const;

export type RumosoUiIconName =
  | "cadence"
  | "coach-voice"
  | "diagnostics"
  | "distance"
  | "effort-gauge"
  | "map-route"
  | "music-profile"
  | "pace"
  | "pause"
  | "run-start"
  | "stop";

/** UI glyph that follows `currentColor` via a CSS mask (external SVGs use currentColor). */
export function RumosoIcon({
  name,
  className = "size-4",
  label,
}: {
  name: RumosoUiIconName;
  className?: string;
  /** When set, exposed to assistive tech; otherwise decorative. */
  label?: string;
}) {
  const src = `/rumoso/ui/${name}.svg`;
  const decorative = !label;
  return (
    <span
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        maskImage: `url("${src}")`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        WebkitMaskImage: `url("${src}")`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
      }}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={label}
    />
  );
}

export function ZoneFigure({
  zone,
  className = "size-4",
}: {
  zone: EffortZoneId;
  className?: string;
}) {
  return (
    <img
      src={`/rumoso/ui/zone-${zone}.svg`}
      alt=""
      width={24}
      height={24}
      className={`inline-block shrink-0 ${className}`}
      aria-hidden
    />
  );
}

export function RumosoLockup({ className }: { className?: string }) {
  return (
    <img
      src={RUMOSO_ASSET.lockup}
      alt="RUMOSO by ELCAMOSO"
      width={165}
      height={32}
      className={className ?? "h-8 w-auto"}
    />
  );
}
