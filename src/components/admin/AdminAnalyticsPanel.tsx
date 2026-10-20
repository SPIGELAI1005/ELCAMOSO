import { useCallback, useEffect, useMemo, useState } from "react";

import { deviceKinds, mergeDays, type DayAggregate } from "@/lib/analytics/events";
import { FEEDBACK_CATEGORY_LABEL } from "@/lib/feedback/feedback-core";

type Money =
  | { connected: false }
  | { connected: true; error: string }
  | {
      connected: true;
      mode: string;
      activeSubscriptions: number;
      lifetimePurchases: number;
      revenue30d: number;
      revenueAll: number;
      currency: string;
    };
type Broadcast = { id: string; at: string; title: string; body: string };
type Payload = {
  days: DayAggregate[] | null;
  money: Money;
  broadcast: Broadcast[];
  feedbackByCategory: Record<string, number>;
};

const card = "rounded-xl border border-white/10 bg-white/[0.03] p-4";

function Bars({ data, unit = "" }: { data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="text-xs opacity-50">No data yet.</p>;
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-2 text-xs">
          <span className="truncate opacity-80">{d.label}</span>
          <span className="h-2 rounded-full bg-white/5">
            <span
              className="block h-2 rounded-full bg-gradient-to-r from-amber-500 to-red-500"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right tabular-nums opacity-80">
            {d.value.toLocaleString()}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Spark({ values, labels }: { values: number[]; labels: string[] }) {
  const w = 600;
  const h = 110;
  const max = Math.max(1, ...values);
  const bw = w / Math.max(1, values.length);
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} className="w-full" role="img" aria-label="Daily active devices">
      {values.map((v, i) => {
        const bh = (v / max) * h;
        return (
          <rect key={i} x={i * bw + 2} y={h - bh} width={Math.max(1, bw - 4)} height={bh} rx={2} fill="#f59e0b" opacity={0.85}>
            <title>{`${labels[i]}: ${v}`}</title>
          </rect>
        );
      })}
      <line x1={0} x2={w} y1={h} y2={h} stroke="rgba(255,255,255,.15)" />
      <text x={0} y={h + 13} fill="rgba(255,255,255,.5)" fontSize={10}>{labels[0] ?? ""}</text>
      <text x={w} y={h + 13} fill="rgba(255,255,255,.5)" fontSize={10} textAnchor="end">{labels[labels.length - 1] ?? ""}</text>
      <text x={w} y={10} fill="rgba(255,255,255,.5)" fontSize={10} textAnchor="end">max {max}</text>
    </svg>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string | undefined }) {
  return (
    <div className={card}>
      <div className="text-[11px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] opacity-50">{hint}</div>}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-amber-400">{children}</h3>;
}

const top = (o: Record<string, number>, n = 8) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value: Math.round(value) }));

