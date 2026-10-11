import type { ProfileFamily } from "@/lib/sound/realism/families";
import type {
  AcousticAspirationDynamics,
  AcousticCapability,
  AcousticCycleGeometry,
  AcousticEventGates,
  AcousticHeadroomRecipe,
  AcousticLayerRecipe,
  AcousticListeningAcceptance,
  AcousticLoudnessLimits,
  AcousticPhaseMix,
  AcousticProfileSpec,
  AcousticRecipe,
  AcousticRendererKind,
  AcousticSampleBankRecipe,
  AcousticVirtualTransmissionRecipe,
} from "@/lib/sound/profile-specs/types";
import { familyDefaultsFor } from "@/lib/sound/profile-specs/family-defaults";
import { buildAcousticRecipe } from "@/lib/sound/profile-specs/recipe-build";

const FAMILIES: readonly ProfileFamily[] = ["physical", "designed", "environmental", "musical"];

const RENDERER_KINDS: readonly AcousticRendererKind[] = [
  "combustion-hybrid-v2",
  "combustion-improved",
  "electric-designed",
  "creature-cinematic",
  "environmental-ambient",
  "musical",
  "physical-machine",
  "symphony",
  "world",
  "fusion",
];

const CAPABILITIES: readonly AcousticCapability[] = [
  "virtual-transmission",
  "forced-induction",
  "regen-identity",
  "combustion-events",
  "combustion-shift-accents",
  "sample-bank",
  "continuous-motion",
  "musical-grammar",
];

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampPhase(phases: AcousticPhaseMix): AcousticPhaseMix {
  return {
    idleCharacter: clamp(phases.idleCharacter, 0, 2),
    pullAwayTexture: clamp(phases.pullAwayTexture, 0, 2),
    accelerationTexture: clamp(phases.accelerationTexture, 0, 2),
    cruiseIntrusiveScale: clamp(phases.cruiseIntrusiveScale, 0, 2),
    releaseCharacter: clamp(phases.releaseCharacter, 0, 2),
    regenCharacter: clamp(phases.regenCharacter, 0, 2),
    stopTail: clamp(phases.stopTail, 0, 2),
  };
}

function clampAspiration(d: AcousticAspirationDynamics): AcousticAspirationDynamics {
  return {
    attackSeconds: clamp(d.attackSeconds, 0, 8),
    decaySeconds: clamp(d.decaySeconds, 0, 8),
    minimumReleaseState: clamp(d.minimumReleaseState, 0, 1),
    speedRatio: clamp(d.speedRatio, 0, 4),
  };
}

function clampEvents(events: AcousticEventGates): AcousticEventGates {
  return {
    variationDepth: clamp(events.variationDepth, 0, 0.2),
    minEventCooldownSeconds: clamp(events.minEventCooldownSeconds, 0, 120),
    maxEventVoices: Math.round(clamp(events.maxEventVoices, 0, 8)),
  };
}

function clampLoudness(loudness: AcousticLoudnessLimits): AcousticLoudnessLimits {
  return {
    profileTrim: clamp(loudness.profileTrim, 0.4, 1.6),
    maxGainCeiling: clamp(loudness.maxGainCeiling, 0.2, 0.85),
  };
}

function isFamily(value: unknown): value is ProfileFamily {
  return typeof value === "string" && (FAMILIES as readonly string[]).includes(value);
}

function clampCycle(cycle: AcousticCycleGeometry | undefined): AcousticCycleGeometry {
  const stroke =
    cycle?.stroke === "four-stroke" || cycle?.stroke === "two-stroke" || cycle?.stroke === "none"
      ? cycle.stroke
      : "none";
  const bankRouting =
    cycle?.bankRouting === "inline" ||
    cycle?.bankRouting === "v90" ||
    cycle?.bankRouting === "v60" ||
    cycle?.bankRouting === "flat" ||
    cycle?.bankRouting === "single" ||
    cycle?.bankRouting === "none"
      ? cycle.bankRouting
      : "none";
  const cylinders = Math.round(clamp(cycle?.cylinders ?? 0, 0, 16));
  const cycleDegrees =
    stroke === "four-stroke" ? 720 : stroke === "two-stroke" ? 360 : 0;
  return {
    cylinders: stroke === "none" ? 0 : Math.max(0, cylinders),
    stroke,
    cycleDegrees,
    bankRouting: stroke === "none" ? "none" : bankRouting,
    architecture: typeof cycle?.architecture === "string" ? cycle.architecture : null,
    // Real RPM only — never treat as normalized 0..1.
    idleRpm: clamp(cycle?.idleRpm ?? 0, 0, 20000),
    maxRpm: clamp(cycle?.maxRpm ?? 0, 0, 20000),
    harmonicOrderWeights: Array.isArray(cycle?.harmonicOrderWeights)
      ? cycle!.harmonicOrderWeights.map((w) => clamp(w, 0, 1)).slice(0, 16)
      : [],
    cycleVariation: clamp(cycle?.cycleVariation ?? 0, 0, 1),
  };
}

