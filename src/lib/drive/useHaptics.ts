import { useEffect, useRef } from "react";

interface Options {
  enabled: boolean;
  active: boolean;
  throttle: number;
  regen: number;
}

export function hapticsSupported() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Optional vibration feedback that follows throttle and regen intensity.
 * Purely secondary confirmation: it never changes what the drive screen shows.
 */
export function useHaptics({ enabled, active, throttle, regen }: Options) {
  const ref = useRef({ throttle, regen });
  ref.current = { throttle, regen };

  useEffect(() => {
    if (!enabled || !active || !hapticsSupported()) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      const t = Math.min(1, Math.max(0, ref.current.throttle));
      const r = Math.min(1, Math.max(0, ref.current.regen));
      const intensity = Math.max(t, r);
      if (intensity > 0.12) {
        // throttle: single pulse that grows. regen: a softer double pulse.
        const length = Math.round(8 + intensity * 26);
        try {
          navigator.vibrate(
            r > t ? [Math.round(length * 0.6), 40, Math.round(length * 0.6)] : length,
          );
        } catch {
          /* vibration blocked by the platform */
        }
      }
      // faster pulses at higher intensity, calm at cruise
      timer = setTimeout(tick, 480 - intensity * 260);
    };

    tick();
    return () => {
      if (timer) clearTimeout(timer);
      try {
        navigator.vibrate(0);
      } catch {
        /* nothing to cancel */
      }
    };
  }, [enabled, active]);
}
