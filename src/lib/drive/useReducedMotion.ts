import { useEffect, useState } from "react";
import { useSettings } from "@/lib/drive/useSettings";

/**
 * True when the user asked for calmer motion — either in ELCAMOSO settings or
 * through the operating system's reduce-motion preference.
 */
export function useReducedMotion() {
  const { settings } = useSettings();
  const [systemPref, setSystemPref] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemPref(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemPref(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return settings.reducedMotion || systemPref;
}
