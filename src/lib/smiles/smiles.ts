/** Smiles per Mile: what the virtual engine would have burned, and how much fun it was. */
import type { JourneyTraceV1 } from "@/lib/journey-trace";

import { fuelFor, type FuelSpec, type FuelUnit } from "./fuels";

/** EUR → currency, rough (for fixed-price fuels only). */
export const FX_FROM_EUR = { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95, RON: 4.97 } as const;

export type SmilesCurrency = "EUR" | "USD" | "GBP" | "CHF" | "RON";
export type SmilesUnits = "metric" | "us";
export interface SmilesSettings {
  currency: SmilesCurrency;
  units: SmilesUnits;
  /** per litre (metric) or per US gallon (us) */
  fuelPrice: number;
  kwhPrice: number;
}
export const SMILES_CURRENCIES: SmilesCurrency[] = ["EUR", "USD", "GBP", "CHF", "RON"];
export const CURRENCY_SYMBOL: Record<SmilesCurrency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF ",
  RON: "RON ",
};
/** Default fuel price per litre and kWh price, per currency. */
const CURRENCY_DEFAULTS: Record<SmilesCurrency, { perL: number; kwh: number }> = {
  EUR: { perL: 1.8, kwh: 0.35 },
  USD: { perL: 3.4 / 3.785, kwh: 0.17 },
  GBP: { perL: 1.45, kwh: 0.27 },
  CHF: { perL: 1.85, kwh: 0.3 },
  RON: { perL: 7.3, kwh: 1.2 },
};
export const L_PER_GAL = 3.785411784;
export const KM_PER_MI = 1.609344;
export const CO2_KG_PER_L = 2.31;
export const GRID_KG_PER_KWH = 0.38;
export const EV_KWH_PER_100KM = 17;

export function defaultSmilesSettings(
  currency: SmilesCurrency = "EUR",
  units?: SmilesUnits,
): SmilesSettings {
  const u = units ?? (currency === "USD" ? "us" : "metric");
  const d = CURRENCY_DEFAULTS[currency];
  return {
    currency,
    units: u,
    fuelPrice: round2(u === "us" ? d.perL * L_PER_GAL : d.perL),
    kwhPrice: d.kwh,
  };
}