function clampLayer(layer: AcousticLayerRecipe): AcousticLayerRecipe {
  return {
    role: layer.role,
    gains: {
      idle: clamp(layer.gains?.idle ?? 0, 0, 2),
      cruise: clamp(layer.gains?.cruise ?? 0, 0, 2),
      onLoad: clamp(layer.gains?.onLoad ?? 0, 0, 2),
      overrun: clamp(layer.gains?.overrun ?? 0, 0, 2),
    },
    filterLowpassHz:
      layer.filterLowpassHz == null ? null : clamp(layer.filterLowpassHz, 40, 20000),
    filterHighpassHz:
      layer.filterHighpassHz == null ? null : clamp(layer.filterHighpassHz, 10, 8000),
    saturation: clamp(layer.saturation ?? 0, 0, 1),
    rpmTimbreResponse: clamp(layer.rpmTimbreResponse ?? 0, 0, 1),
    loadTimbreResponse: clamp(layer.loadTimbreResponse ?? 0, 0, 1),
  };
}

function clampVt(
  vt: AcousticVirtualTransmissionRecipe | undefined,
  gearlessFallback: boolean,
): AcousticVirtualTransmissionRecipe {
  const enabled = Boolean(vt?.enabled) && !gearlessFallback;
  if (!enabled) {
    return {
      enabled: false,
      gearRatios: [],
      finalDrive: 1,
      wheelCircumferenceM: clamp(vt?.wheelCircumferenceM ?? 2, 0.5, 5),
      shiftMode: "none",
      upshiftThresholdsKmh: [],
      downshiftThresholdsKmh: [],
      hysteresisKmh: 0,
      torqueCutMs: 0,
      recoveryMs: 0,
      downshiftBlip: 0,
      minGearDwellSeconds: 0,
      eventCooldownSeconds: clamp(vt?.eventCooldownSeconds ?? 0, 0, 120),
      allowCombustionShiftAccents: false,
    };
  }
  return {
    enabled: true,
    gearRatios: Array.isArray(vt?.gearRatios)
      ? vt!.gearRatios.map((r) => clamp(r, 0.2, 12)).slice(0, 10)
      : [],
    finalDrive: clamp(vt?.finalDrive ?? 1, 0.5, 12),
    wheelCircumferenceM: clamp(vt?.wheelCircumferenceM ?? 2, 0.5, 5),
    shiftMode: "automatic",
    upshiftThresholdsKmh: Array.isArray(vt?.upshiftThresholdsKmh)
      ? vt!.upshiftThresholdsKmh.map((s) => clamp(s, 0, 400)).slice(0, 10)
      : [],
    downshiftThresholdsKmh: Array.isArray(vt?.downshiftThresholdsKmh)
      ? vt!.downshiftThresholdsKmh.map((s) => clamp(s, 0, 400)).slice(0, 10)
      : [],
    hysteresisKmh: clamp(vt?.hysteresisKmh ?? 0, 0, 40),
    torqueCutMs: clamp(vt?.torqueCutMs ?? 0, 0, 800),
    recoveryMs: clamp(vt?.recoveryMs ?? 0, 0, 1000),
    downshiftBlip: clamp(vt?.downshiftBlip ?? 0, 0, 1),
    minGearDwellSeconds: clamp(vt?.minGearDwellSeconds ?? 0, 0, 5),
    eventCooldownSeconds: clamp(vt?.eventCooldownSeconds ?? 0, 0, 120),
    allowCombustionShiftAccents: Boolean(vt?.allowCombustionShiftAccents),
  };
}

