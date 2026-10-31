import { useEffect, useRef } from "react";
import { carFxFor, floorHeading, groundYAt, floorScrollPxPerSecond, floorStreakOpacity, sampleDriveFxSpeed, headlightsOn, wheelBlur, wheelMatrix, wheelTurnsPerSecond, WHEEL_SPIN_SIGN, type CarFxConfig } from "@/lib/drive/car-fx";
import { profileHeroImageSrc } from "@/lib/sound/profile-hero-image";
import { cn } from "@/lib/utils";

interface DriveCarFxProps {
  profileId: string;
  /** metres per second */
  speed: number;
  engineRunning: boolean;
  reducedMotion: boolean;
  className?: string;
}

const GHOSTS = [-1, 1];

/** Floor area: everything below the tyre contact line (extended across the image), in perspective. */
function floorPolygon(cfg: CarFxConfig): string {
  const { w, h } = cfg.image;
  const y0 = Math.min(h, groundYAt(cfg, 0) - 18);
  const y1 = Math.min(h, groundYAt(cfg, w) - 18);
  return `0,${y0.toFixed(1)} ${w},${y1.toFixed(1)} ${w},${h} 0,${h}`;
}

function CarFxSvg({ cfg, src, aspect, uid, lit, still }: { cfg: CarFxConfig; src: string; aspect: string; uid: string; lit: boolean; still: boolean }) {
  return (
    <svg viewBox={`0 0 ${cfg.image.w} ${cfg.image.h}`} preserveAspectRatio={aspect} className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id={`hl-${uid}`}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#eef4ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#dfe9ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`beam-${uid}`}>
          <stop offset="0%" stopColor="#f3f7ff" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#dfe9ff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#dfe9ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`disc-${uid}`}>
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="55%" stopColor="#111" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.2" />
        </radialGradient>
        <pattern id={`fl-${uid}`} className="carfx-floor-pat" width="900" height="300" patternUnits="userSpaceOnUse">
          <rect x="20" y="22" width="300" height="3" rx="1.5" fill="#d6deff" opacity="0.75" />
          <rect x="430" y="58" width="140" height="2" rx="1" fill="#ffffff" opacity="0.55" />
          <rect x="650" y="96" width="230" height="4" rx="2" fill="#c4d0ff" opacity="0.5" />
          <rect x="90" y="131" width="90" height="2" rx="1" fill="#ffffff" opacity="0.6" />
          <rect x="260" y="168" width="380" height="5" rx="2.5" fill="#b9c6ff" opacity="0.4" />
          <rect x="720" y="205" width="70" height="2" rx="1" fill="#ffffff" opacity="0.65" />
          <rect x="35" y="243" width="200" height="3" rx="1.5" fill="#dfe6ff" opacity="0.55" />
          <rect x="520" y="276" width="260" height="3" rx="1.5" fill="#ffffff" opacity="0.45" />
        </pattern>
        <linearGradient id={`flm-g-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1={cfg.floorTop} x2="0" y2={cfg.image.h}>
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="35%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.6" />
        </linearGradient>
        <mask id={`flm-${uid}`}>
          <polygon points={floorPolygon(cfg)} fill={`url(#flm-g-${uid})`} />
        </mask>
        <filter id={`flb-${uid}`} x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="6 1.2" /></filter>
        {cfg.wheels.map((w, i) => (
          <clipPath id={`wc-${uid}-${i}`} key={i}>
            <ellipse cx={w.cx} cy={w.cy} rx={w.rx} ry={w.ry} />
          </clipPath>
        ))}
      </defs>
      {!still && (
        <g className="carfx-floor" opacity={0} mask={`url(#flm-${uid})`} style={{ mixBlendMode: "screen" }}>
          <rect x="0" y={Math.min(cfg.floorTop, groundYAt(cfg, 0), groundYAt(cfg, cfg.image.w)) - 40} width={cfg.image.w} height={cfg.image.h} fill={`url(#fl-${uid})`} filter={`url(#flb-${uid})`} />
        </g>
      )}
      {!still &&
        cfg.wheels.map((w, i) => (
          <g key={i} clipPath={`url(#wc-${uid}-${i})`} className="carfx-wheel" data-wheel={i}>
            <image href={src} width={cfg.image.w} height={cfg.image.h} className="carfx-main" />
            {GHOSTS.map((g) => (
              <image key={g} href={src} width={cfg.image.w} height={cfg.image.h} className="carfx-ghost" data-k={g} opacity={0} />
            ))}
            <ellipse cx={w.cx} cy={w.cy} rx={w.rx} ry={w.ry} fill={`url(#disc-${uid})`} className="carfx-disc" opacity={0} />
          </g>
        ))}
      <g style={{ opacity: lit ? 1 : 0, transition: "opacity 700ms ease-in-out", mixBlendMode: "screen" }} className="carfx-lights">
        {cfg.beam ? <ellipse
          cx={cfg.beam.cx}
          cy={cfg.beam.cy}
          rx={cfg.beam.rx}
          ry={cfg.beam.ry}
          transform={`rotate(${cfg.beam.angle} ${cfg.beam.cx} ${cfg.beam.cy})`}
          fill={`url(#beam-${uid})`}
        /> : null}
        {cfg.headlights.map((h, i) => (
          <g key={i}>
            <ellipse cx={h.cx} cy={h.cy} rx={h.rx * 3.2} ry={h.ry * 3.2} fill={`url(#hl-${uid})`} opacity={0.35} />
            <ellipse cx={h.cx} cy={h.cy} rx={h.rx * 1.2} ry={h.ry * 1.2} fill={`url(#hl-${uid})`} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * Headlight glow + floor light pool when driving, and wheel-spin overlay scaled with speed.
 * Same framing as DriveProfileBackdrop. Under reduced motion the wheels stay still and the
 * lights switch without a fade.
 */
export function DriveCarFx({ profileId, speed, engineRunning, reducedMotion, className }: DriveCarFxProps) {
  const cfg = carFxFor(profileId);
  const src = profileHeroImageSrc(profileId);
  const rootRef = useRef<HTMLDivElement>(null);
  const kmhRef = useRef(speed * 3.6);
  kmhRef.current = speed * 3.6;

  useEffect(() => {
    if (!cfg || reducedMotion || typeof requestAnimationFrame === "undefined") return;
    let raf = 0;
    let last = 0;
    let angle = 0;
    let floorX = 0;
    const heading = floorHeading(cfg).deg;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const kmh = sampleDriveFxSpeed(now, kmhRef.current);
      floorX = (floorX + floorScrollPxPerSecond(kmh) * dt) % 900;
      // Streaks lie along the tyre contact line and scroll front -> rear (the car's real heading).
      rootRef.current?.querySelectorAll<SVGElement>(".carfx-floor-pat").forEach((p) => p.setAttribute("patternTransform", `rotate(${heading.toFixed(2)}) translate(${floorX.toFixed(1)} 0)`));
      rootRef.current?.querySelectorAll<SVGElement>(".carfx-floor").forEach((f) => f.setAttribute("opacity", String(floorStreakOpacity(kmh))));
      angle = (angle + WHEEL_SPIN_SIGN * wheelTurnsPerSecond(kmh) * 2 * Math.PI * dt) % (2 * Math.PI);
      const blur = wheelBlur(kmh);
      rootRef.current?.querySelectorAll<SVGGElement>(".carfx-wheel").forEach((g) => {
        const w = cfg.wheels[Number(g.dataset["wheel"])]!;
        g.querySelector(".carfx-main")?.setAttribute("transform", wheelMatrix(w, angle));
        g.querySelectorAll<SVGImageElement>(".carfx-ghost").forEach((im) => {
          const k = Number(im.dataset["k"]);
          im.setAttribute("transform", wheelMatrix(w, angle + k * 0.22 * blur));
          im.setAttribute("opacity", String(0.45 * blur));
        });
        g.querySelector(".carfx-disc")?.setAttribute("opacity", String(0.8 * blur));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cfg, reducedMotion]);

  if (!cfg || !src) return null;
  const lit = headlightsOn(engineRunning, speed * 3.6);
  return (
    <div ref={rootRef} className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)} aria-hidden="true" data-testid="drive-car-fx" data-lit={lit}>
      <div className="absolute inset-0 px-2 sm:px-4 md:px-8 lg:px-10 xl:hidden">
        <div className="relative h-full w-full">
          <CarFxSvg cfg={cfg} src={src} aspect="xMidYMid meet" uid="m" lit={lit} still={reducedMotion} />
        </div>
      </div>
      <div className="absolute inset-0 hidden xl:block">
        <CarFxSvg cfg={cfg} src={src} aspect="xMidYMid slice" uid="s" lit={lit} still={reducedMotion} />
      </div>
    </div>
  );
}
