interface PremiumBadgeProps {
  className?: string;
  label?: string;
}

/** Subtle Drive+ marker — never loud or gamified. */
export function PremiumBadge({ className = "", label = "Drive+" }: PremiumBadgeProps) {
  return (
    <span
      className={`inline-block text-[9px] tracking-[0.24em] text-muted-foreground/60 uppercase ${className}`}
      aria-label={label}
    >
      {label}
    </span>
  );
}
