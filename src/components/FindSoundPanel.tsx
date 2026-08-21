import { useState } from "react";
import { getSession } from "@/lib/drive/session";
import { findSoundFn } from "@/lib/cloud/server-fns";
import {
  FIND_SOUND_EXAMPLES,
  findSoundsFromPrompt,
  type SoundMatch,
} from "@/lib/sound/find-sound";
import { useSettings } from "@/lib/drive/useSettings";

interface Props {
  className?: string;
  onSelect?: (profileId: string) => void;
}

/**
 * Plain-language “find me a sound” → pick → Listen.
 * Uses on-device matching first; optional cloud refine when available.
 */
export function FindSoundPanel({ className = "", onSelect }: Props) {
  const { update } = useSettings();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<SoundMatch[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const run = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setNote(null);
    try {
      let next = findSoundsFromPrompt(q, 3);
      try {
        const remote = await findSoundFn({ data: { prompt: q } });
        if (remote?.matches?.length) next = remote.matches;
      } catch {
        /* stay on local */
      }
      setMatches(next);
      setNote(
        next.length
          ? "Pick one and Listen. Motion stays on this device."
          : "No close match. Try a mood, place, or character.",
      );
    } finally {
      setBusy(false);
    }
  };

  const listen = (match: SoundMatch) => {
    update({ profileId: match.profileId });
    onSelect?.(match.profileId);
    void getSession().listenProfile(match.profileId, 70);
  };

  return (
    <section className={`border border-border p-5 sm:p-6 ${className}`}>
      <h2 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
        Find a sound
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Describe a feel. We suggest Sound Profiles you can Listen to right away.
      </p>
      <label htmlFor="find-sound-prompt" className="sr-only">
        Describe the sound you want
      </label>
      <textarea
        id="find-sound-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="e.g. joyful when I accelerate"
        className="mt-5 min-h-16 w-full border border-border bg-transparent p-3 text-sm outline-none focus:border-foreground"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {FIND_SOUND_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setPrompt(ex);
              void run(ex);
            }}
            className="rounded-full border border-border px-3 py-1.5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={busy || !prompt.trim()}
        onClick={() => void run(prompt)}
        className="mt-4 h-11 rounded-full border border-foreground bg-foreground px-6 text-[11px] tracking-[0.2em] text-background uppercase disabled:opacity-40"
      >
        {busy ? "Finding…" : "Find"}
      </button>
      {note ? <p className="mt-4 text-xs text-muted-foreground">{note}</p> : null}
      {matches.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {matches.map((m) => (
            <li
              key={m.profileId}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-light">{m.name}</p>
                <p className="mt-1 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  {m.category}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{m.reason}</p>
              </div>
              <button
                type="button"
                onClick={() => listen(m)}
                className="h-10 shrink-0 rounded-full border border-border px-4 text-[10px] tracking-[0.2em] uppercase hover:bg-secondary"
              >
                Listen
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
