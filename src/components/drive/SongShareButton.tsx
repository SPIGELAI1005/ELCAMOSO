import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { DriveChart } from "@/lib/journey/drive-chart";
import { downloadBlob } from "@/lib/sound/render";
import {
  loadImage,
  renderSongShareImage,
  SONG_SHARE_SIZES,
  SONG_SHARE_UI,
  SONG_SHARE_URL,
  songShareFileName,
  songShareIntents,
  songShareText,
} from "@/lib/drive/song-share";

/** Share a created drive song: image drawn on the device + short message + site link. */
export function SongShareButton({
  chart,
  genreName,
  durationSec,
  topSpeedKmh,
  carImageSrc,
  locale = "en",
  className,
}: {
  chart: DriveChart;
  genreName: string;
  durationSec: number;
  topSpeedKmh: number;
  carImageSrc?: string | null;
  locale?: Locale;
  className?: string;
}) {
  const ui = SONG_SHARE_UI[locale] ?? SONG_SHARE_UI.en;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const files = useRef<{ portrait: Blob; og: Blob } | null>(null);
  const text = songShareText(locale);
  const intents = songShareIntents(locale);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const build = async () => {
    if (files.current) return files.current;
    const car = carImageSrc ? await loadImage(carImageSrc) : null;
    const card = { chart, genreName, durationSec, topSpeedKmh, carImage: car, locale };
    const [portrait, og] = await Promise.all([
      renderSongShareImage(card, SONG_SHARE_SIZES.portrait),
      renderSongShareImage(card, SONG_SHARE_SIZES.og),
    ]);
    files.current = { portrait, og };
    setPreview(URL.createObjectURL(portrait));
    return files.current;
  };

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
  };

  const onShare = async () => {
    setBusy(true);
    try {
      const { portrait } = await build();
      const { w, h } = SONG_SHARE_SIZES.portrait;
      const file = new File([portrait], songShareFileName(genreName, w, h), { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      const data: ShareData = { files: [file], text: `${text} ${SONG_SHARE_URL}`, title: ui.headline };
      if (nav.share && nav.canShare?.(data)) {
        await nav.share(data).catch(() => undefined);
        return;
      }
      setOpen(true);
    } catch {
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    const f = await build();
    const p = SONG_SHARE_SIZES.portrait, o = SONG_SHARE_SIZES.og;
    downloadBlob(f.portrait, songShareFileName(genreName, p.w, p.h));
    downloadBlob(f.og, songShareFileName(genreName, o.w, o.h));
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${SONG_SHARE_URL}`);
      flash(ui.copied);
    } catch {
      flash(ui.failed);
    }
  };

  const btn = "inline-flex h-11 items-center justify-center rounded-full border border-foreground/25 px-4 text-[10px] tracking-[0.22em] uppercase";
  return (
    <div className={className}>
      <button type="button" onClick={() => void onShare()} disabled={busy} className={`${btn} w-full border-foreground/50`} data-testid="song-share">
        {busy ? ui.preparing : ui.share}
      </button>
      {open ? (
        <div className="mt-3 border border-foreground/15 p-4" data-testid="song-share-panel">
          <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">{ui.title}</p>
          {preview ? <img src={preview} alt="" className="mx-auto mt-3 w-48 border border-foreground/10" /> : null}
          <p className="mt-3 text-sm select-all">{text} {SONG_SHARE_URL}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className={btn} onClick={() => void onDownload()} data-testid="song-share-download">{ui.download}</button>
            <button type="button" className={btn} onClick={() => void onCopy()}>{ui.copy}</button>
            <a className={btn} href={intents.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
            <a className={btn} href={intents.x} target="_blank" rel="noreferrer">X</a>
            <a className={btn} href={intents.email}>{ui.email}</a>
            <button type="button" className={btn} onClick={() => setOpen(false)}>{ui.close}</button>
          </div>
          {toast ? <p className="mt-2 text-xs text-muted-foreground" role="status">{toast}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
