import { resolveDrivetrain } from "@/lib/drive/drivetrain-resolve";
import { loudnessForProfile } from "@/lib/sound/realism/loudness";
import {
  profileExperienceConfig,
  type ProfileExperienceConfig,
} from "@/lib/sound/profile-experience-config";
import { getProfile, type SoundProfile } from "@/lib/sound/profiles";
import {
  cloneFamilyDefaults,
  familyDefaultsFor,
  type AcousticFamilyDefaultsId,
} from "@/lib/sound/profile-specs/family-defaults";
import type {
  AcousticCapability,
  AcousticCycleGeometry,
  AcousticLayerRecipe,
  AcousticRecipe,
  AcousticRendererKind,
  AcousticSampleBankRecipe,
  AcousticVirtualTransmissionRecipe,
} from "@/lib/sound/profile-specs/types";
import {
  acousticEngineForProfile,
  isCombustionRealismV2Profile,
  type AcousticEngineConfig,
  type BankConfiguration,
} from "@/lib/sound/realism/v2/acoustic-engine";
import {
  EMPTY_COMBUSTION_SAMPLE_BANKS,
  SAMPLE_RATE_MAX,
  SAMPLE_RATE_MIN,
} from "@/lib/sound/realism/v2/sample-bank";
import { generateShiftMap } from "@/lib/powertrain/shift-map";
import { speedKmhFromRpmAndGear } from "@/lib/powertrain/rpm-model";

const REALISM_V2_IDS = new Set([
  "gt-v8",
  "f1-v10",
  "american-muscle-v8",
  "flat-six-sport",
  "turbo-inline-6",
  "racing-v10",
  "race-car",
  "rally-car",
  "motorcycle-superbike",
  "big-twin",
]);

const ELECTRIC_IDS = new Set([
  "cyber-pulse",
  "electric-hypercar",
  "formula-electric",
  "maglev-train",
  "space-ship",
  "ufo",
]);

const CREATURE_IDS = new Set([
  "dragon",
  "thunder-beast",
  "horse-gallop",
  "laughing-machine",
  "farting-car",
  "kazoo-kart",
  "santa-sleigh",
]);

const MUSICAL_IDS = new Set([
  "neon-drive",
  "retro-arcade",
  "synthwave-drive",
  "deep-bass-pulse",
  "heartbeat",
]);

const AMBIENT_IDS = new Set([
  "open-wind",
  "storm-glider",
  "rain-drive",
  "ocean-drive",
  "zen-drive",
  "wild-west-carriage",
  "romanian-85-carriage",
]);

const FORCED_INDUCTION_IDS = new Set(["turbo-inline-6", "rally-car"]);

function bankRoutingFrom(banks: BankConfiguration | undefined): AcousticCycleGeometry["bankRouting"] {
  if (!banks) return "none";
  return banks;
}

function foundationFor(
  profileId: string,
  rendererKind: AcousticRendererKind,
): AcousticFamilyDefaultsId {
  switch (rendererKind) {
    case "combustion-hybrid-v2":
      return "foundation:combustion-hybrid-v2";
    case "combustion-improved":
      return "foundation:combustion-improved";
    case "electric-designed":
      return "foundation:electric-designed";
    case "creature-cinematic":
      return "foundation:creature-cinematic";
    case "environmental-ambient":
      return "foundation:environmental-ambient";
    case "musical":
      return "foundation:musical";
    case "physical-machine":
      return "foundation:physical-machine";
    case "symphony":
      return "foundation:symphony";
    case "world":
      return "foundation:world";
    case "fusion":
      return "foundation:fusion";
    default:
      return profileId.startsWith("symphony-")
        ? "foundation:symphony"
        : "foundation:physical-machine";
  }
}