export function AdminAnalyticsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(30);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/admin/analytics?days=${range}`, { credentials: "same-origin", cache: "no-store" });
      const b = (await r.json()) as Payload & { error?: string };
      if (!r.ok) throw new Error(b.error ?? "Failed");
      setData(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [range]);
  useEffect(() => void load(), [load]);

  const s = useMemo(() => {
    const days = [...(data?.days ?? [])].sort((a, b) => a.day.localeCompare(b.day));
    const t = mergeDays(days);
    const last7 = mergeDays(days.slice(-7));
    const today = days[days.length - 1];
    return { days, t, wau: Object.keys(last7.devices).length, dau: today ? Object.keys(today.devices).length : 0 };
  }, [data]);

  async function post(payload: object) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/analytics", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(b.error ?? "Failed");
      setTitle("");
      setBody("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const { t } = s;
  const kinds = deviceKinds(t.devices);
  const avgKm = t.drives ? (t.km / t.drives).toFixed(1) : "–";
  const avgMin = t.drives ? Math.round(t.driveMs / t.drives / 60000) : 0;
  const money = data?.money;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <div className="flex gap-1 text-xs">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`rounded-full border px-3 py-1 ${range === d ? "border-amber-400 text-amber-300" : "border-white/15 opacity-70"}`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs opacity-60">
        Anonymous install IDs only, from users who turned on Usage insights. No GPS, locations or personal data.
      </p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {data && data.days === null && <p className="mt-3 text-sm text-amber-300">Analytics storage unavailable.</p>}

      <H>Usage</H>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="DAU" value={s.dau} hint="devices today (UTC)" />
        <Kpi label="WAU" value={s.wau} hint="last 7 days" />
        <Kpi label="Drives" value={t.drives} hint={`${range} days`} />
        <Kpi label="Kilometres" value={Math.round(t.km).toLocaleString()} hint={`avg ${avgKm} km · ${avgMin} min`} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className={card}>
          <div className="mb-2 text-xs opacity-60">Active devices per day</div>
          <Spark values={s.days.map((d) => Object.keys(d.devices).length)} labels={s.days.map((d) => d.day.slice(5))} />
        </div>
        <div className={card}>
          <div className="mb-2 text-xs opacity-60">Devices by type</div>
          <Bars
            data={["tesla", "phone", "tablet", "desktop", "unknown"]
              .filter((k) => kinds[k])
              .map((k) => ({ label: k, value: kinds[k] ?? 0 }))}
          />
        </div>
      </div>

      <H>Sounds</H>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={card}>
          <div className="mb-2 text-xs opacity-60">Plays per profile</div>
          <Bars data={top(t.plays)} />
        </div>
        <div className={card}>
          <div className="mb-2 text-xs opacity-60">Listen time (min)</div>
          <Bars data={top(Object.fromEntries(Object.entries(t.listenMs).map(([k, v]) => [k, v / 60000])))} unit=" m" />
        </div>
        <div className={card}>
          <div className="mb-2 text-xs opacity-60">Quick skips (&lt; 10 s)</div>
          <Bars data={top(t.quickSkips)} />
        </div>
        <div className={card}>
          <div className="mb-2 text-xs opacity-60">Shift-mode changes</div>
          <Bars data={top(t.shiftModes)} />
        </div>
      </div>

      <H>Sharing</H>
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Smiles cards shown" value={t.smilesShown} />
        <Kpi
          label="Smiles shared"
          value={t.smilesShared}
          hint={t.smilesShown ? `${Math.round((t.smilesShared / t.smilesShown) * 100)}% share rate` : undefined}
        />
        <Kpi label="Share-link visits" value={t.shareVisits} />
      </div>

      <H>Money</H>
      {!money || !money.connected ? (
        <div className={`${card} text-sm opacity-70`}>Stripe not connected (no STRIPE_SECRET_KEY on this deployment).</div>
      ) : "error" in money ? (
        <div className={`${card} text-sm text-red-400`}>Stripe error: {money.error}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Active subscriptions" value={money.activeSubscriptions} hint={`Stripe ${money.mode}`} />
          <Kpi label="Lifetime purchases" value={money.lifetimePurchases} />
          <Kpi label="Revenue 30 d" value={`${money.revenue30d.toFixed(2)} ${money.currency}`} />
          <Kpi label="Revenue all time" value={`${money.revenueAll.toFixed(2)} ${money.currency}`} />
        </div>
      )}

      <H>Health</H>
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Client errors" value={t.errors} />
        <Kpi label="Sound load failures" value={t.soundLoadFails} />
        <Kpi label="Tesla issues" value={t.teslaErrors} hint="errors on Tesla browsers" />
      </div>
      <div className={`${card} mt-3`}>
        <div className="mb-2 text-xs opacity-60">Top error messages</div>
        <Bars data={top(t.topErrors, 6)} />
      </div>
      {t.test > 0 && <p className="mt-2 text-[11px] opacity-50">{t.test} test event(s) excluded.</p>}

      <H>Feedback by category</H>
      <div className={card}>
        <Bars
          data={Object.entries(data?.feedbackByCategory ?? {}).map(([k, v]) => ({
            label: (FEEDBACK_CATEGORY_LABEL as Record<string, string>)[k] ?? k,
            value: v,
          }))}
        />
      </div>

      <H>Broadcast to Messages inbox</H>
      <div className={card}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Title, e.g. New: Smiles per Mile"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder="Message shown in every user's Messages inbox"
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center justify-between text-[11px] opacity-70">
          <span>Users pick it up within ~1 h (cached). {body.length}/600</span>
          <button
            disabled={busy || title.trim().length < 2 || body.trim().length < 2}
            onClick={() => {
              if (confirm("Send this message to every user's inbox?")) void post({ title, body });
            }}
            className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            Publish
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {[...(data?.broadcast ?? [])].reverse().map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.03] p-2 text-sm">
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-xs opacity-70">{m.body}</div>
                <div className="text-[10px] opacity-40">{new Date(m.at).toLocaleString()}</div>
              </div>
              <button
                onClick={() => {
                  if (confirm("Remove this broadcast?")) void post({ deleteId: m.id });
                }}
                className="text-xs text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-[11px] opacity-40">
        Storage: Vercel Blob (Hobby: ~2k advanced ops [put/list] and ~10k simple ops per month). Clients batch events
        (≤1 write per ~15 min per device); finished days are compacted into one file.
      </p>
    </section>
  );
}
