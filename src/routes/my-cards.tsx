import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { renderShareImage } from "@/components/smiles/SmilesCard";
import { SmilesShareSheet } from "@/components/smiles/SmilesShareSheet";
import { MAX_PINNED_CARDS, MAX_UNPINNED_CARDS, type SmilesCardRecord } from "@/lib/smiles/cards";
import { smilesCardUrl, smilesShareText } from "@/lib/smiles/share";
import { fmtDistance, loadSmilesSettings } from "@/lib/smiles/smiles";
import { useSmilesCards } from "@/lib/smiles/useSmilesCards";

export const Route = createFileRoute("/my-cards")({
  component: MyCardsPage,
  head: () => ({ meta: [{ title: "My Smiles cards - ELCAMOSO" }] }),
});

const BTN =
  "flex h-10 items-center justify-center rounded-full border border-border px-4 text-[10px] tracking-[0.18em] uppercase hover:border-foreground/60";

function MyCardsPage() {
  const { cards, cloud, loading, note, togglePin, remove } = useSmilesCards();
  const [sharing, setSharing] = useState<{ text: string; url: string; image: Blob | null } | null>(
    null,
  );

  const share = async (card: SmilesCardRecord) => {
    const settings = loadSmilesSettings();
    const info = {
      score: card.score,
      distance: fmtDistance(card.distanceKm, settings.units),
      profileName: card.profileName,
    };
    const text = smilesShareText(info);
    let image: Blob | null = null;
    try {
      image = await renderShareImage(card.result, settings, card.profileName);
    } catch {
      image = null;
    }
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (image && nav.share) {
        const file = new File([image], "elcamoso-smiles.png", { type: "image/png" });
        if (nav.canShare?.({ files: [file] })) {
          await nav.share({ files: [file], title: "Smiles per Mile", text });
          return;
        }
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    setSharing({ text, url: smilesCardUrl(info), image });
  };

  const pinned = cards.filter((c) => c.pinned);
  const recent = cards.filter((c) => !c.pinned);

  const list = (items: SmilesCardRecord[]) =>
    items.map((card) => (
      <li key={card.id} className="rounded-2xl border border-border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-3xl font-extralight">{card.score}</span>
          <span className="text-right text-xs text-muted-foreground">
            {card.profileName} · {fmtDistance(card.distanceKm, loadSmilesSettings().units)}
            <br />
            {new Date(card.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={() => void togglePin(card)}>
            {card.pinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" className={BTN} onClick={() => void share(card)}>
            Share
          </button>
          <button type="button" className={BTN} onClick={() => void remove(card)}>
            Delete
          </button>
        </div>
      </li>
    ));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <ElcamosoMark className="mb-8 h-8 w-auto" />
      <h1 className="text-2xl font-light">My Smiles cards</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Your last {MAX_UNPINNED_CARDS} drives are kept. Pin up to {MAX_PINNED_CARDS} to keep them
        for good.{cloud ? "" : " Saved on this device. Sign in to keep them with your account."}
      </p>
      {note ? <p className="mt-4 text-xs text-foreground">{note}</p> : null}
      {loading ? (
        <p className="mt-8 text-xs text-muted-foreground">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No cards yet. Finish a drive to get one.
        </p>
      ) : (
        <>
          {pinned.length ? (
            <>
              <p className="mt-8 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                Pinned
              </p>
              <ul className="mt-3 flex flex-col gap-3">{list(pinned)}</ul>
            </>
          ) : null}
          {recent.length ? (
            <>
              <p className="mt-8 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
                Recent
              </p>
              <ul className="mt-3 flex flex-col gap-3">{list(recent)}</ul>
            </>
          ) : null}
        </>
      )}
      <Link
        to="/drive"
        className="mt-10 text-center text-[10px] tracking-[0.24em] text-muted-foreground uppercase"
      >
        Back to Drive
      </Link>
      {sharing ? (
        <SmilesShareSheet
          open
          onOpenChange={(o) => !o && setSharing(null)}
          text={sharing.text}
          cardUrl={sharing.url}
          image={sharing.image}
        />
      ) : null}
    </main>
  );
}
