import { useEffect, useState } from "react";
import QRCode from "qrcode";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SCANNABLE_QR_OPTIONS } from "@/lib/qr";
import { shareIntentLinks } from "@/lib/smiles/share";
import { track } from "@/lib/analytics/track";

const BTN =
  "flex h-12 items-center justify-center rounded-full border border-border text-[10px] tracking-[0.2em] uppercase hover:border-foreground/60";

/** Fallback when Web Share with files is not available (Tesla browser, desktop). */
export function SmilesShareSheet({
  open,
  onOpenChange,
  text,
  cardUrl,
  image,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  cardUrl: string;
  image: Blob | null;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const links = shareIntentLinks(text, cardUrl);

  useEffect(() => {
    if (!open) return;
    void QRCode.toDataURL(cardUrl, SCANNABLE_QR_OPTIONS).then(setQr);
  }, [open, cardUrl]);
  useEffect(() => {
    if (!image) return;
    const u = URL.createObjectURL(image);
    setImgUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image]);
  useEffect(() => {
    if (!open) setNote(null);
  }, [open]);

  const openLink = (kind: string, href: string) => {
    track("smiles_shared", { kind });
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Text copied.");
    } catch {
      setNote(text);
    }
    track("smiles_shared", { kind: "copy" });
  };

  const download = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = "elcamoso-smiles.png";
    a.click();
    setNote("If nothing downloads, scan the QR with your phone.");
    track("smiles_shared", { kind: "download" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        overlayClassName="z-[250]"
        className="z-[260] flex max-h-[90vh] flex-col gap-4 overflow-y-auto rounded-t-3xl border-border px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="font-light tracking-[0.18em] uppercase">
            Share my smiles
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">{text}</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={BTN} onClick={() => openLink("x", links.x)}>
            Post on X
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => openLink("whatsapp", links.whatsapp)}
          >
            WhatsApp
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => openLink("facebook", links.facebook)}
          >
            Facebook
          </button>
          <button type="button" className={BTN} onClick={() => void copy()}>
            Copy text
          </button>
          <button
            type="button"
            className={`${BTN} col-span-2`}
            onClick={download}
            disabled={!imgUrl}
          >
            Download image
          </button>
        </div>
        {note ? <p className="text-center text-xs text-muted-foreground">{note}</p> : null}
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img
              src={qr}
              alt="QR code to open your Smiles card on your phone"
              className="h-[200px] w-[200px] rounded-lg bg-white [image-rendering:pixelated]"
            />
          ) : null}
          <p className="text-[11px] text-muted-foreground">Scan to share from your phone</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
