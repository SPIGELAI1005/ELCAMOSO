import { useEffect, useState } from "react";
import type { ExperienceKind } from "@/lib/experiences";
import { cn } from "@/lib/utils";

export const MODE_DEMO_SRC: Partial<Record<ExperienceKind, string>> = {
  engine: "/demos/feel-a-machine.m4a",
  symphony: "/demos/drive-the-music.m4a",
  world: "/demos/enter-another-world.m4a",
  fusion: "/demos/blend-machine-and-music.m4a",
};

// One shared <audio> element so only one demo plays at a time.
let shared: HTMLAudioElement | null = null;
let currentSrc: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function getAudio(): HTMLAudioElement {
  if (!shared) {
    shared = new Audio();
    shared.preload = "none";
    shared.setAttribute("playsinline", "");
    for (const ev of ["play", "pause", "ended", "waiting", "playing", "error"]) {
      shared.addEventListener(ev, notify);
    }
  }
  return shared;
}

type State = "idle" | "loading" | "playing";

function stateFor(src: string): State {
  if (!shared || currentSrc !== src) return "idle";
  if (shared.paused || shared.ended) return "idle";
  return shared.readyState < 3 ? "loading" : "playing";
}

export function ModeDemoButton({ src, className }: { src: string; className?: string }) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    const l = () => setState(stateFor(src));
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [src]);

  const toggle = () => {
    const a = getAudio();
    if (currentSrc === src && !a.paused) {
      a.pause();
      return;
    }
    if (currentSrc !== src) {
      a.pause();
      a.src = src;
      currentSrc = src;
    }
    notify();
    void a.play().catch(() => notify());
  };

  const label = state === "playing" ? "Pause demo" : state === "loading" ? "Loading…" : "Play demo";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state !== "idle"}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-2 border border-border/70 bg-background/40 px-3 py-2 text-[10px] tracking-[0.24em] text-muted-foreground uppercase transition-colors hover:border-foreground/40 hover:text-foreground",
        state !== "idle" && "border-foreground/50 text-foreground",
        className,
      )}
    >
      <span aria-hidden className="inline-block w-3 text-center">
        {state === "playing" ? "❚❚" : "▶"}
      </span>
      {label}
    </button>
  );
}
