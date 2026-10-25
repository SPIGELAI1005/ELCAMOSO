import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { rememberSmilesCard } from "@/lib/smiles/useSmilesCards";
import { useSettings } from "@/lib/drive/useSettings";
import { t } from "@/lib/i18n";
import { isTooShortDrive, tooShortVariant } from "@/lib/smiles/smiles";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { listJourneys } from "@/lib/journey";
import type { JourneyTraceV1 } from "@/lib/journey-trace";
import {
  CURRENCY_SYMBOL,
  SMILES_CURRENCIES,
  L_PER_GAL,
  computeSmiles,
  defaultSmilesSettings,
  fmtDistance,
  fmtEconomy,
  fmtMass,
  fmtMoney,
  fmtFuel,
  lifetimeSmiles,
  loadSmilesSettings,
  rememberJourneySmiles,
  saveSmilesSettings,
  smileLabel,
  type SmilesResult,
  type SmilesSettings,
} from "@/lib/smiles/smiles";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";
import { smilesCardUrl, smilesShareText } from "@/lib/smiles/share";
import { SmilesShareSheet } from "@/components/smiles/SmilesShareSheet";

const RED = "#e53935";

export function SmilesLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 92 72"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="20" cy="36" r="17" strokeWidth="3.4" />
      <path d="M40 14 C 52 24, 52 48, 40 58" strokeWidth="3.2" />
      <path d="M54 9 C 69 22, 69 50, 54 63" strokeWidth="3" />
      <path d="M68 4 C 86 20, 86 52, 68 68" strokeWidth="2.8" />
    </svg>
  );
}

export interface SmilesCardProps {
  journeyId: string;
  profileId: string;
  profileName: string;
  distanceM: number;
  durationMs: number;
  trace: JourneyTraceV1 | null;
  category?: string;
  live?: import("@/lib/journey/types").JourneySmilesLive | undefined;
}

