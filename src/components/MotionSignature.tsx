import { memo } from "react";
import { cn } from "@/lib/utils";
import { generateMotionSignature, type MotionSignatureInput } from "@/lib/motion-signature";

interface MotionSignatureProps extends MotionSignatureInput {
  className?: string;
  accent?: string;
  foreground?: string;
  /** Accessible label when not decorative */
  label?: string;
}

/**
 * Brand Motion Signature - reusable SVG fingerprint for Journey / Drive Song / Garage / OG.
 */
export const MotionSignature = memo(function MotionSignature({
  className,
  accent = "currentColor",
  foreground = "currentColor",
  label,
  ...input
}: MotionSignatureProps) {
  const geo = generateMotionSignature({
    ...input,
    width: input.width ?? 420,
    height: input.height ?? 320,
  });

  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      fill="none"
      className={cn("overflow-visible", className)}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {geo.guides.map((g, i) => (
        <path
          key={`g-${i}`}
          d={g.d}
          stroke={foreground}
          strokeWidth={g.strokeWidth}
          strokeOpacity={g.opacity}
        />
      ))}
      {geo.ribbons.map((r, i) => (
        <path
          key={`r-${i}`}
          d={r.d}
          stroke={r.accentWeight > 0.3 ? accent : foreground}
          strokeWidth={r.strokeWidth}
          strokeOpacity={r.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
});
