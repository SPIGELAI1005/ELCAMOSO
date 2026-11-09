"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useSettings } from "@/lib/drive/useSettings";
import { FOUNDER_FOREVER_PICK_LIMIT, isLegacyFounderClaim } from "@/lib/founders/founders";
import {
  confirmFounderSoundPicksFn,
  getFounderSoundPicksFn,
  saveFounderSoundPicksFn,
} from "@/lib/founders/server-fns";
import {
  founderPickCounter,
  listFounderPickOptions,
  type FounderPickOption,
} from "@/lib/founders/sound-picks";

export function FounderForeverPicker({ founderSince }: { founderSince: number }) {
  const { settings } = useSettings();
  const qc = useQueryClient();
  const legacy = isLegacyFounderClaim(founderSince);
  const options = useMemo(() => listFounderPickOptions(), []);
  const picksQuery = useQuery({
    queryKey: ["founder-sound-picks"],
    queryFn: () => getFounderSoundPicksFn(),
    enabled: !legacy,
    staleTime: 15_000,
    retry: false,
  });
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (picksQuery.data?.soundIds) setDraft(picksQuery.data.soundIds);
  }, [picksQuery.data?.soundIds]);

  if (legacy) {
    return (
      <p className="mt-3 text-sm text-muted-foreground" data-testid="founder-legacy-sounds">
        You keep Racing V10, American Muscle V8 and GT V8 forever.
      </p>
    );
  }

  const confirmed = Boolean(picksQuery.data?.confirmed);
  const vacant = picksQuery.data?.vacant ?? 0;
  const locked = confirmed && vacant === 0;
  const counter = founderPickCounter(draft, Date.now(), settings.language);
  const q = filter.trim().toLowerCase();
  const shown = options.filter(
    (o) =>
      !q ||
      o.name.toLowerCase().includes(q) ||
      o.id.includes(q) ||
      o.category.toLowerCase().includes(q),
  );
  const drivePlus = shown.filter((o) => o.library === "drive_plus");
  const music = shown.filter((o) => o.library === "drive_music");

  const toggle = (id: string) => {
    if (locked) return;
    setDraft((prev) => {
      if (prev.includes(id)) {
        if (confirmed && vacant === 0) return prev;
        const pick = picksQuery.data?.picks.find((p) => p.soundId === id);
        if (pick?.confirmedAt && vacant === 0) return prev;
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= FOUNDER_FOREVER_PICK_LIMIT) return prev;
      return [...prev, id];
    });
  };

  const save = async (confirm: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await saveFounderSoundPicksFn({ data: { soundIds: draft } });
      if (confirm) await confirmFounderSoundPicksFn({ data: {} });
      void qc.invalidateQueries({ queryKey: ["founder-sound-picks"] });
      void qc.invalidateQueries({ queryKey: ["entitlements"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border/50 pt-3" data-testid="founder-forever-picker">
      <p className="text-sm font-medium">4 sounds forever</p>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="founder-pick-counter">
        {counter.label}
        {locked
          ? " · confirmed"
          : vacant > 0
            ? " · pick a replacement for a sound that changed"
            : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose any Drive+ or Drive the Music sounds. Sounds that are free for everyone cannot be
        picked. Confirm to lock your selection.
      </p>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Find a sound"
        className="mt-2 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm"
        disabled={locked}
      />
      <div className="mt-2 max-h-64 space-y-3 overflow-y-auto text-sm">
        <PickGroup
          title="Drive+"
          options={drivePlus}
          draft={draft}
          locked={locked}
          onToggle={toggle}
        />
        <PickGroup
          title="Drive the Music"
          options={music}
          draft={draft}
          locked={locked}
          onToggle={toggle}
        />
      </div>
      {!locked ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-xs"
            disabled={busy}
            onClick={() => void save(false)}
          >
            Save draft
          </button>
          <button
            type="button"
            className="rounded-full bg-foreground px-3 py-1 text-xs text-background"
            disabled={busy || counter.selected !== FOUNDER_FOREVER_PICK_LIMIT}
            onClick={() => void save(true)}
            data-testid="founder-picks-confirm"
          >
            Confirm 4 sounds
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function PickGroup({
  title,
  options,
  draft,
  locked,
  onToggle,
}: {
  title: string;
  options: FounderPickOption[];
  draft: string[];
  locked: boolean;
  onToggle: (id: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div>
      <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{title}</p>
      <ul className="mt-1 space-y-1">
        {options.map((o) => {
          const on = draft.includes(o.id);
          return (
            <li key={o.id}>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked || (!on && draft.length >= FOUNDER_FOREVER_PICK_LIMIT)}
                  onChange={() => onToggle(o.id)}
                />
                <span>{o.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
