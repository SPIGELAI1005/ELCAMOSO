import { useCallback, useEffect, useState } from "react";

import { FEEDBACK_CATEGORY_LABEL, type FeedbackRecord } from "@/lib/feedback/feedback-core";

type Item = FeedbackRecord & { blobUrl: string };

export function AdminFeedbackPanel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "issue" | "suggestion" | "other">("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/feedback", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const b = (await r.json()) as { items?: Item[]; total?: number; error?: string };
      if (!r.ok) throw new Error(b.error ?? "Failed");
      setItems(b.items ?? []);
      setTotal(b.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function remove(it: Item) {
    if (!confirm("Delete this message?")) return;
    await fetch(`/api/admin/feedback?blob=${encodeURIComponent(it.blobUrl)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    void load();
  }

  const shown = (items ?? []).filter((i) => filter === "all" || i.category === filter);
  return (
    <section className="mt-8" data-testid="admin-feedback">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">User feedback ({total})</h2>
        {(["all", "issue", "suggestion", "other"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${filter === f ? "border-white bg-white text-black" : "border-white/20 opacity-70"}`}
          >
            {f}
          </button>
        ))}
        <button onClick={() => void load()} className="ml-auto text-xs underline opacity-70">
          Refresh
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {items === null && !error ? <p className="mt-2 text-sm opacity-70">Loading…</p> : null}
      {items && shown.length === 0 ? (
        <p className="mt-2 text-sm opacity-70">No messages yet.</p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {shown.map((it) => (
          <li key={it.blobUrl} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs opacity-70">
              <span className="rounded-full border border-white/20 px-2 py-0.5 uppercase">
                {FEEDBACK_CATEGORY_LABEL[it.category]}
              </span>
              {it.status === "test" ? <span className="text-amber-300">TEST</span> : null}
              <span>{new Date(it.at).toLocaleString()}</span>
              {it.context.soundProfileName ? <span>· {it.context.soundProfileName}</span> : null}
              {it.context.device ? <span>· {it.context.device}</span> : null}
              {it.context.screen ? <span>· {it.context.screen}</span> : null}
              <span className="font-mono">· user {it.clientId.slice(0, 8)}</span>
              <button onClick={() => void remove(it)} className="ml-auto underline">
                Delete
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{it.message}</p>
            {it.contact ? <p className="mt-1 text-xs opacity-70">Contact: {it.contact}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
