import { useEffect, useState } from "react";

import { notifySmilesChanged, useSmileStatus } from "@/components/smiles/SmileRewards";
import { useAccount } from "@/lib/account/AccountProvider";
import { getSmileLeaderboardFn, setSmileHandleFn } from "@/lib/smiles/rewards-server-fns";
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
  const setNote = (n: string) => onNote?.(n);
  useEffect(() => {
    void getSmileLeaderboardFn().then(setBoard).catch(() => undefined);
  }, []);
  useEffect(() => setHandle(status.handle ?? ""), [status.handle]);
  const groups = tab === "country" ? (board?.byCountry ?? []) : (board?.bySound ?? []);

  async function saveHandle() {
    try {
      await setSmileHandleFn({ data: { handle } });
      notifySmilesChanged();
      setNote(handle ? `You are "${handle}" on the board.` : "You are anonymous on the board.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Bad name");
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
          <div className="mt-5 flex gap-2">
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Board name (empty = anonymous)"
              maxLength={20}
              className="h-10 min-w-0 flex-1 rounded-full border border-border bg-transparent px-4 text-sm"
            />
            <button type="button" onClick={() => void saveHandle()} className="h-10 rounded-full border border-border px-4 text-[11px] tracking-[0.2em] uppercase">
              Save
            </button>
          </div>
        ) : null}
      </section>
  );
}
