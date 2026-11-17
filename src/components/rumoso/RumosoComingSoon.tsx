import { Link } from "@tanstack/react-router";
import { RumosoTaglineLockup } from "./RumosoIcon";

/**
 * Public holding page for /rumoso (and /run). No sign-in, no map, sensors or audio.
 * Admins never see this; they get the full app via requireAdmin.
 */
export function RumosoComingSoon() {
  return (
    <main
      className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#050506] text-white"
      data-testid="rumoso-coming-soon"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(closest-side_at_50%_42%,rgba(255,255,255,0.075),rgba(255,255,255,0.02)_55%,transparent)]" />
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 400 400"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <defs>
            <linearGradient id="rumoso-soon-route" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#5eead4" stopOpacity="0" />
              <stop offset="0.18" stopColor="#5eead4" />
              <stop offset="0.55" stopColor="#fbbf24" />
              <stop offset="0.85" stopColor="#e53935" />
              <stop offset="1" stopColor="#e53935" stopOpacity="0" />
            </linearGradient>
            <filter id="rumoso-soon-soft" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <g stroke="url(#rumoso-soon-route)" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M-10 318 C 40 314, 70 300, 104 304 S 160 330, 204 316 S 262 286, 300 292 S 360 300, 410 286"
              strokeWidth="9"
              opacity="0.16"
              filter="url(#rumoso-soon-soft)"
            />
            <path
              d="M-10 318 C 40 314, 70 300, 104 304 S 160 330, 204 316 S 262 286, 300 292 S 360 300, 410 286"
              strokeWidth="2"
              opacity="0.5"
            />
          </g>
        </svg>
      </div>

      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <h1 className="m-0">
          <RumosoTaglineLockup className="mx-auto h-[min(11rem,30vh)] w-auto" />
        </h1>
        <p className="mt-8 text-sm tracking-[0.02em] text-white/70 sm:text-base">
          Run the music — coming soon
        </p>
        <Link
          to="/"
          hash="experiences"
          className="mt-10 inline-flex h-11 items-center rounded-full border border-white/15 px-5 text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-white/40 hover:text-white"
        >
          Back to experiences
        </Link>
      </div>
    </main>
  );
}
