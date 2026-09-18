import type {
  ExperiencePreset,
  FusionStudioParams,
  StudioMode,
  SymphonyStudioParams,
} from "./types";
import { ensureViableInstruments } from "./symphony-params";
import { normalizeFusionParams } from "./fusion-params";

interface ExperiencePresetShareV1 {
  v: 1;
  kind: StudioMode;
  name: string;
  note?: string;
  soundId?: string;
  baseProfileId?: string;
  symphonyPackId?: string;
  symphonyParams?: SymphonyStudioParams;
  fusionParams?: FusionStudioParams;
}

function encodeUtf8Base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeUtf8Base64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function parseSymphonyParams(value: unknown): SymphonyStudioParams | null {
  if (!isRecord(value) || !isRecord(value["instruments"]) || !isRecord(value["stemMix"])) {
    return null;
  }
  const unitKeys = ["energy", "build", "rhythm", "melody", "drama", "variation"] as const;
  if (unitKeys.some((key) => !finiteInRange(value[key], 0, 1))) return null;
  if (!finiteInRange(value["transitionFrequency"], 0, 1)) return null;
  if (!finiteInRange(value["fillFrequency"], 0, 1)) return null;
  if (!finiteInRange(value["climaxSensitivity"], 0, 1)) return null;
  if (!finiteInRange(value["minSectionDuration"], 0.25, 30)) return null;

  const instruments = ensureViableInstruments({
    drums: value["instruments"]["drums"] === true,
    bass: value["instruments"]["bass"] === true,
    guitar: value["instruments"]["guitar"] === true,
    strings: value["instruments"]["strings"] === true,
    lead: value["instruments"]["lead"] === true,
    atmosphere: value["instruments"]["atmosphere"] === true,
  });
  const stemMix: SymphonyStudioParams["stemMix"] = {};
  for (const [key, mix] of Object.entries(value["stemMix"])) {
    if (finiteInRange(mix, 0, 1)) stemMix[key as keyof typeof stemMix] = mix;
  }

  return {
    energy: value["energy"] as number,
    build: value["build"] as number,
    rhythm: value["rhythm"] as number,
    melody: value["melody"] as number,
    drama: value["drama"] as number,
    variation: value["variation"] as number,
    instruments,
    transitionFrequency: value["transitionFrequency"],
    fillFrequency: value["fillFrequency"],
    climaxSensitivity: value["climaxSensitivity"],
    minSectionDuration: value["minSectionDuration"],
    stemMix,
  };
}

function parseFusionParams(value: unknown): FusionStudioParams | null {
  if (!isRecord(value)) return null;
  if (
    typeof value["machineProfileId"] !== "string" ||
    typeof value["symphonyProfileId"] !== "string"
  ) {
    return null;
  }
  const keys = ["mix", "machinePresence", "musicEnergy", "shiftEmphasis", "harmonicResonance"];
  if (keys.some((key) => !finiteInRange(value[key], 0, 1))) return null;
  return normalizeFusionParams(value as unknown as FusionStudioParams);
}

export function encodeExperiencePresetShare(preset: ExperiencePreset): string {
  const payload: ExperiencePresetShareV1 = {
    v: 1,
    kind: preset.kind,
    name: preset.name.slice(0, 64),
    ...(preset.note ? { note: preset.note.slice(0, 240) } : {}),
    ...(preset.soundId ? { soundId: preset.soundId } : {}),
    ...(preset.baseProfileId ? { baseProfileId: preset.baseProfileId } : {}),
    ...(preset.symphonyPackId ? { symphonyPackId: preset.symphonyPackId } : {}),
    ...(preset.symphonyParams ? { symphonyParams: preset.symphonyParams } : {}),
    ...(preset.fusionParams ? { fusionParams: preset.fusionParams } : {}),
  };
  return encodeUtf8Base64Url(JSON.stringify(payload));
}

export function decodeExperiencePresetShare(encoded: string): ExperiencePreset | null {
  if (!encoded || encoded.length > 16_000) return null;
  try {
    const raw: unknown = JSON.parse(decodeUtf8Base64Url(encoded));
    if (!isRecord(raw) || raw["v"] !== 1) return null;
    if (raw["kind"] !== "sound" && raw["kind"] !== "symphony" && raw["kind"] !== "fusion") {
      return null;
    }
    if (typeof raw["name"] !== "string" || !raw["name"].trim()) return null;
    const name = raw["name"].trim().slice(0, 64);
    const note = typeof raw["note"] === "string" ? raw["note"].slice(0, 240) : undefined;
    const base: ExperiencePreset = {
      id: `shared-${raw["kind"]}-${Date.now().toString(36)}`,
      kind: raw["kind"],
      name,
      createdAt: Date.now(),
      ...(note ? { note } : {}),
    };

    if (raw["kind"] === "symphony") {
      const params = parseSymphonyParams(raw["symphonyParams"]);
      if (!params || typeof raw["symphonyPackId"] !== "string") return null;
      return {
        ...base,
        symphonyPackId: raw["symphonyPackId"],
        baseProfileId: raw["symphonyPackId"],
        symphonyParams: params,
      };
    }
    if (raw["kind"] === "fusion") {
      const params = parseFusionParams(raw["fusionParams"]);
      if (!params) return null;
      return { ...base, baseProfileId: base.id, fusionParams: params };
    }

    const baseProfileId =
      typeof raw["baseProfileId"] === "string" ? raw["baseProfileId"] : undefined;
    const soundId = typeof raw["soundId"] === "string" ? raw["soundId"] : undefined;
    if (!baseProfileId && !soundId) return null;
    return {
      ...base,
      ...(baseProfileId ? { baseProfileId } : {}),
      ...(soundId ? { soundId } : {}),
    };
  } catch {
    return null;
  }
}
