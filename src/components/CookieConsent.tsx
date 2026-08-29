import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  readCookieConsent,
  writeCookieConsent,
  type CookieConsentChoice,
} from "@/lib/legal/cookie-consent";

/**
 * Lightweight consent bar for EU/UK cookie / ePrivacy expectations.
 * Choice is stored in localStorage (no third-party cookie required).
 */
export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [choice, setChoice] = useState<CookieConsentChoice | null>(null);

  useEffect(() => {
    const sync = () => setChoice(readCookieConsent());
    sync();
    setMounted(true);
    window.addEventListener("elcamoso:cookie-consent", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("elcamoso:cookie-consent", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!mounted || choice !== null) return null;

  const accept = (next: CookieConsentChoice) => {
    writeCookieConsent(next);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-5"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Cookies</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We use essential storage so ELCAMOSO can save your settings on this device. Optional
            Usage insights stay off until you enable them in Settings. See our{" "}
            <Link
              to="/legal/cookies"
              className="text-foreground underline-offset-2 hover:underline"
            >
              Cookie notice
            </Link>{" "}
            and{" "}
            <Link
              to="/legal/privacy"
              className="text-foreground underline-offset-2 hover:underline"
            >
              Privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => accept("essential")}
            className="h-10 rounded-full border border-border px-4 text-[10px] tracking-[0.18em] uppercase hover:bg-secondary"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => accept("all")}
            className="h-10 rounded-full border border-foreground bg-foreground px-4 text-[10px] tracking-[0.18em] text-background uppercase"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
