import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  buildSoundShare,
  SHARE_UI_STRINGS,
  shareIntentUrls,
  shareSound,
  type ShareOutcome,
} from "@/lib/drive/sound-share";
import { cn } from "@/lib/utils";

function ShareGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("h-3.5 w-3.5", className)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** Small, quiet share control for the selected sound (idle Drive screen only). */
export function ShareSoundButton({
  profileId,
  locale = "en",
  className,
}: {
  profileId: string;
  locale?: Locale;
  className?: string;
}) {
  const ui = SHARE_UI_STRINGS[locale] ?? SHARE_UI_STRINGS.en;
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const share = buildSoundShare(profileId, locale, typeof window !== "undefined" ? window.location.origin : undefined);
  const intents = shareIntentUrls(share);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2400);
  };

  // No click analytics: the shared link's /drive?sound= visit is tracked as share_visit.
  const report = (_outcome: ShareOutcome, _channel: string) => undefined;

  const onShare = async () => {
    const outcome = await shareSound(share);
    report(outcome, "primary");
    if (outcome === "copied") flash(ui.copied);
    if (outcome === "failed") flash(ui.failed);
    if (outcome !== "shared" && outcome !== "cancelled") setOpen(true);
  };

  const onCopy = async () => {
    const outcome = await shareSound(share, undefined, { preferNative: false });
    report(outcome, "copy");
    flash(outcome === "copied" ? ui.copied : ui.failed);
  };

  const pill =
    "inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background/40 px-4 text-[10px] tracking-[0.22em] text-muted-foreground uppercase backdrop-blur hover:text-foreground";

  return (
    <div className={cn("relative flex flex-col items-center gap-2", className)} data-testid="share-sound">
      <button type="button" onClick={() => void onShare()} className={pill} aria-haspopup="dialog" aria-expanded={open}>
        <ShareGlyph />
        {ui.share}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={ui.share}
          data-testid="share-sound-panel"
          className="w-[min(22rem,90vw)] rounded-2xl border border-border bg-background/85 p-4 text-left text-sm shadow-lg backdrop-blur"
        >
          <p className="text-foreground">{share.text}</p>
          <p className="mt-2 truncate text-xs text-muted-foreground" data-testid="share-sound-url">{share.url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void onCopy()} className={pill}>{ui.copy}</button>
            <a className={pill} href={intents.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => report("shared", "whatsapp")}>WhatsApp</a>
            <a className={pill} href={intents.x} target="_blank" rel="noopener noreferrer" onClick={() => report("shared", "x")}>X</a>
            <a className={pill} href={intents.email} onClick={() => report("shared", "email")}>{ui.email}</a>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-3 text-[10px] tracking-[0.22em] text-muted-foreground uppercase hover:text-foreground">
            {ui.close}
          </button>
        </div>
      ) : null}
      {toast ? (
        <p role="status" aria-live="polite" data-testid="share-sound-toast" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-5 py-2 text-xs text-background shadow-lg">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