function clampSampleBank(bank: AcousticSampleBankRecipe | undefined): AcousticSampleBankRecipe {
  const stretchMin = clamp(bank?.permissibleStretch?.min ?? 0.85, 0.5, 1.5);
  const stretchMax = clamp(bank?.permissibleStretch?.max ?? 1.18, stretchMin, 2);
  return {
    personalityHint:
      typeof bank?.personalityHint === "string" ? bank.personalityHint : null,
    approvedAssetsPresent: Boolean(bank?.approvedAssetsPresent),
    sourceRpmAnchors: Array.isArray(bank?.sourceRpmAnchors)
      ? bank!.sourceRpmAnchors.map((r) => clamp(r, 0, 20000)).slice(0, 32)
      : [],
    loadRegimes: Array.isArray(bank?.loadRegimes)
      ? bank!.loadRegimes.filter((r): r is string => typeof r === "string").slice(0, 16)
      : [],
    loopBoundariesSeconds: Array.isArray(bank?.loopBoundariesSeconds)
      ? bank!.loopBoundariesSeconds
          .map((b) => ({
            start: clamp(b?.start ?? 0, 0, 600),
            end: clamp(b?.end ?? 0, 0, 600),
          }))
          .slice(0, 32)
      : [],
    permissibleStretch: { min: stretchMin, max: stretchMax },
    provenance:
      typeof bank?.provenance === "string" && bank.provenance.length > 0
        ? bank.provenance
        : "Procedural fallback is authoritative.",
    proceduralFallback: true,
  };
}

function clampHeadroom(h: AcousticHeadroomRecipe | undefined): AcousticHeadroomRecipe {
  return {
    profileTrim: clamp(h?.profileTrim ?? 1, 0.4, 1.6),
    maxGainCeiling: clamp(h?.maxGainCeiling ?? 0.85, 0.2, 0.85),
    userVolumeMin: clamp(h?.userVolumeMin ?? 0, 0, 1),
    userVolumeMax: clamp(h?.userVolumeMax ?? 1, 0, 1),
    antiHarshnessHighShelfHz:
      h?.antiHarshnessHighShelfHz == null
        ? null
        : clamp(h.antiHarshnessHighShelfHz, 1000, 16000),
    antiHarshnessGainDb: clamp(h?.antiHarshnessGainDb ?? 0, -12, 0),
  };
}

function clampListening(l: AcousticListeningAcceptance | undefined): AcousticListeningAcceptance {
  const verdict =
    l?.listeningVerdict === "approved" ||
    l?.listeningVerdict === "rejected" ||
    l?.listeningVerdict === "pending"
      ? l.listeningVerdict
      : "pending";
  return {
    listeningVerdict: verdict,
    notes: typeof l?.notes === "string" ? l.notes : "Not listening-verified.",
  };
}

function clampRecipe(recipe: AcousticRecipe | undefined, profileId: string): AcousticRecipe {
  const fallback = buildAcousticRecipe(profileId || "unknown");
  const src = recipe ?? fallback;
  const rendererKind =
    typeof src.rendererKind === "string" &&
    (RENDERER_KINDS as readonly string[]).includes(src.rendererKind)
      ? src.rendererKind
      : fallback.rendererKind;

  const capabilities = Array.isArray(src.capabilities)
    ? src.capabilities.filter((c): c is AcousticCapability =>
        (CAPABILITIES as readonly string[]).includes(c),
      )
    : fallback.capabilities;

  // Disabled VT must never retain combustion shift accents (gearless safety).
  const vt = clampVt(src.virtualTransmission, src.virtualTransmission?.enabled !== true);
  const safeCapabilities = capabilities.filter((c) => {
    if (vt.enabled) return true;
    return c !== "combustion-shift-accents" && c !== "virtual-transmission";
  });

  if (!vt.enabled) vt.allowCombustionShiftAccents = false;

  const familyDefaultsId =
    typeof src.inheritance?.familyDefaultsId === "string" &&
    src.inheritance.familyDefaultsId.startsWith("foundation:")
      ? src.inheritance.familyDefaultsId
      : fallback.inheritance.familyDefaultsId;

  // Ensure foundation id is known; otherwise fall back.
  try {
    familyDefaultsFor(familyDefaultsId as Parameters<typeof familyDefaultsFor>[0]);
  } catch {
    // ignore — string already validated via fallback path below
  }

  return {
    rendererKind,
    capabilities: Array.from(new Set(safeCapabilities)).sort(),
    inheritance: {
      familyDefaultsId:
        typeof familyDefaultsId === "string" ? familyDefaultsId : fallback.inheritance.familyDefaultsId,
      overrides: Array.isArray(src.inheritance?.overrides)
        ? src.inheritance!.overrides.filter((o): o is string => typeof o === "string").slice(0, 200)
        : fallback.inheritance.overrides,
    },
    cycle: clampCycle(src.cycle),
    layerRecipes: Array.isArray(src.layerRecipes)
      ? src.layerRecipes.map(clampLayer).slice(0, 16)
      : fallback.layerRecipes.map(clampLayer),
    virtualTransmission: vt,
    sampleBankRecipe: clampSampleBank(src.sampleBankRecipe),
    headroom: clampHeadroom(src.headroom),
    listening: clampListening(src.listening),
  };
}

