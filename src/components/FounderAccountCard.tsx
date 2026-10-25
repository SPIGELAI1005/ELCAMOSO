import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { FounderBadge } from "@/components/FoundersBanner";
import { useOptionalFounder } from "@/lib/entitlements/EntitlementsProvider";
import { FOUNDER_PERKS } from "@/lib/founders/founders";
import { setTestCrewOptInFn } from "@/lib/founders/server-fns";

const fmt = (ms: number) =>
  new Date(ms).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });

/** Account page: Founder status, perks and the Test Crew opt-in. Renders nothing for non-Founders. */
export function FounderAccountCard() {
  const founder = useOptionalFounder();
  const qc = useQueryClient();
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOptIn(Boolean(founder?.testCrewOptIn)), [founder?.testCrewOptIn]);
  if (!founder) return null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await setTestCrewOptInFn({ data: { optIn: !optIn } });
      setOptIn(res.testCrewOptIn);
      void qc.invalidateQueries({ queryKey: ["entitlements"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#e53935]/40 bg-card/40 p-4" data-testid="founder-card">
      <div className="flex items-center gap-3">
        <p className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase">Founders Pack</p>
        <FounderBadge seat={founder.seat} />
      </div>
      <p className="mt-3 text-sm">
        You're a Founder. Drive+ is free until {fmt(founder.drivePlusUntil)}
        {founder.drivePlusActive ? "." : " (ended)."}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {FOUNDER_PERKS.map((p) => (
          <li key={p}>
            <span className="text-[#e53935]">—</span> {p}
          </li>
        ))}
      </ul>
      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 border-t border-border/50 pt-3">
        <span className="text-sm">
          Test Crew: get new features first
          <span className="block text-xs text-muted-foreground">Opt in to beta builds and quick feedback asks.</span>
        </span>
        <input type="checkbox" className="h-4 w-4 accent-[#e53935]" checked={optIn} disabled={busy} onChange={toggle} />
      </label>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