export function SmilesCard(props: SmilesCardProps) {
  const [settings, setSettings] = useState<SmilesSettings>(() => defaultSmilesSettings());
  const [editOpen, setEditOpen] = useState(false);
  const [life, setLife] = useState<ReturnType<typeof lifetimeSmiles> | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareImage, setShareImage] = useState<Blob | null>(null);

  const { settings: appSettings } = useSettings();
  const lang = appSettings.language;
  const tooShort = isTooShortDrive(props.distanceM, props.durationMs);
  useEffect(() => setSettings(loadSmilesSettings()), []);
  useEffect(() => {
    track("smiles_shown", { profileId: props.profileId });
  }, [props.journeyId, props.profileId]);
  const r = useMemo(
    () =>
      computeSmiles(
        {
          profileId: props.profileId,
          distanceM: props.distanceM,
          durationMs: props.durationMs,
          trace: props.trace,
          category: props.category,
          live: props.live,
        },
        settings,
      ),
    [
      props.profileId,
      props.distanceM,
      props.durationMs,
      props.trace,
      props.category,
      props.live,
      settings,
    ],
  );
  useEffect(() => {
    if (tooShort) return;
    rememberJourneySmiles(props.journeyId, r);
    void listJourneys()
      .then((js) => setLife(lifetimeSmiles(js, settings)))
      .catch(() => setLife(null));
  }, [props.journeyId, r, settings, tooShort]);
  const savedCardKey = useRef<string | null>(null);
  useEffect(() => {
    if (!props.journeyId || tooShort) return;
    const key = `${props.journeyId}:${r.score}`;
    if (savedCardKey.current === key) return;
    savedCardKey.current = key;
    void rememberSmilesCard({
      journeyId: props.journeyId,
      profileId: props.profileId,
      profileName: props.profileName,
      score: r.score,
      distanceKm: r.distanceKm,
      result: r,
    });
  }, [props.journeyId, props.profileId, props.profileName, r, tooShort]);

  const u = settings.units;
  const c = settings.currency;
  const fuelUnit = u === "us" ? "gal" : "L";
  const bars = [
    { label: "Hard launches", value: String(r.launches), frac: Math.min(1, r.launches / 7) },
    r.nearRedlineSec !== null
      ? {
          label: "Time near redline",
          value: `${Math.round(r.nearRedlineSec)} s`,
          frac: Math.min(1, r.nearRedlineSec / 60),
        }
      : {
          label: "Hard acceleration",
          value: `${Math.round(r.hardShare * 100)}%`,
          frac: Math.min(1, r.hardShare * 6),
        },
    ...(r.raceModeSec !== null
      ? [
          {
            label: "Race mode",
            value: `${Math.round(r.raceModeSec / 60)} min`,
            frac: Math.min(1, (r.raceModeSec * 1000) / Math.max(1, props.durationMs)),
            red: true,
          },
        ]
      : []),
  ];

  const shareInfo = {
    score: r.score,
    distance: fmtDistance(r.distanceKm, u),
    profileName: props.profileName,
  };
  const shareText = smilesShareText(shareInfo);
  const cardUrl = smilesCardUrl(shareInfo);

  async function share() {
    setShareNote(null);
    let blob: Blob | null = null;
    try {
      blob = await renderShareImage(r, settings, props.profileName);
    } catch {
      blob = null;
    }
    setShareImage(blob);
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (blob && nav.share) {
        const file = new File([blob], "elcamoso-smiles.png", { type: "image/png" });
        if (nav.canShare?.({ files: [file] })) {
          await nav.share({ files: [file], title: "Smiles per Mile", text: shareText });
          track("smiles_shared", { kind: "web-share" });
          return;
        }
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    // Tesla browser / desktop: no Web Share with files. Offer explicit options.
    setShareOpen(true);
  }

  if (tooShort) {
    return (
      <section data-testid="smiles-card">
        <p className="text-center text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Smiles per Mile
        </p>
        <div
          data-testid="smiles-too-short"
          className="relative mt-4 overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02))] p-6 backdrop-blur-xl"
        >
          <div className="mb-5 flex items-center gap-2.5 border-b border-white/8 pb-4">
            <SmilesLogo className="h-[22px] w-auto" />
            <span className="text-[13px] font-normal tracking-[0.3em]">ELCAMOSO</span>
            <span className="ml-auto text-[9px] tracking-[0.14em] whitespace-nowrap text-white/40 uppercase">
              Smiles per Mile
            </span>
          </div>
          <div className="flex items-center gap-5">
            <svg
              viewBox="0 0 100 100"
              className="size-[96px] shrink-0 text-white/45"
              aria-label="No smile score yet"
            >
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#2a2a2a"
                strokeWidth="4"
                strokeDasharray="3 7"
              />
              <text
                x="50"
                y="58"
                textAnchor="middle"
                fill="currentColor"
                fontWeight="200"
                fontSize="26"
              >
                --
              </text>
            </svg>
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                Smile score
              </div>
              <div className="mt-1.5 text-lg font-light">{t(lang, "smiles.tooShortTitle")}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t(lang, `smiles.tooShort.${tooShortVariant(props.journeyId)}`)}{" "}
                {t(lang, "smiles.tooShortHint")}
              </p>
            </div>
          </div>
          <div className="mt-4 text-center text-[11px] text-white/35">
            {fmtDistance(r.distanceKm, u)} · {Math.round(props.durationMs / 1000)} s
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="smiles-card">
      <p className="text-center text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        Smiles per Mile
      </p>
      <div className="relative mt-4 overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02))] p-6 shadow-[0_0_40px_rgba(229,57,53,.08)] backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2.5 border-b border-white/8 pb-4">
          <SmilesLogo className="h-[22px] w-auto" />
          <span className="text-[13px] font-normal tracking-[0.3em]">ELCAMOSO</span>
          <span className="ml-auto text-[9px] tracking-[0.14em] whitespace-nowrap text-[#e53935] uppercase">
            Smiles per Mile
          </span>
        </div>

        <div className="flex items-center gap-5">
          <svg
            viewBox="0 0 100 100"
            className="size-[108px] shrink-0"
            aria-label={`Smile score ${r.score}`}
          >
            <circle cx="50" cy="50" r="44" fill="none" stroke="#1d1d1d" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={RED}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(r.score / 100) * 276.5} 277`}
              transform="rotate(-90 50 50)"
            />
            <text
              x="50"
              y="59"
              textAnchor="middle"
              fill="currentColor"
              fontWeight="200"
              fontSize="28"
            >
              {r.score}
            </text>
          </svg>
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
              Smile score
            </div>
            <div className="mt-1.5 text-lg font-light">{smileLabel(r.score)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {fmtDistance(r.distanceKm, u)} · {r.smilesPerMile.toFixed(1)} smiles per mile
            </div>
          </div>
        </div>

        <div className="mt-2">
          {bars.map((b) => (
            <div key={b.label} className="mt-2.5">
              <div className="flex justify-between text-xs text-foreground/75">
                <span>{b.label}</span>
                <span>{b.value}</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-[#1d1d1d]">
                <i
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.round(b.frac * 100)}%`,
                    background: "red" in b ? RED : "#f2f2f2",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Tile
            k={`${r.fuel.emoji} ${r.fuel.name}${r.fuel.fun ? " · fun estimate" : ""}`}
            v={fmtFuel(r.amount, r.fuel.unit, u)}
            s={
              r.fuel.unit === "L" && r.fuel.perKm < 1
                ? fmtEconomy(r.lPer100, u)
                : `${shortName(props.profileName)} · this drive`
            }
          />
          <Tile
            k="Would have cost"
            v={fmtMoney(r.fuelCost, c)}
            s={`vs ${fmtMoney(r.evCost, c)} electricity`}
          />
          <Tile
            k={r.saved >= 0 ? "You saved" : "Cheaper than your EV"}
            v={fmtMoney(Math.abs(r.saved), c)}
            s={r.saved >= 0 ? "this drive" : "but way less fun"}
            red
          />
          <Tile k="CO₂ avoided" v={fmtMass(r.co2Kg, u)} s="net of grid power" />
        </div>
        <p
          className="mt-3.5 text-center text-sm font-light text-foreground/85"
          data-testid="smiles-quip"
        >
          {r.fuel.quip.replace("{a}", fmtFuel(r.amount, r.fuel.unit, u))}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          Fuel{" "}
          <b className="font-normal text-foreground/85">
            {fmtMoney(settings.fuelPrice, c)} / {fuelUnit}
          </b>
          · power {fmtMoney(settings.kwhPrice, c)} / kWh
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            data-testid="smiles-edit"
            className="inline-flex h-6 items-center gap-1 rounded-full border border-white/20 px-2.5 text-[10px] tracking-[0.12em] text-foreground/80"
          >
            ✎ Edit
          </button>
        </div>

        <button
          type="button"
          onClick={() => void share()}
          className="mt-5 flex h-[52px] w-full items-center justify-center rounded-full bg-foreground text-[10px] tracking-[0.22em] text-background uppercase"
        >
          Share my smiles
        </button>
        <Link
          to="/my-cards"
          data-testid="smiles-my-cards"
          className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-white/20 text-[10px] tracking-[0.22em] text-foreground/80 uppercase"
        >
          My cards
        </Link>
        <SmilesShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          text={shareText}
          cardUrl={cardUrl}
          image={shareImage}
        />
        {shareNote ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">{shareNote}</p>
        ) : null}
        {life && life.drives > 0 ? (
          <p className="mt-4 text-center text-xs text-foreground/60">
            Lifetime: {life.drives} drives · {fmtDistance(life.km, u)} · {fmtMoney(life.saved, c)}{" "}
            saved · {fmtMass(life.co2Kg, u)} CO₂
          </p>
        ) : null}
        <p className="mt-4 text-center text-[10px] leading-relaxed text-white/35">
          {r.fuel.fun ? "Fun estimate, not science. " : "Estimates. "}Compared with an EV at 17
          kWh/100 km · grid {u === "us" ? "0.84 lb" : "0.38 kg"} CO₂/kWh. Fixed fuel prices
          converted at rough rates.
          {r.fullMetrics ? "" : " Older drive: score estimated from motion only."}
        </p>
        <div className="mt-3.5 flex items-center justify-center gap-2 text-[10px] tracking-[0.3em] text-white/45">
          <SmilesLogo className="h-3 w-auto" />
          elcamoso.com
        </div>
      </div>

      <SmilesSettingsSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        settings={settings}
        onSave={(s) => {
          setSettings(s);
          saveSmilesSettings(s);
          setEditOpen(false);
        }}
      />
    </section>
  );
}

