/**
 * Share a created drive song as an image (drive chart over the car still) plus a short
 * message and a link to the site. Everything is drawn on the device; no audio or GPS is uploaded.
 */
import type { Locale } from "@/lib/i18n";
import type { DriveChart } from "@/lib/journey/drive-chart";

export const SONG_SHARE_URL = "https://www.elcamoso.com";

export const SONG_SHARE_MESSAGES: Record<Locale, string> = {
  en: "My drive just became a song. Turn your drive into music with ELCAMOSO.",
  de: "Meine Fahrt ist gerade zum Song geworden. Mach aus deiner Fahrt Musik mit ELCAMOSO.",
  ro: "Drumul meu tocmai a devenit un cântec. Transformă-ți drumul în muzică cu ELCAMOSO.",
};

type UiKey =
  | "share" | "title" | "nativeShare" | "download" | "copy" | "copied" | "email" | "close"
  | "failed" | "preparing" | "headline" | "drive" | "top" | "genre";
export const SONG_SHARE_UI: Record<Locale, Record<UiKey, string>> = {
  en: { share: "Share song drive", title: "Share your song drive", nativeShare: "Share", download: "Download image", copy: "Copy text & link", copied: "Text and link copied", email: "Email", close: "Close", failed: "Could not copy. Long-press the text to copy it.", preparing: "Preparing image…", headline: "MY DRIVE BECAME A SONG", drive: "DRIVE", top: "TOP SPEED", genre: "GENRE" },
  de: { share: "Song-Fahrt teilen", title: "Teile deine Song-Fahrt", nativeShare: "Teilen", download: "Bild herunterladen", copy: "Text & Link kopieren", copied: "Text und Link kopiert", email: "E-Mail", close: "Schließen", failed: "Kopieren fehlgeschlagen. Text lange drücken zum Kopieren.", preparing: "Bild wird erstellt…", headline: "MEINE FAHRT WURDE ZUM SONG", drive: "FAHRT", top: "HÖCHSTTEMPO", genre: "GENRE" },
  ro: { share: "Distribuie drumul-cântec", title: "Distribuie drumul tău-cântec", nativeShare: "Distribuie", download: "Descarcă imaginea", copy: "Copiază textul și linkul", copied: "Text și link copiate", email: "E-mail", close: "Închide", failed: "Nu s-a putut copia. Ține apăsat pe text pentru a-l copia.", preparing: "Se pregătește imaginea…", headline: "DRUMUL MEU A DEVENIT CÂNTEC", drive: "DRUM", top: "VITEZĂ MAX.", genre: "GEN" },
};

export function songShareText(locale: Locale = "en"): string {
  return SONG_SHARE_MESSAGES[locale] ?? SONG_SHARE_MESSAGES.en;
}

export function songShareIntents(locale: Locale = "en", url = SONG_SHARE_URL) {
  const text = songShareText(locale);
  const body = `${text} ${url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(body)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    email: `mailto:?subject=${encodeURIComponent(SONG_SHARE_UI[locale]?.headline ?? SONG_SHARE_UI.en.headline)}&body=${encodeURIComponent(body)}`,
  };
}

export function formatDriveDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${s} s`;
}

export function songShareFileName(genreName: string, w: number, h: number): string {
  const slug = genreName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "song";
  return `elcamoso-drive-song-${slug}-${w}x${h}.png`;
}

export const SONG_SHARE_SIZES = {
  portrait: { w: 1080, h: 1350 },
  og: { w: 1200, h: 630 },
} as const;

export interface SongShareCard {
  chart: DriveChart;
  genreName: string;
  songTitle?: string;
  durationSec: number;
  topSpeedKmh: number;
  carImage?: CanvasImageSource | null;
  locale?: Locale;
}

const CHAPTER_ALPHA: Record<string, number> = { INTRO: 0.04, BUILD: 0.07, GROOVE: 0.1, RISE: 0.13, PEAK: 0.2, RELEASE: 0.1, OUTRO: 0.05 };
const RED = "#e53935";

/**
 * The O))) mark from public/icon.svg (same geometry, 512 viewBox, no black tile),
 * drawn as vectors so it stays sharp at any size.
 */
export function drawElcamosoMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const k = size / 512;
  ctx.save();
  ctx.translate(x - 60 * k, y);
  ctx.scale(k, k);
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(168, 256, 88, 0, Math.PI * 2);
  ctx.stroke();
  const waves: [number, number, number, number, number, number, number, number, number][] = [
    [278, 148, 340, 200, 340, 312, 278, 364, 24],
    [348, 122, 426, 186, 426, 326, 348, 390, 22],
    [418, 98, 512, 176, 512, 336, 418, 414, 20],
  ];
  for (const [x0, y0, c1x, c1y, c2x, c2y, x1, y1, lw] of waves) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws the share card. Pure canvas calls so it also runs in tests with a mock context. */
