import { useCallback, useEffect, useState } from "react";

import { SOUND_PROFILES } from "@/lib/sound/profiles";

type UserRow = { id: string; email: string | null; role: string; createdAt: string };
type Grant = {
  id: string;
  kind: string;
  profileId: string | null;
  entitlement: string | null;
  expiresAt: string | null;
  active: boolean;
  source: string | null;
};
type Detail = {
  user: UserRow;
  grants: Grant[];
  subscriptions: { plan: string; status: string; currentPeriodEnd: string | null }[];
  devices: { installId: string; linkedAt: string }[];
  promos: string[];
};
type Promo = {
  code: string;
  profileIds: string[];
  drivePlusDays: number | null;
  grantDays: number | null;
  maxRedemptions: number | null;
  redemptions: number;
  expiresAt: string | null;
  active: boolean;
  note: string | null;
};

const card = "rounded-xl border border-white/10 bg-white/[0.03] p-4";
const input = "rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm";
const btn = "rounded-full border border-white/20 px-3 py-1.5 text-xs hover:border-amber-400 disabled:opacity-40";
const nameOf = (id: string) => SOUND_PROFILES.find((p) => p.id === id)?.name ?? id;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "permanent");

async function api(body?: object, qs = "") {
  const r = await fetch(`/api/admin/users${qs}`, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const b = (await r.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!r.ok) throw new Error(b.error ?? "Failed");
  return b;
}

export function AdminUsersPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [list, setList] = useState<UserRow[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(SOUND_PROFILES[0]?.id ?? "");
  const [soundDays, setSoundDays] = useState("");
  const [dpDays, setDpDays] = useState("30");
  const [promo, setPromo] = useState({ code: "", profileIds: [] as string[], drivePlusDays: "", grantDays: "", maxRedemptions: "", expiresInDays: "", note: "" });

  const search = useCallback(async (term: string) => {
    setError(null);
    try {
      const b = await api(undefined, `?q=${encodeURIComponent(term)}`);
      setConfigured(b["configured"] !== false);
      setList((b["users"] as UserRow[]) ?? []);
      setPromos((b["promos"] as Promo[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);
  useEffect(() => void search(""), [search]);

  const open = useCallback(async (id: string) => {
    setError(null);
    try {
      setDetail(((await api(undefined, `?id=${id}`))["detail"] as Detail) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  async function act(body: object, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await api(body);
      if (detail) await open(detail.user.id);
      await search(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const soundGrants = detail?.grants.filter((g) => g.profileId) ?? [];
  const dpGrant = detail?.grants.find((g) => g.kind.endsWith("_entitlement") && g.entitlement);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Users &amp; sounds</h2>
      <p className="mt-1 text-xs opacity-60">
        Search accounts, grant or remove sounds, give Drive+ with an expiry and manage promo codes. Every change is
        written to the audit log.
      </p>
      {configured === false && (
        <p className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
          Database not connected (DATABASE_URL missing) – accounts admin unavailable.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.4fr]">
        <div className={card}>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void search(q);
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email or user id" className={`${input} flex-1`} />
            <button className={btn}>Search</button>
          </form>
          <ul className="mt-3 max-h-80 space-y-1 overflow-auto text-sm">
            {list.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => void open(u.id)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/5 ${detail?.user.id === u.id ? "bg-white/10" : ""}`}
                >
                  <div className="truncate">{u.email ?? "(no email)"}</div>
                  <div className="text-[10px] opacity-50">
                    {u.role} · joined {fmt(u.createdAt)}
                  </div>
                </button>
              </li>
            ))}
            {!list.length && <li className="text-xs opacity-50">No users found.</li>}
          </ul>
        </div>

        <div className={card}>
          {!detail ? (
            <p className="text-sm opacity-60">Select a user.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium">{detail.user.email}</div>
                <div className="font-mono text-[10px] opacity-50">{detail.user.id}</div>
                <div className="mt-1 text-xs opacity-70">
                  Plan:{" "}
                  {detail.subscriptions.length
                    ? detail.subscriptions.map((s) => `${s.plan} (${s.status})`).join(", ")
                    : "Free"}
                  {dpGrant && ` · Drive+ grant until ${fmt(dpGrant.expiresAt)}${dpGrant.active ? "" : " (expired)"}`}
                </div>
                <div className="text-[11px] opacity-50">
                  Devices: {detail.devices.map((d) => d.installId).join(", ") || "none linked"}
                  {detail.promos.length ? ` · Promos: ${detail.promos.join(", ")}` : ""}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs uppercase tracking-wider text-amber-400">Sounds</div>
                <ul className="space-y-1">
                  {soundGrants.map((g) => (
                    <li key={g.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1">
                      <span>
                        {nameOf(g.profileId!)}{" "}
                        <span className="text-[10px] opacity-50">
                          {g.kind.replace("_profile", "")} · {fmt(g.expiresAt)}
                          {g.active ? "" : " · expired"}
                        </span>
                      </span>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act(
                            { action: "remove_sound", userId: detail.user.id, profileId: g.profileId },
                            `Remove ${nameOf(g.profileId!)} from ${detail.user.email}?`,
                          )
                        }
                        className="text-xs text-red-400"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                  {!soundGrants.length && <li className="text-xs opacity-50">No per-user sounds (plan sounds still apply).</li>}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select value={sound} onChange={(e) => setSound(e.target.value)} className={`${input} flex-1`}>
                    {SOUND_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input value={soundDays} onChange={(e) => setSoundDays(e.target.value)} placeholder="days (blank = forever)" className={`${input} w-40`} />
                  <button
                    disabled={busy}
                    className={btn}
                    onClick={() => void act({ action: "grant_sound", userId: detail.user.id, profileId: sound, days: soundDays || null })}
                  >
                    Grant sound
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs uppercase tracking-wider text-amber-400">Drive+</div>
                <div className="flex flex-wrap gap-2">
                  <input value={dpDays} onChange={(e) => setDpDays(e.target.value)} className={`${input} w-24`} />
                  <button
                    disabled={busy}
                    className={btn}
                    onClick={() => void act({ action: "grant_drive_plus", userId: detail.user.id, days: Number(dpDays) })}
                  >
                    Grant Drive+ for {dpDays || "?"} days
                  </button>
                  <button
                    disabled={busy || !dpGrant}
                    className={`${btn} text-red-400`}
                    onClick={() => void act({ action: "revoke_drive_plus", userId: detail.user.id }, "Revoke granted Drive+? (Stripe subscriptions are unaffected)")}
                  >
                    Revoke grant
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`${card} mt-3`}>
        <div className="mb-2 text-xs uppercase tracking-wider text-amber-400">Promo codes</div>
        <div className="grid gap-2 md:grid-cols-3">
          <input value={promo.code} onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase() })} placeholder="CODE" className={input} />
          <input value={promo.drivePlusDays} onChange={(e) => setPromo({ ...promo, drivePlusDays: e.target.value })} placeholder="Drive+ days (optional)" className={input} />
          <input value={promo.grantDays} onChange={(e) => setPromo({ ...promo, grantDays: e.target.value })} placeholder="Sound days (blank = forever)" className={input} />
          <input value={promo.maxRedemptions} onChange={(e) => setPromo({ ...promo, maxRedemptions: e.target.value })} placeholder="Max redemptions" className={input} />
          <input value={promo.expiresInDays} onChange={(e) => setPromo({ ...promo, expiresInDays: e.target.value })} placeholder="Code expires in days" className={input} />
          <input value={promo.note} onChange={(e) => setPromo({ ...promo, note: e.target.value })} placeholder="Note" className={input} />
        </div>
        <select
          multiple
          value={promo.profileIds}
          onChange={(e) => setPromo({ ...promo, profileIds: [...e.target.selectedOptions].map((o) => o.value) })}
          className={`${input} mt-2 h-24 w-full`}
        >
          {SOUND_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="mt-2 flex justify-end">
          <button
            disabled={busy || promo.code.length < 3}
            className={btn}
            onClick={() =>
              void act({
                action: "upsert_promo",
                code: promo.code,
                profileIds: promo.profileIds,
                drivePlusDays: Number(promo.drivePlusDays) || null,
                grantDays: Number(promo.grantDays) || null,
                maxRedemptions: Number(promo.maxRedemptions) || null,
                expiresInDays: Number(promo.expiresInDays) || null,
                note: promo.note,
              })
            }
          >
            Save code
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {promos.map((p) => (
            <li key={p.code} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1">
              <span>
                <span className="font-mono">{p.code}</span>{" "}
                <span className="text-[11px] opacity-60">
                  {[
                    p.profileIds.length ? `${p.profileIds.map(nameOf).join(", ")}` : null,
                    p.drivePlusDays ? `Drive+ ${p.drivePlusDays} d` : null,
                    `${p.redemptions}${p.maxRedemptions ? `/${p.maxRedemptions}` : ""} used`,
                    p.expiresAt ? `until ${fmt(p.expiresAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <button
                disabled={busy}
                onClick={() => void act({ action: "set_promo_active", code: p.code, active: !p.active })}
                className={`text-xs ${p.active ? "text-red-400" : "text-emerald-400"}`}
              >
                {p.active ? "Disable" : "Enable"}
              </button>
            </li>
          ))}
          {!promos.length && <li className="text-xs opacity-50">No codes yet.</li>}
        </ul>
      </div>
    </section>
  );
}
