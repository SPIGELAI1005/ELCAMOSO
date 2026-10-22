interface PremiumBadgeProps {
  className?: string;
  label?: string;
  /** Show the thin outline lock before the label (default true). */
  lock?: boolean;
}

/** Thin-stroke outline lock (lucide-style), inherits currentColor. */
export function LockGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <rect x="4.5" y="11" width="15" height="10" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  );
}

/** Subtle Drive+ marker - never loud or gamified. */
export function PremiumBadge({ className = "", label = "Drive+", lock = true }: PremiumBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 leading-none text-[9px] tracking-[0.24em] text-muted-foreground/60 uppercase ${className}`}
      aria-label={label}
    >
      {lock ? <LockGlyph className="-mt-px" /> : null}
      <span>{label}</span>
    </span>
  );
}