function shortName(n: string) {
  return n.length > 14 ? "Engine" : n;
}

function Tile({ k, v, s, red }: { k: string; v: string; s: string; red?: boolean }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.025] p-3.5">
      <small className="text-[11px] text-muted-foreground">{k}</small>
      <b className={cn("mt-1.5 block text-2xl font-light", red && "text-[#e53935]")}>{v}</b>
      <small className="text-[11px] text-muted-foreground">{s}</small>
    </div>
  );
}

function SmilesSettingsSheet({
  open,
  onOpenChange,
  settings,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: SmilesSettings;
  onSave: (s: SmilesSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);
  const sym = CURRENCY_SYMBOL[draft.currency].trim();
  const seg = (on: boolean) =>
    cn(
      "h-9 flex-1 rounded-full border text-[11px] transition-colors",
      on
        ? "border-foreground bg-foreground text-background"
        : "border-white/20 text-muted-foreground",
    );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-testid="smiles-settings"
        className="mx-auto w-full max-w-md rounded-t-3xl border-border px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-light tracking-[0.24em] uppercase">
            Fuel &amp; units
          </SheetTitle>
          <SheetDescription className="text-xs">Saved on this device.</SheetDescription>
        </SheetHeader>
        <Field
          label="Fuel price"
          unit={`${sym} / ${draft.units === "us" ? "US gal" : "litre"}`}
          value={draft.fuelPrice}
          onChange={(v) => setDraft({ ...draft, fuelPrice: v })}
        />
        <Field
          label="Electricity price"
          unit={`${sym} / kWh`}
          value={draft.kwhPrice}
          onChange={(v) => setDraft({ ...draft, kwhPrice: v })}
        />
        <div className="mt-4 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Units
        </div>
        <div className="mt-2 flex gap-1.5">
          {(["metric", "us"] as const).map((u) => (
            <button
              key={u}
              type="button"
              className={seg(draft.units === u)}
              onClick={() => {
                if (u === draft.units) return;
                const f = u === "us" ? L_PER_GAL : 1 / L_PER_GAL;
                setDraft({
                  ...draft,
                  units: u,
                  fuelPrice: Math.round(draft.fuelPrice * f * 100) / 100,
                });
              }}
            >
              {u === "us" ? "US gal · mpg · mi" : "Litres · L/100 km · km"}
            </button>
          ))}
        </div>
        <div className="mt-4 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Currency
        </div>
        <div className="mt-2 flex gap-1.5">
          {SMILES_CURRENCIES.map((cur) => (
            <button
              key={cur}
              type="button"
              className={seg(draft.currency === cur)}
              onClick={() => {
                if (cur === draft.currency) return;
                const d = defaultSmilesSettings(cur, draft.units);
                setDraft({ ...draft, currency: cur, fuelPrice: d.fuelPrice, kwhPrice: d.kwhPrice });
              }}
            >
              {cur === "EUR" ? "€ EUR" : cur === "USD" ? "$ USD" : cur === "GBP" ? "£ GBP" : cur}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="mt-5 h-12 w-full rounded-full bg-foreground text-[10px] tracking-[0.22em] text-background uppercase"
        >
          Save
        </button>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="mt-4 block">
      <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</span>
      <div className="mt-2 flex h-12 items-center rounded-full border border-white/20 px-4">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(v) && v >= 0 && v < 10000) onChange(v);
          }}
          className="min-w-0 flex-1 bg-transparent text-lg font-light outline-none"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </label>
  );
}

