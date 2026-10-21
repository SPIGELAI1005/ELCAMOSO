import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { shareIntentLinks, smilesShareText } from "@/lib/smiles/share";

/** Public, read-only Smiles card opened from the car's QR so the phone can share it. */
export const Route = createFileRoute("/smiles-card")({
  validateSearch: (search: Record<string, unknown>): { s?: number; d?: string; p?: string } => {
    const n = Number(search["s"]);
    return {
      ...(Number.isFinite(n) ? { s: Math.max(0, Math.min(100, Math.round(n))) } : {}),
      ...(typeof search["d"] === "string" ? { d: search["d"].slice(0, 16) } : {}),
      ...(typeof search["p"] === "string" ? { p: search["p"].slice(0, 40) } : {}),
    };
  },
  component: SmilesCardPage,
  head: () => ({ meta: [{ title: "Smiles per Mile - ELCAMOSO" }] }),
});

function SmilesCardPage() {
  const { s = 0, d = "", p = "ELCAMOSO" } = Route.useSearch();
  const text = smilesShareText({ score: s, distance: d || "short", profileName: p });
  const links = shareIntentLinks(text);
  const [note, setNote] = useState<string | null>(null);
  const btn =
    "flex h-12 items-center justify-center rounded-full border border-border text-[10px] tracking-[0.2em] uppercase";

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Smiles per Mile", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setNote("Text copied.");
    } catch {
      /* cancelled */
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-6 py-10 text-center">
      <ElcamosoMark className="mb-8 h-8 w-auto" />
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        Smiles per Mile
      </p>
      <p className="mt-4 text-7xl font-extralight">{s}</p>
      <p className="mt-2 text-sm text-muted-foreground">{d ? `${d} with ${p}` : p}</p>
      <div className="mt-10 grid w-full grid-cols-2 gap-2">
        <button
          type="button"
          className={`${btn} col-span-2 bg-foreground text-background`}
          onClick={() => void nativeShare()}
        >
          Share
        </button>
        <a className={btn} href={links.x} target="_blank" rel="noopener noreferrer">
          Post on X
        </a>
        <a className={btn} href={links.whatsapp} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        <a
          className={`${btn} col-span-2`}
          href={links.facebook}
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook
        </a>
      </div>
      {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
      <Link
        to="/drive"
        className="mt-10 text-[10px] tracking-[0.24em] text-muted-foreground uppercase"
      >
        Open ELCAMOSO
      </Link>
    </main>
  );
}