export function rendererKindForProfile(profileId: string): AcousticRendererKind {
  if (profileId.startsWith("symphony-")) return "symphony";
  if (profileId.startsWith("world-")) return "world";
  if (profileId.startsWith("fusion-")) return "fusion";
  if (REALISM_V2_IDS.has(profileId)) return "combustion-hybrid-v2";
  if (profileId === "wiesn-tractor") return "combustion-improved";
  if (ELECTRIC_IDS.has(profileId)) return "electric-designed";
  if (CREATURE_IDS.has(profileId)) return "creature-cinematic";
  if (MUSICAL_IDS.has(profileId)) return "musical";
  if (AMBIENT_IDS.has(profileId)) return "environmental-ambient";
  return "physical-machine";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildVtFromPersonality(
  profile: SoundProfile,
  allowCombustionShiftAccents: boolean,
): AcousticVirtualTransmissionRecipe | null {
  if (profile.drivetrainMode !== "virtual-transmission") return null;
  try {
    const resolved = resolveDrivetrain(profile);
    const powertrain = resolved.powertrain;
    const personality = resolved.personality;
    const map = generateShiftMap(powertrain);
    const upshiftThresholdsKmh = map.upshiftSpeedKmh.map((row) => round1(row[0] ?? 0));
    const downshiftThresholdsKmh = map.downshiftSpeedKmh.map((row) => round1(row[0] ?? 0));

    let hysteresisKmh = 4;
    if (upshiftThresholdsKmh.length > 0) {
      const gear = 1;
      const upRpm = personality.transmission.upshiftRpm.lowLoad;
      const hRpm = personality.transmission.upshiftHysteresisRpm;
      const a = speedKmhFromRpmAndGear(upRpm, gear, powertrain);
      const b = speedKmhFromRpmAndGear(Math.max(0, upRpm - hRpm), gear, powertrain);
      hysteresisKmh = round1(Math.max(1, Math.abs(a - b)));
    }

    return {
      enabled: true,
      gearRatios: [...personality.transmission.gearRatios],
      finalDrive: personality.transmission.finalDrive,
      wheelCircumferenceM: personality.wheelCircumferenceM,
      shiftMode: "automatic",
      upshiftThresholdsKmh,
      downshiftThresholdsKmh,
      hysteresisKmh,
      torqueCutMs: personality.transmission.shift.upshiftDurationMs,
      recoveryMs: personality.transmission.shift.downshiftDurationMs,
      downshiftBlip: personality.transmission.shift.revMatchEnabled
        ? personality.transient.revMatchStrength
        : 0,
      minGearDwellSeconds: personality.transmission.shift.minGearHoldMs / 1000,
      eventCooldownSeconds: Math.max(
        0.4,
        (personality.transmission.shift.shiftLockoutMs ?? 90) / 1000,
      ),
      allowCombustionShiftAccents,
    };
  } catch {
    return null;
  }
}

function cycleFromEngine(
  engine: AcousticEngineConfig,
  idleRpm: number,
): AcousticCycleGeometry {
  return {
    cylinders: engine.cylinders,
    stroke: engine.stroke,
    cycleDegrees: engine.stroke === "two-stroke" ? 360 : 720,
    bankRouting: bankRoutingFrom(engine.banks),
    architecture: engine.architecture,
    idleRpm,
    maxRpm: engine.redlineRpm,
    harmonicOrderWeights: engine.supportWeights.map((w) => Math.min(1, Math.max(0, w))),
    cycleVariation: Math.min(1, Math.max(0, engine.idleIrregularity)),
  };
}

function scaleLayerGains(
  layers: AcousticLayerRecipe[],
  engine: AcousticEngineConfig | null,
  experience: ProfileExperienceConfig | null,
): AcousticLayerRecipe[] {
  if (!engine) {
    return layers.map((layer) => {
      if (!experience) return { ...layer, gains: { ...layer.gains } };
      const accel = experience.phases.accelerationTexture;
      const cruise = experience.phases.cruiseIntrusiveScale;
      const release = experience.phases.releaseCharacter;
      return {
        ...layer,
        gains: {
          idle: layer.gains.idle * experience.phases.idleCharacter,
          cruise: layer.gains.cruise * cruise,
          onLoad: layer.gains.onLoad * accel,
          overrun: layer.gains.overrun * release,
        },
        rpmTimbreResponse: layer.rpmTimbreResponse,
        loadTimbreResponse: layer.loadTimbreResponse,
      };
    });
  }

  return layers.map((layer) => {
    const next = { ...layer, gains: { ...layer.gains } };
    if (layer.role === "exhaust-body") {
      next.gains.onLoad *= 0.85 + engine.exhaustPulse * 0.3;
      next.gains.idle *= 0.85 + engine.exhaustPulse * 0.25;
      next.loadTimbreResponse = engine.loadContrast;
      next.rpmTimbreResponse = engine.upperRpmEnergy;
      next.saturation = Math.min(1, 0.08 + engine.combustionSharpness * 0.2);
      if (engine.exhaustFormantsHz[0]) {
        next.filterHighpassHz = Math.max(30, engine.exhaustFormantsHz[0] * 0.35);
      }
    }
    if (layer.role === "intake") {
      next.gains.onLoad *= 0.7 + engine.intakePresence * 0.5;
      next.loadTimbreResponse = engine.intakeLoadResponse;
      next.rpmTimbreResponse = Math.min(1, engine.upperRpmEnergy + 0.15);
      if (engine.intakeFormantsHz[0]) {
        next.filterHighpassHz = Math.max(80, engine.intakeFormantsHz[0] * 0.25);
      }
    }
    if (layer.role === "mechanical") {
      next.gains.cruise *= 0.75 + engine.mechanicalIntensity * 0.5;
      next.gains.onLoad *= 0.75 + engine.mechanicalIntensity * 0.55;
    }
    if (layer.role === "induction") {
      if (!engine.forcedInduction) {
        next.gains = { idle: 0, cruise: 0, onLoad: 0.05, overrun: 0.02 };
        next.saturation = 0.02;
      } else {
        next.gains.onLoad *= 1.1;
        next.loadTimbreResponse = Math.min(1, 0.75 + engine.intakeLoadResponse * 0.2);
      }
    }
    if (layer.role === "event") {
      next.gains.overrun *= 0.6 + engine.overrunCharacter * 0.6;
    }
    if (experience) {
      next.gains.idle *= experience.phases.idleCharacter;
      next.gains.cruise *= experience.phases.cruiseIntrusiveScale;
      next.gains.onLoad *= experience.phases.accelerationTexture;
      next.gains.overrun *= experience.phases.releaseCharacter;
    }
    return next;
  });
}

function sampleBankRecipeFor(
  personalityHint: string | null,
): AcousticSampleBankRecipe {
  const bank =
    personalityHint && EMPTY_COMBUSTION_SAMPLE_BANKS[personalityHint]
      ? EMPTY_COMBUSTION_SAMPLE_BANKS[personalityHint]
      : null;
  const entries = bank?.entries ?? [];
  const approvedAssetsPresent = entries.length > 0;
  const sourceRpmAnchors = Array.from(new Set(entries.map((e) => e.rpmRef))).sort((a, b) => a - b);
  const loadRegimes = Array.from(new Set(entries.map((e) => e.load)));
  const loopBoundariesSeconds = entries
    .filter((e) => e.loopSeconds)
    .map((e) => ({ start: e.loopSeconds!.start, end: e.loopSeconds!.end }));
  let stretchMin = SAMPLE_RATE_MIN;
  let stretchMax = SAMPLE_RATE_MAX;
  for (const e of entries) {
    if (e.permittedPlaybackRate) {
      stretchMin = Math.min(stretchMin, e.permittedPlaybackRate.min);
      stretchMax = Math.max(stretchMax, e.permittedPlaybackRate.max);
    }
  }
  return {
    personalityHint,
    approvedAssetsPresent,
    sourceRpmAnchors,
    loadRegimes,
    loopBoundariesSeconds,
    permissibleStretch: { min: stretchMin, max: stretchMax },
    provenance: approvedAssetsPresent
      ? `Approved sample entries present for personality ${personalityHint}; procedural fallback remains available.`
      : personalityHint
        ? `Personality ${personalityHint} sample bank empty or unapproved; procedural fallback is authoritative.`
        : "No sample personality hook; procedural fallback is authoritative.",
    proceduralFallback: true,
  };
}

function pathsDiffer(a: unknown, b: unknown, prefix: string, out: string[]): void {
  if (a === b) return;
  if (
    a == null ||
    b == null ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) ||
    Array.isArray(b)
  ) {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(prefix);
    return;
  }
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const key of keys) {
    pathsDiffer(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      prefix ? `${prefix}.${key}` : key,
      out,
    );
  }
}