/* ---------------- share image (client-side canvas) ---------------- */
export async function renderShareImage(
  r: SmilesResult,
  s: SmilesSettings,
  profileName: string,
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  try {
    await document.fonts?.ready;
  } catch {
    /* ignore */
  }
  const F = (w: number, px: number) => `${w} ${px}px Outfit, system-ui, sans-serif`;
  g.fillStyle = "#050505";
  g.fillRect(0, 0, W, H);
  const grd = g.createRadialGradient(W / 2, 520, 50, W / 2, 520, 700);
  grd.addColorStop(0, "rgba(229,57,53,0.14)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // logo
  const logo = (x: number, y: number, sc: number, col: string) => {
    g.save();
    g.translate(x, y);
    g.scale(sc, sc);
    g.strokeStyle = col;
    g.lineCap = "round";
    g.lineWidth = 3.4;
    g.beginPath();
    g.arc(20, 36, 17, 0, Math.PI * 2);
    g.stroke();
    for (const [d, w] of [
      [[40, 14, 52, 24, 52, 48, 40, 58], 3.2],
      [[54, 9, 69, 22, 69, 50, 54, 63], 3],
      [[68, 4, 86, 20, 86, 52, 68, 68], 2.8],
    ] as const) {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(d[0], d[1]);
      g.bezierCurveTo(d[2], d[3], d[4], d[5], d[6], d[7]);
      g.stroke();
    }
    g.restore();
  };
  logo(90, 90, 1, "#f2f2f2");
  g.fillStyle = "#f2f2f2";
  g.font = F(400, 40);
  g.letterSpacing = "12px";
  g.fillText("ELCAMOSO", 205, 140);
  g.fillStyle = RED;
  g.font = F(400, 22);
  g.letterSpacing = "5px";
  g.textAlign = "right";
  g.fillText("SMILES PER MILE", W - 90, 136);
  g.textAlign = "center";
  // ring
  const cx = W / 2;
  const cy = 470;
  g.lineWidth = 26;
  g.strokeStyle = "#1d1d1d";
  g.beginPath();
  g.arc(cx, cy, 190, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = RED;
  g.lineCap = "round";
  g.beginPath();
  g.arc(cx, cy, 190, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * r.score) / 100);
  g.stroke();
  g.fillStyle = "#f2f2f2";
  g.letterSpacing = "0px";
  g.font = F(200, 150);
  g.fillText(String(r.score), cx, cy + 52);
  g.font = F(300, 44);
  g.fillText(smileLabel(r.score), cx, 760);
  g.fillStyle = "#9a9a9a";
  g.font = F(300, 30);
  g.fillText(
    `${profileName} · ${fmtDistance(r.distanceKm, s.units)} · ${r.smilesPerMile.toFixed(1)} smiles/mile`,
    cx,
    815,
  );
  if (r.hasFuel) {
    const cells: [string, string, boolean][] = [
      [r.fuel.name.toUpperCase(), fmtFuel(r.amount, r.fuel.unit, s.units), false],
      [r.saved >= 0 ? "SAVED" : "CHEAPER", fmtMoney(Math.abs(r.saved), s.currency), true],
      ["CO₂ AVOIDED", fmtMass(r.co2Kg, s.units), false],
    ];
    g.fillStyle = "#cfcfcf";
    g.font = F(300, 32);
    g.fillText(
      `${r.fuel.emoji} ${r.fuel.quip.replace("{a}", fmtFuel(r.amount, r.fuel.unit, s.units))}`.slice(
        0,
        64,
      ),
      cx,
      1150,
    );
    cells.forEach(([k, v, red], i) => {
      const x = 90 + i * 310;
      g.strokeStyle = "rgba(255,255,255,0.12)";
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(x, 900, 280, 190, 28);
      g.stroke();
      g.fillStyle = "#8a8a8a";
      g.font = F(300, 22);
      g.letterSpacing = "4px";
      g.fillText(k, x + 140, 960);
      g.letterSpacing = "0px";
      g.fillStyle = red ? RED : "#f2f2f2";
      g.font = F(300, v.length > 9 ? 40 : 56);
      g.fillText(v, x + 140, 1045);
    });
  } else {
    g.fillStyle = "#9a9a9a";
    g.font = F(300, 34);
    g.fillText(`${r.launches} hard launches · zero fuel, all smiles`, cx, 1000);
  }
  logo(cx - 150, 1205, 0.55, "#777");
  g.fillStyle = "#9a9a9a";
  g.font = F(300, 30);
  g.letterSpacing = "8px";
  g.textAlign = "left";
  g.fillText("elcamoso.com", cx - 92, 1236);
  return await new Promise<Blob>((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"),
  );
}
