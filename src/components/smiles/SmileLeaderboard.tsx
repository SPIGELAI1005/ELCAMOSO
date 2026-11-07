import { useEffect, useRef, useState } from "react";

import { notifySmilesChanged, useSmileStatus } from "@/components/smiles/SmileRewards";
import { useAccount } from "@/lib/account/AccountProvider";
import { getSmileLeaderboardFn, setSmileHandleFn } from "@/lib/smiles/rewards-server-fns";
import { HANDLE_RE } from "@/lib/smiles/rewards";
import { cn } from "@/lib/utils";

type Board = Awaited<ReturnType<typeof getSmileLeaderboardFn>>;
const card = "rounded-3xl border border-white/10 bg-white/[0.03] p-5";

/** Live weekly leaderboard (shared by /smile-shop and /crew). */
export function SmileLeaderboard({ onNote }: { onNote?: ((note: string) => void) | undefined }) {
  const { isAuthenticated } = useAccount();
  const status = useSmileStatus(isAuthenticated);
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<"country" | "sound">("country");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const draft = useRef(false);
  const setNote = (n: string) => onNote?.(n);
  useEffect(() => {
    let live = true;
    void getSmileLeaderboardFn()
      .then((next) => live && setBoard(next))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isAuthenticated, status.handle]);
  useEffect(() => {
    if (!draft.current) setHandle(status.handle ?? "");
  }, [status.handle]);
  const groups = tab === "country" ? (board?.byCountry ?? []) : (board?.bySound ?? []);
  const listed = groups.some((g) => g.rows.some((r) => r.me));

  async function saveHandle() {
    const next = handle.trim();
    if (next && !HANDLE_RE.test(next)) {
      const invalid = "Use 3-20 letters, numbers, . _ or -.";
      setMessage(invalid);
      setNote(invalid);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = await setSmileHandleFn({ data: { handle: next } });
      if (!saved.ok) {
        const failed = "Could not save that name. Sign in and try again.";
        setMessage(failed);
        setNote(failed);
        return;
      }
      draft.current = false;
      setHandle(next);
      notifySmilesChanged();
      const fresh = await getSmileLeaderboardFn();
      setBoard(fresh);
      const onBoard = (tab === "country" ? fresh.byCountry : fresh.bySound).some((g) =>
        g.rows.some((r) => r.me),
      );
      const savedNote = next
        ? onBoard
          ? `Saved. The board shows you as ${next}.`
          : `Saved as ${next}. A drive this week adds you to the board.`
        : "Saved. The board will use an anonymous name.";
      setMessage(savedNote);
      setNote(savedNote);
    } catch (e) {
      const failed = e instanceof Error ? e.message : "Could not save that name.";
      setMessage(failed);
      setNote(failed);
    } finally {
      setSaving(false);
    }
  }

  return (
      <section className={card} data-testid="smile-leaderboard">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-light">Weekly leaderboard</div>
            <div className="text-xs text-muted-foreground">Resets every Monday{board ? ` · week of ${board.weekOf}` : ""}</div>
          </div>
          <div className="flex rounded-full border border-border p-0.5 text-[11px] uppercase tracking-[0.15em]">
            {(["country", "sound"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn("rounded-full px-3 py-1", tab === k ? "bg-white text-black" : "text-muted-foreground")}
              >
                {k === "country" ? "Country" : "Sound"}
              </button>
            ))}
          </div>
        </div>
        {groups.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Empty podium. Your next drive could top it.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="mb-1 text-[11px] tracking-[0.2em] text-[#e53935] uppercase">{g.key}</div>
                <ol className="space-y-1 text-sm">
                  {g.rows.map((r, i) => (
                    <li key={`${g.key}-${i}`} className={cn("flex justify-between", r.me && "text-[#e53935]")}>
                      <span className="truncate">
                        {i + 1}. {r.name}
                      </span>
                      <span className="tabular-nums">{r.smiles}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
        {isAuthenticated ? (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void saveHandle();
            }}
          >
            <div className="flex gap-2">
              <input
                value={handle}
                onChange={(e) => {
                  draft.current = true;
                  setHandle(e.target.value);
                }}
                placeholder="Board name (empty = anonymous)"
                maxLength={20}
                aria-label="Board name"
                className="h-10 min-w-0 flex-1 rounded-full border border-border bg-transparent px-4 text-sm"
              />
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-full border border-border px-4 text-[11px] tracking-[0.2em] uppercase disabled:opacity-50"
              >
                {saving ? "Saving" : "Save"}
              </button>
            </div>
            {message ? (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                {message}
              </p>
            ) : status.handle && !listed ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Saved as {status.handle}. A drive this week adds you to the board.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Names stay on your account. The list is smiles earned since Monday.
              </p>
            )}
          </form>
        ) : null}
      </section>
  );
}
