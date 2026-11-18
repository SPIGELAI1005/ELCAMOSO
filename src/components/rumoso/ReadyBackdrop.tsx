import { RumosoTaglineLockup } from "./RumosoIcon";

/**
 * Pre-run stage behind the RUMOSO lockup: near-black, one soft glow and a single
 * faint effort-coloured route line. It fully covers the map (labels included) so the
 * logo's arcs are the only arcs on screen. The map keeps loading underneath and
 * appears as soon as the run starts.
 */
export function ReadyBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-[#050506]"
      data-testid="rumoso-ready-backdrop"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(closest-side_at_50%_46%,rgba(255,255,255,0.075),rgba(255,255,255,0.02)_55%,transparent)]" />
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="rumoso-ready-route" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5eead4" stopOpacity="0" />
            <stop offset="0.18" stopColor="#5eead4" />
            <stop offset="0.55" stopColor="#fbbf24" />
            <stop offset="0.85" stopColor="#e53935" />
            <stop offset="1" stopColor="#e53935" stopOpacity="0" />
          </linearGradient>
          <filter id="rumoso-ready-soft" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <g stroke="url(#rumoso-ready-route)" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M-10 318 C 40 314, 70 300, 104 304 S 160 330, 204 316 S 262 286, 300 292 S 360 300, 410 286"
            strokeWidth="9"
            opacity="0.16"
            filter="url(#rumoso-ready-soft)"
          />
          <path
            d="M-10 318 C 40 314, 70 300, 104 304 S 160 330, 204 316 S 262 286, 300 292 S 360 300, 410 286"
            strokeWidth="2"
            opacity="0.5"
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pb-6">
        <RumosoTaglineLockup className="h-[min(11rem,30vh)] w-auto" />
      </div>
    </div>
  );
}
