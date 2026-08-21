import { useEffect, useState } from "react";

const KEY = "elcamoso.install.dismissed";

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(KEY)) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!event) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-xs border border-border bg-background p-5">
      <p className="text-sm font-light">Install ELCAMOSO for faster Drive starts.</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="h-11 rounded-full bg-primary px-5 text-[11px] tracking-[0.2em] text-primary-foreground uppercase"
          onClick={() => {
            void event.prompt();
            setEvent(null);
          }}
        >
          Install
        </button>
        <button
          type="button"
          className="h-11 text-[11px] tracking-[0.2em] text-muted-foreground uppercase"
          onClick={() => {
            window.localStorage.setItem(KEY, "1");
            setEvent(null);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
