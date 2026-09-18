import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { ReactNode } from "react";
import type { OgCardData, OgCardVariant } from "./types";
import { OG_CACHE_CONTROL_DYNAMIC, OG_CACHE_CONTROL_STATIC, OG_SIZE } from "./palette";
import { renderOgCardElement } from "./render-card";
import { normalizeOgCardData, SOCIAL_CARD_TEMPLATES, variantFallbackPath } from "./templates";
import { absoluteSeoUrl } from "@/lib/seo/config";
import { parseVariantParam } from "./url";

const require = createRequire(import.meta.url);

let fontLight: ArrayBuffer | null = null;
let fontRegular: ArrayBuffer | null = null;
let wasmReady: Promise<void> | null = null;

async function ensureResvg(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
      await initWasm(await readFile(wasmPath));
    })();
  }
  await wasmReady;
}

async function loadFonts(): Promise<
  { name: string; data: ArrayBuffer; weight: number; style: "normal" }[]
> {
  if (!fontLight || !fontRegular) {
    const base = join(process.cwd(), "assets", "fonts");
    const light = await readFile(join(base, "Outfit-Light.ttf"));
    const regular = await readFile(join(base, "Outfit-Regular.ttf"));
    fontLight = light.buffer.slice(
      light.byteOffset,
      light.byteOffset + light.byteLength,
    ) as ArrayBuffer;
    fontRegular = regular.buffer.slice(
      regular.byteOffset,
      regular.byteOffset + regular.byteLength,
    ) as ArrayBuffer;
  }
  return [
    { name: "Outfit", data: fontLight, weight: 300, style: "normal" },
    { name: "Outfit", data: fontRegular, weight: 400, style: "normal" },
  ];
}

/** Render a card to PNG bytes (Satori → resvg-wasm). */
export async function renderOgCardPng(data: OgCardData): Promise<Uint8Array> {
  await ensureResvg();
  const fonts = await loadFonts();
  const element = renderOgCardElement(data) as ReactNode;
  const svg = await satori(element, {
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    fonts: fonts as NonNullable<Parameters<typeof satori>[1]>["fonts"],
  });
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_SIZE.width },
  });
  return resvg.render().asPng();
}

export async function renderOgCardResponse(
  data: OgCardData,
  opts?: { cacheControl?: string },
): Promise<Response> {
  try {
    const png = await renderOgCardPng(data);
    return new Response(Buffer.from(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": opts?.cacheControl ?? OG_CACHE_CONTROL_DYNAMIC,
      },
    });
  } catch (err) {
    console.error("[og] render failed", err instanceof Error ? err.message : "unknown");
    return redirectToFallback(data.variant);
  }
}

export function redirectToFallback(variant: OgCardVariant): Response {
  const path = variantFallbackPath(variant);
  const url = absoluteSeoUrl(path);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": OG_CACHE_CONTROL_STATIC,
    },
  });
}

function optStr(v: string | null): string | undefined {
  return v == null || v === "" ? undefined : v;
}

export function parseOgQuery(searchParams: URLSearchParams): OgCardData {
  const variant = parseVariantParam(searchParams.get("v"));
  const tpl = SOCIAL_CARD_TEMPLATES[variant];
  const dnaRaw = searchParams.get("dna");
  let driveDna: NonNullable<OgCardData["driveDna"]> | undefined;
  if (dnaRaw) {
    const parts = dnaRaw.split(",").map((n) => Number(n.trim()));
    if (parts.length === 5 && parts.every((n) => Number.isFinite(n))) {
      driveDna = {
        energy: Math.max(0, Math.min(100, Math.round(parts[0]!))),
        flow: Math.max(0, Math.min(100, Math.round(parts[1]!))),
        rhythm: Math.max(0, Math.min(100, Math.round(parts[2]!))),
        variation: Math.max(0, Math.min(100, Math.round(parts[3]!))),
        regen: Math.max(0, Math.min(100, Math.round(parts[4]!))),
      };
    }
  }
  const partial: Partial<OgCardData> & { variant: OgCardVariant } = {
    variant,
    title: optStr(searchParams.get("title")) ?? tpl.defaultTitle,
  };
  const eyebrow = optStr(searchParams.get("eyebrow"));
  const subtitle = optStr(searchParams.get("subtitle"));
  const footer = optStr(searchParams.get("footer"));
  const experienceName = optStr(searchParams.get("experience"));
  const archetype = optStr(searchParams.get("archetype"));
  const imageSeed = optStr(searchParams.get("seed"));
  if (eyebrow) partial.eyebrow = eyebrow;
  if (subtitle) partial.subtitle = subtitle;
  if (footer) partial.footer = footer;
  if (experienceName) partial.experienceName = experienceName;
  if (archetype) partial.archetype = archetype;
  if (imageSeed) partial.imageSeed = imageSeed;
  if (driveDna) partial.driveDna = driveDna;
  const energyRaw = searchParams.get("energy");
  if (energyRaw) {
    const samples = energyRaw
      .split(",")
      .map((n) => Math.max(0, Math.min(1, Number(n.trim()))))
      .filter((n) => Number.isFinite(n))
      .slice(0, 48);
    if (samples.length >= 4) partial.energySamples = samples;
  }
  return normalizeOgCardData(partial);
}

export function isOgCardVariant(v: string): v is OgCardVariant {
  return v in SOCIAL_CARD_TEMPLATES;
}

export type { OgCardData, OgCardVariant };