/**
 * Clamp numeric limits and repair invalid family labels without inventing new recipes.
 * Safe fallbacks never change SoundEngine / familyForProfile behaviour by themselves.
 */
export function validateAcousticProfileSpec(spec: AcousticProfileSpec): AcousticProfileSpec {
  const family = isFamily(spec.family) ? spec.family : "physical";
  const packageFamily = isFamily(spec.packageFamily) ? spec.packageFamily : family;
  const mismatch =
    family === packageFamily
      ? null
      : spec.familyMismatch &&
          isFamily(spec.familyMismatch.runtimeFamily) &&
          isFamily(spec.familyMismatch.packageFamily)
        ? {
            ...spec.familyMismatch,
            runtimeFamily: family,
            packageFamily,
          }
        : {
            runtimeFamily: family,
            packageFamily,
            deferredReason:
              spec.familyMismatch?.deferredReason ??
              "Package and runtime families differ; runtime family preserved for routing.",
            documentation:
              spec.familyMismatch?.documentation ?? "docs/FAMILY_CLASSIFICATION_MISMATCHES.md",
          };

  const drivetrainMode =
    spec.regimes?.drivetrainMode === "virtual-transmission" ||
    spec.regimes?.drivetrainMode === "continuous"
      ? spec.regimes.drivetrainMode
      : "continuous";

  const id = typeof spec.id === "string" && spec.id.length > 0 ? spec.id : "unknown";

  return {
    ...spec,
    id,
    family,
    packageFamily,
    familyMismatch: mismatch,
    layers: {
      roles: Array.isArray(spec.layers?.roles) ? spec.layers.roles : ["core"],
    },
    controls: {
      pitchDriver: spec.controls?.pitchDriver ?? "energy",
      loadDriver: spec.controls?.loadDriver ?? "motion-energy",
    },
    regimes: {
      drivetrainMode,
      motionModel: spec.regimes?.motionModel ?? null,
      drivetrainPersonalityId:
        typeof spec.regimes?.drivetrainPersonalityId === "string"
          ? spec.regimes.drivetrainPersonalityId
          : null,
      phaseKeys: Array.isArray(spec.regimes?.phaseKeys)
        ? spec.regimes.phaseKeys
        : [
            "idleCharacter",
            "pullAwayTexture",
            "accelerationTexture",
            "cruiseIntrusiveScale",
            "releaseCharacter",
            "regenCharacter",
            "stopTail",
          ],
      hasForcedInductionDynamics: Boolean(spec.regimes?.hasForcedInductionDynamics),
      realismV2Combustion: Boolean(spec.regimes?.realismV2Combustion),
    },
    dsp: {
      transitionTauSeconds: clamp(spec.dsp?.transitionTauSeconds ?? 0.16, 0.02, 2),
      aspiration: spec.dsp?.aspiration ?? "unknown",
      aspirationDynamics: clampAspiration(
        spec.dsp?.aspirationDynamics ?? {
          attackSeconds: 0,
          decaySeconds: 0,
          minimumReleaseState: 0,
          speedRatio: 0,
        },
      ),
      phases: clampPhase(
        spec.dsp?.phases ?? {
          idleCharacter: 1,
          pullAwayTexture: 1,
          accelerationTexture: 1,
          cruiseIntrusiveScale: 0.72,
          releaseCharacter: 0.65,
          regenCharacter: 0,
          stopTail: 0.5,
        },
      ),
    },
    events: clampEvents(
      spec.events ?? {
        variationDepth: 0.025,
        minEventCooldownSeconds: 4,
        maxEventVoices: 2,
      },
    ),
    loudness: clampLoudness(
      spec.loudness ?? { profileTrim: 1, maxGainCeiling: 0.85 },
    ),
    sampleBank: {
      personalityHint:
        typeof spec.sampleBank?.personalityHint === "string"
          ? spec.sampleBank.personalityHint
          : null,
      approvedAssetsPresent: Boolean(spec.sampleBank?.approvedAssetsPresent),
    },
    acceptance: {
      physics: spec.acceptance?.physics ?? "intentional-design",
      status: spec.acceptance?.status ?? "procedural upgrade",
    },
    recipe: clampRecipe(spec.recipe, id),
  };
}