export function drawSongShareCard(ctx: CanvasRenderingContext2D, w: number, h: number, card: SongShareCard): void {
  const ui = SONG_SHARE_UI[card.locale ?? "en"] ?? SONG_SHARE_UI.en;
  const wide = w / h > 1.4;
  const u = Math.min(w, h) / 1080;
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, w, h);

  // Car still, cover-fit, darkened.
  const img = card.carImage as (CanvasImageSource & { width?: number; height?: number }) | null | undefined;
  if (img && img.width && img.height) {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(img, (w - iw) / 2, wide ? (h - ih) / 2 : h * 0.1 - (ih - h) / 2, iw, ih);
    ctx.globalAlpha = 1;
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0.78)");
  g.addColorStop(0.35, "rgba(0,0,0,0.25)");
  g.addColorStop(0.6, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const pad = 64 * u;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  const markH = 52 * u;
  drawElcamosoMark(ctx, pad - 6 * u, pad - 12 * u, markH);
  ctx.font = `300 ${34 * u}px sans-serif`;
  ctx.fillText("ELCAMOSO", pad + markH * 0.95, pad + 30 * u);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `400 ${(wide ? 22 : 26) * u}px sans-serif`;
  ctx.fillText(ui.headline, pad, pad + (wide ? 72 : 84) * u);

  // Chart area.
  const cx = pad, cw = w - pad * 2;
  const ch = wide ? h * 0.36 : h * 0.26;
  const cy = wide ? h * 0.36 : h * 0.5;
  const chart = card.chart;
  const dur = Math.max(1, chart.durationSec);
  const X = (t: number) => cx + (t / dur) * cw;
  for (const b of chart.bands) {
    ctx.fillStyle = `rgba(255,255,255,${CHAPTER_ALPHA[b.chapter] ?? 0.06})`;
    ctx.fillRect(X(b.startSec), cy, Math.max(1, X(b.endSec) - X(b.startSec)), ch);
  }
  const maxV = Math.max(10, chart.maxSpeedKmh);
  const Y = (v: number) => cy + ch - (v / maxV) * ch * 0.9;
  if (chart.points.length) {
    ctx.beginPath();
    ctx.moveTo(X(chart.points[0]!.t), cy + ch);
    for (const p of chart.points) ctx.lineTo(X(p.t), Y(p.speedKmh));
    ctx.lineTo(X(chart.points[chart.points.length - 1]!.t), cy + ch);
    ctx.closePath();
    const ag = ctx.createLinearGradient(0, cy, 0, cy + ch);
    ag.addColorStop(0, "rgba(229,57,53,0.45)");
    ag.addColorStop(1, "rgba(229,57,53,0.02)");
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.beginPath();
    chart.points.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.speedKmh)) : ctx.moveTo(X(p.t), Y(p.speedKmh))));
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4 * u;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  chart.moments.forEach((m, i) => {
    const near = chart.points.reduce((a, p) => (Math.abs(p.t - m.t) < Math.abs(a.t - m.t) ? p : a), chart.points[0] ?? { t: m.t, speedKmh: 0, accel: 0 });
    const px = X(m.t), py = Y(near.speedKmh);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy + ch); ctx.stroke();
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(px, py, 14 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${16 * u}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), px, py + 6 * u);
    ctx.textAlign = "left";
  });
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `400 ${16 * u}px sans-serif`;
  let lastX = -1e9;
  for (const b of chart.bands) {
    const bx = X(b.startSec) + 6 * u;
    if (bx - lastX < 90 * u) continue;
    ctx.fillText(b.chapter, bx, cy + ch + 26 * u);
    lastX = bx;
  }

  // Stats.
  const stats: [string, string][] = [
    [ui.genre, card.genreName],
    [ui.drive, formatDriveDuration(card.durationSec)],
    [ui.top, `${Math.round(card.topSpeedKmh)} km/h`],
  ];
  const sy = wide ? h - pad - 70 * u : h - pad - 150 * u;
  const colW = (wide ? cw * 0.7 : cw) / 3;
  stats.forEach(([k, v], i) => {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `400 ${16 * u}px sans-serif`;
    ctx.fillText(k, pad + colW * i, sy);
    ctx.fillStyle = "#fff";
    ctx.font = `300 ${(wide ? 30 : 38) * u}px sans-serif`;
    ctx.fillText(v, pad + colW * i, sy + 44 * u);
  });
  ctx.fillStyle = RED;
  ctx.font = `500 ${20 * u}px sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText("www.elcamoso.com", w - pad, wide ? sy + 44 * u : h - pad);
  ctx.textAlign = "left";
  if (!wide) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `300 ${24 * u}px sans-serif`;
    ctx.fillText(songShareText(card.locale ?? "en").split(". ")[1] ?? "", pad, h - pad);
  }
}

export async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderSongShareImage(card: SongShareCard, size: { w: number; h: number }): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  drawSongShareCard(ctx, size.w, size.h, card);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"),
  );
}
