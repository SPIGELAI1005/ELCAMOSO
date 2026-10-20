import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/** Redeem a promo code (signed-in only). Grants show up in the sound picker after refresh. */
export function PromoCodeForm() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function redeem() {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/account/promo", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const b = (await r.json().catch(() => ({}))) as {
        error?: string;
        profileIds?: string[];
        drivePlusDays?: number | null;
      };
      if (!r.ok) throw new Error(b.error ?? "Could not redeem");
      const parts = [
        b.profileIds?.length ? `${b.profileIds.length} sound${b.profileIds.length > 1 ? "s" : ""}` : null,
        b.drivePlusDays ? `Drive+ for ${b.drivePlusDays} days` : null,
      ].filter(Boolean);
      setNote({ ok: true, text: `Unlocked ${parts.join(" + ") || "your reward"}.` });
      setCode("");
      await qc.invalidateQueries({ queryKey: ["entitlements"] });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not redeem" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border/40 pt-4">
      <p className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase">Promo code</p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim().length >= 3) void redeem();
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={32}
          placeholder="ENTER CODE"
          aria-label="Promo code"
          className="h-10 min-w-0 flex-1 rounded-full border border-border/60 bg-background/40 px-4 text-sm tracking-[0.15em]"
        />
        <button
          type="submit"
          disabled={busy || code.trim().length < 3}
          className="h-10 rounded-full border border-foreground/20 px-4 text-[11px] tracking-[0.2em] uppercase disabled:opacity-40"
        >
          {busy ? "…" : "Redeem"}
        </button>
      </form>
      {note && <p className={`mt-2 text-xs ${note.ok ? "text-emerald-400" : "text-red-400"}`}>{note.text}</p>}
    </div>
  );
}