/**
 * Build a distinct AcousticRecipe for a catalog (or unknown) Sound Profile id.
 * Metadata only — does not change audible routing.
 */
export function buildAcousticRecipe(profileId: string): AcousticRecipe {
  const profile = getProfile(profileId);
  const experience = profileExperienceConfig(profileId);
  const rendererKind = rendererKindForProfile(profileId);
  const foundationId = foundationFor(profileId, rendererKind);
  const foundation = familyDefaultsFor(foundationId);
  const baseline = cloneFamilyDefaults(foundation);

  const isGearless = profile.drivetrainMode !== "virtual-transmission";
  const isV2 = isCombustionRealismV2Profile(profileId);
  const allowCombustionShiftAccents =
    !isGearless && (isV2 || profileId === "wiesn-tractor");

  const capabilities = new Set<AcousticCapability>(foundation.capabilities);
  if (isGearless) {
    capabilities.delete("virtual-transmission");
    capabilities.delete("combustion-shift-accents");
    if (!isV2 && profileId !== "wiesn-tractor") {
      capabilities.delete("combustion-events");
    }
  }
  if (FORCED_INDUCTION_IDS.has(profileId) || experience?.aspiration === "turbocharged") {
    capabilities.add("forced-induction");
  }
  if (
    experience?.phases.regenCharacter &&
    experience.phases.regenCharacter > 0.2
  ) {
    capabilities.add("regen-identity");
  }
  if (isV2) {
    capabilities.add("sample-bank");
    capabilities.add("combustion-events");
    if (allowCombustionShiftAccents) capabilities.add("combustion-shift-accents");
  }
  if (profileId === "electric-hypercar") {
    capabilities.add("virtual-transmission");
    capabilities.delete("combustion-events");
    capabilities.delete("combustion-shift-accents");
  }
  if (profileId === "farting-car" || profileId === "kazoo-kart") {
    capabilities.add("virtual-transmission");
    capabilities.delete("combustion-events");
    capabilities.delete("combustion-shift-accents");
  }

  const engine = acousticEngineForProfile(profileId);
  let idleRpm = foundation.cycle.idleRpm;
  let maxRpm = foundation.cycle.maxRpm;
  let personalityHint: string | null = null;

  if (profile.drivetrainMode === "virtual-transmission" || profile.drivetrainPersonalityId) {
    try {
      const resolved = resolveDrivetrain(profile);
      personalityHint = resolved.personalityId;
      idleRpm = resolved.personality.engine.idleRpm;
      maxRpm = resolved.personality.engine.redlineRpm;
    } catch {
      personalityHint = profile.drivetrainPersonalityId ?? (isV2 ? profileId : null);
    }
  } else if (isV2) {
    personalityHint = profile.drivetrainPersonalityId ?? profileId;
  }

  let cycle = foundation.cycle;
  if (engine) {
    cycle = cycleFromEngine(engine, idleRpm || engine.redlineRpm * 0.12);
    cycle.maxRpm = maxRpm || engine.redlineRpm;
  } else if (profileId === "wiesn-tractor") {
    cycle = {
      cylinders: 1,
      stroke: "two-stroke",
      cycleDegrees: 360,
      bankRouting: "single",
      architecture: "single",
      idleRpm: idleRpm || 280,
      maxRpm: maxRpm || 650,
      harmonicOrderWeights: [1, 0.35, 0.18],
      cycleVariation: 0.22,
    };
  } else if (isGearless) {
    cycle = {
      cylinders: 0,
      stroke: "none",
      cycleDegrees: 0,
      bankRouting: "none",
      architecture: null,
      idleRpm: 0,
      maxRpm: 0,
      harmonicOrderWeights: [],
      cycleVariation: 0,
    };
  }

  const layerRecipes = scaleLayerGains(foundation.layerRecipes, engine, experience);

  let virtualTransmission = foundation.virtualTransmission;
  if (isGearless) {
    virtualTransmission = {
      enabled: false,
      gearRatios: [],
      finalDrive: 1,
      wheelCircumferenceM: foundation.virtualTransmission.wheelCircumferenceM,
      shiftMode: "none",
      upshiftThresholdsKmh: [],
      downshiftThresholdsKmh: [],
      hysteresisKmh: 0,
      torqueCutMs: 0,
      recoveryMs: 0,
      downshiftBlip: 0,
      minGearDwellSeconds: 0,
      eventCooldownSeconds: experience?.variation.minEventCooldownSeconds ?? 4,
      allowCombustionShiftAccents: false,
    };
  } else {
    const fromPersonality = buildVtFromPersonality(profile, allowCombustionShiftAccents);
    if (fromPersonality) {
      virtualTransmission = fromPersonality;
    } else {
      virtualTransmission = {
        ...foundation.virtualTransmission,
        allowCombustionShiftAccents,
      };
    }
    // Comedy / EV VT must never inherit combustion pops or RPM clacks.
    if (!allowCombustionShiftAccents) {
      virtualTransmission = {
        ...virtualTransmission,
        allowCombustionShiftAccents: false,
        downshiftBlip: profileId === "electric-hypercar" ? 0 : virtualTransmission.downshiftBlip * 0.35,
      };
    }
  }

  const sampleBankRecipe = sampleBankRecipeFor(
    isV2 || profileId === "american-muscle-v8" ? personalityHint : null,
  );

  const trim = loudnessForProfile(profileId);
  const headroom = {
    ...foundation.headroom,
    profileTrim: trim,
    maxGainCeiling: 0.85,
  };

  const recipe: AcousticRecipe = {
    rendererKind,
    capabilities: Array.from(capabilities).sort(),
    inheritance: {
      familyDefaultsId: foundationId,
      overrides: [],
    },
    cycle,
    layerRecipes,
    virtualTransmission,
    sampleBankRecipe,
    headroom,
    listening: {
      listeningVerdict: "pending",
      notes: `Recipe prepared for ${profileId}; listening verdict is not runtime configuration.`,
    },
  };

  const overrides: string[] = [];
  pathsDiffer(
    {
      rendererKind: baseline.rendererKind,
      capabilities: [...baseline.capabilities].sort(),
      cycle: baseline.cycle,
      layerRecipes: baseline.layerRecipes,
      virtualTransmission: baseline.virtualTransmission,
      sampleBankRecipe: {
        ...baseline.sampleBankRecipe,
        personalityHint: null,
      },
      headroom: { ...baseline.headroom, profileTrim: 1 },
    },
    {
      rendererKind: recipe.rendererKind,
      capabilities: recipe.capabilities,
      cycle: recipe.cycle,
      layerRecipes: recipe.layerRecipes,
      virtualTransmission: recipe.virtualTransmission,
      sampleBankRecipe: {
        ...recipe.sampleBankRecipe,
        personalityHint: recipe.sampleBankRecipe.personalityHint,
      },
      headroom: recipe.headroom,
    },
    "",
    overrides,
  );
  // Always record identity + gearless safety as explicit inheritance notes.
  overrides.push(`identity:${profileId}`);
  if (isGearless) overrides.push("gearless:allowCombustionShiftAccents=false");
  if (!allowCombustionShiftAccents && !isGearless) {
    overrides.push("vt:allowCombustionShiftAccents=false");
  }
  recipe.inheritance.overrides = Array.from(new Set(overrides.filter(Boolean))).sort();

  return recipe;
}