const KEY = "elcamoso.smiles.settings.v1";
export function loadSmilesSettings(): SmilesSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<SmilesSettings> | null;
    if (v && SMILES_CURRENCIES.includes(v.currency as SmilesCurrency)) {
      const base = defaultSmilesSettings(
        v.currency as SmilesCurrency,
        v.units === "us" ? "us" : "metric",
      );
      return {
        ...base,
        fuelPrice: num(v.fuelPrice, base.fuelPrice),
        kwhPrice: num(v.kwhPrice, base.kwhPrice),
      };
    }
  } catch {
    /* ignore */
  }
  return defaultSmilesSettings();
}
export function saveSmilesSettings(s: SmilesSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export interface SmilesInput {
  profileId: string;
  distanceM: number;
  durationMs: number;
  trace: JourneyTraceV1 | null;
  category?: string | undefined;
  /** Live-recorded metrics (journey.smiles) – used when the trace lacks them. */
  live?: import("@/lib/journey/types").JourneySmilesLive | undefined;
}

export function unitPrice(f: FuelSpec, s: SmilesSettings): number {
  if (f.priceEur === "user") return s.units === "us" ? s.fuelPrice / L_PER_GAL : s.fuelPrice;
  if (f.priceEur === "user-kwh") return s.kwhPrice;
  return f.priceEur * FX_FROM_EUR[s.currency];
}

export function fmtFuel(amount: number, unit: FuelUnit, u: SmilesUnits): string {
  if (typeof unit === "object") {
    const n = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;
    return `${n.toLocaleString("en")} ${n === 1 ? unit.one : unit.many}`;
  }
  const d = (v: number) =>
    v >= 100 ? Math.round(v).toLocaleString("en") : v.toFixed(v >= 10 ? 1 : 2);
  if (unit === "L") return u === "us" ? `${d(amount / L_PER_GAL)} gal` : `${d(amount)} L`;
  if (unit === "kg") return u === "us" ? `${d(amount * 2.20462)} lb` : `${d(amount)} kg`;
  if (unit === "g") return u === "us" ? `${d(amount * 0.035274)} oz` : `${d(amount)} g`;
  return `${d(amount)} kWh`;
}

export interface SmilesResult {
  distanceKm: number;
  hasFuel: boolean;
  fuel: FuelSpec;
  /** amount in the fuel's native unit (L, kg, g, kWh, count) */
  amount: number;
  launches: number;
  nearRedlineSec: number | null;
  raceModeSec: number | null;
  hardShare: number;
  score: number;
  /** Base points for a real drive kept on this sound (0..ENJOY_MAX). */
  enjoyPts: number;
  smilesPerMile: number;
  litres: number;
  lPer100: number;
  fuelCost: number;
  evKwh: number;
  evCost: number;
  saved: number;
  co2Kg: number;
  /** false when the journey predates Smiles recording (score estimated from motion only). */
  fullMetrics: boolean;
}

export function computeSmiles(input: SmilesInput, settings: SmilesSettings): SmilesResult {
  const km = Math.max(0, input.distanceM) / 1000;
  const samples = input.trace?.samples ?? [];
  let moving = 0;
  let hard = 0;
  for (const s of samples) {
    if (s.speedKmh > 4) {
      moving++;
      if ((s.longitudinalAccel ?? s.acceleration) > 2.2) hard++;
    }
  }
  const lv = input.live;
  const hardShare = moving ? hard / moving : lv && lv.movingMs > 0 ? lv.hardMs / lv.movingMs : 0;
  const launches = input.trace
    ? input.trace.semanticEvents.filter((e) => e.type === "strong_acceleration").length
    : (lv?.launches ?? 0);
  const sm = input.trace?.summary.smiles ?? lv;
  const dur = Math.max(1, input.durationMs);
  const raceShare = sm ? Math.min(1, sm.raceModeMs / dur) : 0;

  const launchPts = Math.min(40, launches * 6);
  const motionPts = Math.min(30, hardShare * 200);
  // Sounds without a rev counter (music, horses, carriages, spaceships, other
  // "continuous" profiles) never report rpm, so rpm/race metrics stay 0 for them.
  // Score those drives from motion instead, so every sound earns smiles alike.
  const hasRpm = Boolean(sm && (sm.peakRpmFrac ?? 0) > 0);
  // Some rpm profiles (e.g. high-revving EV hypercars) rarely reach 85 % of redline,
  // so spirited motion always counts as a floor.
  const revPts =
    sm && hasRpm ? Math.max(motionPts, Math.min(30, (sm.nearRedlineMs / 60000) * 30)) : motionPts;
  const racePts = sm && hasRpm ? raceShare * 30 : Math.max(sm ? raceShare * 30 : 0, motionPts);
  // Enjoyment: keeping one sound on for a longer, real drive earns a modest base,
  // even when calm. Grows with moving distance and moving time (diminishing
  // returns), max ENJOY_MAX. Only counts real movement (> 4 km/h) and distance
  // that is plausible for that moving time, so idling or GPS jitter earns 0.
  const movingMs =
    lv && lv.movingMs > 0 ? lv.movingMs : samples.length ? (moving / samples.length) * dur : 0;
  const enjoyPts = enjoymentPoints(km, movingMs);
  const score = Math.round(Math.min(100, enjoyPts + launchPts + revPts + racePts));

  const fuel = fuelFor(input.profileId, input.category);
  const hasFuel = true;
  const factor = 1 + 0.6 * Math.min(1, hardShare * 2) + 0.1 * raceShare;
  const amount = km * fuel.perKm * factor;
  const litres = fuel.unit === "L" ? amount : 0;
  const fuelCost = amount * unitPrice(fuel, settings);
  const evKwh = (km * EV_KWH_PER_100KM) / 100;
  const evCost = evKwh * settings.kwhPrice;
  return {
    distanceKm: km,
    hasFuel,
    fuel,
    amount,
    launches,
    nearRedlineSec: sm ? sm.nearRedlineMs / 1000 : null,
    raceModeSec: sm ? sm.raceModeMs / 1000 : null,
    hardShare,
    score,
    enjoyPts,
    smilesPerMile: km > 0.05 && Number.isFinite(score) ? score / (km / KM_PER_MI) : 0,
    litres,
    lPer100: km > 0 ? (litres / km) * 100 : 0,
    fuelCost,
    evKwh,
    evCost,
    saved: fuelCost - evCost,
    co2Kg: Math.max(0, amount * fuel.co2 - evKwh * GRID_KG_PER_KWH),
    fullMetrics: Boolean(sm),
  };
}

/* ---------- lifetime (device-local cache of per-journey results) ---------- */
const LIFE_KEY = "elcamoso.smiles.lifetime.v1";
interface LifeEntry {
  km: number;
  fuelCost: number;
  evCost: number;
  co2Kg: number;
}
function readLife(): Record<string, LifeEntry> {
  try {
    return JSON.parse(localStorage.getItem(LIFE_KEY) ?? "{}") as Record<string, LifeEntry>;
  } catch {
    return {};
  }
}
export function rememberJourneySmiles(id: string, r: SmilesResult) {
  try {
    const all = readLife();
    all[id] = { km: r.distanceKm, fuelCost: r.fuelCost, evCost: r.evCost, co2Kg: r.co2Kg };
    localStorage.setItem(LIFE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
/** Sum over saved journeys; cached per-journey results (current settings for uncached ones). */
export function lifetimeSmiles(
  journeys: { id: string; distanceM: number | null; profileId: string }[],
  settings: SmilesSettings,
) {
  const cache = readLife();
  let km = 0;
  let saved = 0;
  let co2Kg = 0;
  for (const j of journeys) {
    const c = cache[j.id];
    const jk = c?.km ?? Math.max(0, j.distanceM ?? 0) / 1000;
    km += jk;
    if (c) {
      saved += c.fuelCost - c.evCost;
      co2Kg += c.co2Kg;
    } else {
      const f = fuelFor(j.profileId);
      const amt = jk * f.perKm * 1.1;
      const ev = (jk * EV_KWH_PER_100KM) / 100;
      saved += amt * unitPrice(f, settings) - ev * settings.kwhPrice;
      co2Kg += Math.max(0, amt * f.co2 - ev * GRID_KG_PER_KWH);
    }
  }
  return { drives: journeys.length, km, saved, co2Kg };
}

/* ---------- formatting ---------- */
export function fmtMoney(v: number, c: SmilesCurrency) {
  const a = Math.abs(v);
  const t = a >= 1000 ? Math.round(a).toLocaleString("en") : a.toFixed(2);
  return `${v < 0 ? "−" : ""}${CURRENCY_SYMBOL[c]}${t}`;
}
export function fmtDistance(km: number, u: SmilesUnits) {
  return u === "us" ? `${(km / KM_PER_MI).toFixed(1)} mi` : `${km.toFixed(1)} km`;
}
export function fmtVolume(l: number, u: SmilesUnits) {
  return u === "us" ? `${(l / L_PER_GAL).toFixed(2)} gal` : `${l.toFixed(1)} L`;
}
export function fmtEconomy(lPer100: number, u: SmilesUnits) {
  if (u === "us") return lPer100 > 0 ? `≈ ${(235.215 / lPer100).toFixed(1)} mpg` : "–";
  return `≈ ${lPer100.toFixed(1)} L/100 km`;
}
export function fmtMass(kg: number, u: SmilesUnits) {
  return u === "us" ? `${(kg * 2.20462).toFixed(1)} lb` : `${kg.toFixed(1)} kg`;
}
export function smileLabel(score: number) {
  if (score >= 80) return "Big grin 😁";
  if (score >= 55) return "Proper smile 😄";
  if (score >= 30) return "Smirk 🙂";
  return "Calm cruise 😌";
}
function num(v: unknown, d: number) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e4 ? v : d;
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/** Drives shorter than this get no Smiles score ("Too early to tell"). */
export const SMILES_MIN_DISTANCE_M = 1000;
export const SMILES_MIN_DURATION_MS = 60_000;
export function isTooShortDrive(distanceM: number, durationMs: number): boolean {
  return !(distanceM >= SMILES_MIN_DISTANCE_M && durationMs >= SMILES_MIN_DURATION_MS);
}
/** Stable witty-line index (0..2) for a journey id. */
export function tooShortVariant(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 3;
}

/** Cap for the calm-drive "enjoyment" base (out of 100). */
export const ENJOY_MAX = 25;
/** Fastest plausible average moving speed; distance beyond this is ignored (GPS jitter). */
const ENJOY_MAX_KMH = 250;
export function enjoymentPoints(km: number, movingMs: number): number {
  const movingMin = Math.max(0, movingMs) / 60000;
  if (movingMin < 1 || km < SMILES_MIN_DISTANCE_M / 1000) return 0;
  const realKm = Math.min(km, (movingMin / 60) * ENJOY_MAX_KMH);
  const d = 12 * (1 - Math.exp(-realKm / 15));
  const t = 13 * (1 - Math.exp(-movingMin / 25));
  return Math.round(Math.min(ENJOY_MAX, d + t));
}
