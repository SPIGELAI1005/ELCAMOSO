import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { notifySmilesChanged, SmileLevelRing, useSmileStatus } from "@/components/smiles/SmileRewards";
import { SmileSymbol } from "@/components/smiles/SmilesSymbols";
import { useAccount } from "@/lib/account/AccountProvider";
import { DAILY_SMILE_CAP, SMILE_LEVELS, SMILE_SHOP, type ShopItem } from "@/lib/smiles/rewards";
import {
  getSmileLeaderboardFn,
  redeemSmileItemFn,
  setSmileHandleFn,
} from "@/lib/smiles/rewards-server-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/smile-shop")({
  component: SmileShopPage,
  head: () => ({ meta: [{ title: "Smile Shop - ELCAMOSO" }] }),
});

type Board = Awaited<ReturnType<typeof getSmileLeaderboardFn>>;
const card = "rounded-3xl border border-white/10 bg-white/[0.03] p-5";

function SmileShopPage() {
  const { isAuthenticated } = useAccount();
  const status = useSmileStatus(isAuthenticated);
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<"country" | "sound">("country");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [handle, setHandle] = useState("");

  useEffect(() => {
    void getSmileLeaderboardFn().then(setBoard).catch(() => undefined);
  }, []);
  useEffect(() => setHandle(status.handle ?? ""), [status.handle]);

  async function redeem(item: ShopItem) {
    setBusy(item.id);
    setNote(null);
    try {
      const r = await redeemSmileItemFn({ data: { itemId: item.id } });
      if (r.ok) {
        notifySmilesChanged();
        setNote(`${item.name} is yours. Enjoy the grin.`);
      } else setNote(r.error);
    } catch {
      setNote("Could not redeem right now.");
    } finally {
      setBusy(null);
    }
  }

  async function saveHandle() {
    try {
      await setSmileHandleFn({ data: { handle } });
      notifySmilesChanged();
      setNote(handle ? `You are "${handle}" on the board.` : "You are anonymous on the board.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Bad name");
    }
  }

  const refLink = status.refCode ? `https://www.elcamoso.com/?ref=${status.refCode}` : null;
  const groups = tab === "country" ? (board?.byCountry ?? []) : (board?.bySound ?? []);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10">
      <header className="flex flex-col items-center text-center">
        <SmileSymbol className="h-12 w-auto text-white" />
        <h1 className="mt-3 text-3xl font-light tracking-tight">Smile Shop</h1>
        <p className="mt-1 text-sm text-muted-foreground">Drive. Grin. Spend the grins.</p>
      </header>

      <section className={cn(card, "flex flex-col items-center gap-3 sm:flex-row sm:justify-between")}>
        {isAuthenticated ? (
          <SmileLevelRing status={status} />
        ) : (
          <p className="text-sm text-muted-foreground">Sign in to collect smiles from every drive.</p>
        )}
        <div className="text-xs leading-relaxed text-muted-foreground sm:text-right">
          <div>Drive: smiles from your card</div>
          <div>Share: +25% (once a day)</div>
          <div>Bring a friend: +100</div>
          <div>7-day streak: +50</div>
          <div>Up to {DAILY_SMILE_CAP} a day · Founders 1.5x</div>
        </div>
      </section>

      <section
        data-testid="monthly-challenge"
        className="rounded-3xl border border-[#e53935]/40 bg-[radial-gradient(ellipse_at_0%_0%,rgba(229,57,53,0.22),transparent_60%)] p-5"
      >
        <div className="text-[10px] tracking-[0.28em] text-[#e53935] uppercase">Monthly challenge</div>
        <div className="mt-1 text-lg font-light">Most smiles in V10 Race mode</div>
        <div className="text-xs text-muted-foreground">Top 10 win a month of Drive+. Starts soon.</div>
      </section>

      {note ? <p className="text-center text-sm text-foreground/90">{note}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        {SMILE_SHOP.map((item) => {
          const owned = status.owned.includes(item.id);
          const short = status.balance < item.cost;
          return (
            <div key={item.id} data-testid={`shop-${item.id}`} className={cn(card, "flex flex-col")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-light">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.blurb}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                  <SmileSymbol className="h-4 w-auto text-white" />
                  {item.cost.toLocaleString("en")}
                </div>
              </div>
              <button
                type="button"
                disabled={!isAuthenticated || item.soon || owned || short || busy != null}
                onClick={() => void redeem(item)}
                className="mt-4 h-10 rounded-full border border-border text-[11px] tracking-[0.2em] uppercase transition-colors enabled:hover:border-[#e53935] disabled:opacity-45"
              >
                {item.soon ? "Coming soon" : owned ? "Yours" : busy === item.id ? "..." : short ? "Keep driving" : "Redeem"}
              </button>
            </div>
          );
        })}
      </section>

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

      {refLink ? (
        <section className={card}>
          <div className="text-lg font-light">Bring a friend, get +100</div>
          <div className="mt-1 break-all text-xs text-muted-foreground">{refLink}</div>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(refLink).then(() => setNote("Link copied."))}
            className="mt-3 h-10 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase"
          >
            Copy link
          </button>
        </section>
      ) : null}

      <section className={card}>
        <div className="text-lg font-light">Levels</div>
        <ul className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-5">
          {SMILE_LEVELS.map((l) => (
            <li key={l.name} className={cn(status.level.name === l.name && "text-[#e53935]")}>
              {l.name} <span className="text-muted-foreground tabular-nums">{l.min.toLocaleString("en")}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
