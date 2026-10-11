import type {
  AcousticCapability,
  AcousticCycleGeometry,
  AcousticHeadroomRecipe,
  AcousticLayerRecipe,
  AcousticListeningAcceptance,
  AcousticRendererKind,
  AcousticSampleBankRecipe,
  AcousticVirtualTransmissionRecipe,
} from "@/lib/sound/profile-specs/types";

/** Foundation id used as recipe.inheritance.familyDefaultsId. */
export type AcousticFamilyDefaultsId =
  | "foundation:combustion-hybrid-v2"
  | "foundation:combustion-improved"
  | "foundation:electric-designed"
  | "foundation:creature-cinematic"
  | "foundation:environmental-ambient"
  | "foundation:musical"
  | "foundation:physical-machine"
  | "foundation:symphony"
  | "foundation:world"
  | "foundation:fusion";

export interface AcousticFamilyDefaults {
  id: AcousticFamilyDefaultsId;
  rendererKind: AcousticRendererKind;
  capabilities: AcousticCapability[];
  cycle: AcousticCycleGeometry;
  layerRecipes: AcousticLayerRecipe[];
  virtualTransmission: AcousticVirtualTransmissionRecipe;
  sampleBankRecipe: AcousticSampleBankRecipe;
  headroom: AcousticHeadroomRecipe;
  listening: AcousticListeningAcceptance;
}

function noneCycle(): AcousticCycleGeometry {
  return {
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

function disabledVt(allowCombustionShiftAccents: boolean): AcousticVirtualTransmissionRecipe {
  return {
    enabled: false,
    gearRatios: [],
    finalDrive: 1,
    wheelCircumferenceM: 2,
    shiftMode: "none",
    upshiftThresholdsKmh: [],
    downshiftThresholdsKmh: [],
    hysteresisKmh: 0,
    torqueCutMs: 0,
    recoveryMs: 0,
    downshiftBlip: 0,
    minGearDwellSeconds: 0,
    eventCooldownSeconds: 0,
    allowCombustionShiftAccents,
  };
}

function emptySampleBank(): AcousticSampleBankRecipe {
  return {
    personalityHint: null,
    approvedAssetsPresent: false,
    sourceRpmAnchors: [],
    loadRegimes: [],
    loopBoundariesSeconds: [],
    permissibleStretch: { min: 0.85, max: 1.18 },
    provenance: "No approved runtime recordings; procedural fallback is authoritative.",
    proceduralFallback: true,
  };
}

function pendingListening(): AcousticListeningAcceptance {
  return { listeningVerdict: "pending", notes: "Not listening-verified." };
}

function layer(
  role: AcousticLayerRecipe["role"],
  gains: AcousticLayerRecipe["gains"],
  extras: Partial<Omit<AcousticLayerRecipe, "role" | "gains">> = {},
): AcousticLayerRecipe {
  return {
    role,
    gains,
    filterLowpassHz: extras.filterLowpassHz ?? null,
    filterHighpassHz: extras.filterHighpassHz ?? null,
    saturation: extras.saturation ?? 0.08,
    rpmTimbreResponse: extras.rpmTimbreResponse ?? 0.45,
    loadTimbreResponse: extras.loadTimbreResponse ?? 0.55,
  };
}

const COMBUSTION_LAYERS: AcousticLayerRecipe[] = [
  layer("exhaust-body", { idle: 0.85, cruise: 0.95, onLoad: 1.15, overrun: 0.9 }, {
    filterLowpassHz: 4200,
    filterHighpassHz: 40,
    saturation: 0.14,
    rpmTimbreResponse: 0.62,
    loadTimbreResponse: 0.72,
  }),
  layer("intake", { idle: 0.35, cruise: 0.55, onLoad: 1.05, overrun: 0.25 }, {
    filterLowpassHz: 6500,
    filterHighpassHz: 120,
    saturation: 0.1,
    rpmTimbreResponse: 0.7,
    loadTimbreResponse: 0.8,
  }),
  layer("mechanical", { idle: 0.28, cruise: 0.4, onLoad: 0.55, overrun: 0.32 }, {
    filterLowpassHz: 8000,
    filterHighpassHz: 180,
    saturation: 0.06,
    rpmTimbreResponse: 0.55,
    loadTimbreResponse: 0.35,
  }),
  layer("induction", { idle: 0, cruise: 0.1, onLoad: 0.65, overrun: 0.2 }, {
    filterLowpassHz: 5500,
    filterHighpassHz: 200,
    saturation: 0.08,
    rpmTimbreResponse: 0.4,
    loadTimbreResponse: 0.85,
  }),
  layer("event", { idle: 0.05, cruise: 0.08, onLoad: 0.2, overrun: 0.45 }, {
    filterLowpassHz: 7000,
    filterHighpassHz: 80,
    saturation: 0.12,
    rpmTimbreResponse: 0.25,
    loadTimbreResponse: 0.5,
  }),
];

const ELECTRIC_LAYERS: AcousticLayerRecipe[] = [
  layer("motor", { idle: 0.35, cruise: 0.75, onLoad: 1.1, overrun: 0.4 }, {
    filterLowpassHz: 9000,
    filterHighpassHz: 60,
    saturation: 0.05,
    rpmTimbreResponse: 0.75,
    loadTimbreResponse: 0.65,
  }),
  layer("regen", { idle: 0, cruise: 0.05, onLoad: 0.1, overrun: 0.85 }, {
    filterLowpassHz: 7000,
    filterHighpassHz: 100,
    saturation: 0.04,
    rpmTimbreResponse: 0.45,
    loadTimbreResponse: 0.7,
  }),
  layer("mechanical", { idle: 0.1, cruise: 0.25, onLoad: 0.4, overrun: 0.15 }, {
    filterLowpassHz: 6500,
    filterHighpassHz: 150,
    saturation: 0.03,
    rpmTimbreResponse: 0.5,
    loadTimbreResponse: 0.35,
  }),
  layer("event", { idle: 0.02, cruise: 0.04, onLoad: 0.12, overrun: 0.08 }, {
    filterLowpassHz: 8000,
    filterHighpassHz: 80,
    saturation: 0.04,
    rpmTimbreResponse: 0.2,
    loadTimbreResponse: 0.3,
  }),
];

const AMBIENT_LAYERS: AcousticLayerRecipe[] = [
  layer("environment", { idle: 0.7, cruise: 0.95, onLoad: 1.05, overrun: 0.8 }, {
    filterLowpassHz: 10000,
    filterHighpassHz: 30,
    saturation: 0.02,
    rpmTimbreResponse: 0.35,
    loadTimbreResponse: 0.4,
  }),
  layer("core", { idle: 0.4, cruise: 0.55, onLoad: 0.7, overrun: 0.45 }, {
    filterLowpassHz: 6000,
    filterHighpassHz: 40,
    saturation: 0.03,
    rpmTimbreResponse: 0.3,
    loadTimbreResponse: 0.35,
  }),
  layer("event", { idle: 0.02, cruise: 0.05, onLoad: 0.15, overrun: 0.1 }, {
    filterLowpassHz: 8000,
    filterHighpassHz: 60,
    saturation: 0.04,
    rpmTimbreResponse: 0.15,
    loadTimbreResponse: 0.25,
  }),
];

const MUSICAL_LAYERS: AcousticLayerRecipe[] = [
  layer("music", { idle: 0.55, cruise: 0.8, onLoad: 1.05, overrun: 0.5 }, {
    filterLowpassHz: 12000,
    filterHighpassHz: 40,
    saturation: 0.04,
    rpmTimbreResponse: 0.4,
    loadTimbreResponse: 0.55,
  }),
  layer("core", { idle: 0.35, cruise: 0.5, onLoad: 0.7, overrun: 0.35 }, {
    filterLowpassHz: 8000,
    filterHighpassHz: 50,
    saturation: 0.03,
    rpmTimbreResponse: 0.35,
    loadTimbreResponse: 0.45,
  }),
  layer("event", { idle: 0.04, cruise: 0.08, onLoad: 0.2, overrun: 0.12 }, {
    filterLowpassHz: 10000,
    filterHighpassHz: 80,
    saturation: 0.05,
    rpmTimbreResponse: 0.2,
    loadTimbreResponse: 0.35,
  }),
];

const MACHINE_LAYERS: AcousticLayerRecipe[] = [
  layer("core", { idle: 0.7, cruise: 0.9, onLoad: 1.1, overrun: 0.65 }, {
    filterLowpassHz: 5500,
    filterHighpassHz: 45,
    saturation: 0.1,
    rpmTimbreResponse: 0.55,
    loadTimbreResponse: 0.6,
  }),
  layer("mechanical", { idle: 0.35, cruise: 0.5, onLoad: 0.7, overrun: 0.4 }, {
    filterLowpassHz: 7500,
    filterHighpassHz: 100,
    saturation: 0.08,
    rpmTimbreResponse: 0.5,
    loadTimbreResponse: 0.45,
  }),
  layer("environment", { idle: 0.2, cruise: 0.45, onLoad: 0.55, overrun: 0.35 }, {
    filterLowpassHz: 9000,
    filterHighpassHz: 40,
    saturation: 0.03,
    rpmTimbreResponse: 0.4,
    loadTimbreResponse: 0.35,
  }),
  layer("event", { idle: 0.03, cruise: 0.06, onLoad: 0.18, overrun: 0.12 }, {
    filterLowpassHz: 7000,
    filterHighpassHz: 70,
    saturation: 0.06,
    rpmTimbreResponse: 0.2,
    loadTimbreResponse: 0.3,
  }),
];

const CREATURE_LAYERS: AcousticLayerRecipe[] = [
  layer("core", { idle: 0.55, cruise: 0.75, onLoad: 1.05, overrun: 0.6 }, {
    filterLowpassHz: 5000,
    filterHighpassHz: 35,
    saturation: 0.08,
    rpmTimbreResponse: 0.4,
    loadTimbreResponse: 0.55,
  }),
  layer("environment", { idle: 0.35, cruise: 0.55, onLoad: 0.7, overrun: 0.5 }, {
    filterLowpassHz: 9000,
    filterHighpassHz: 40,
    saturation: 0.03,
    rpmTimbreResponse: 0.3,
    loadTimbreResponse: 0.4,
  }),
  layer("event", { idle: 0.04, cruise: 0.08, onLoad: 0.25, overrun: 0.15 }, {
    filterLowpassHz: 6500,
    filterHighpassHz: 60,
    saturation: 0.07,
    rpmTimbreResponse: 0.2,
    loadTimbreResponse: 0.45,
  }),
];

function headroom(
  antiHarshnessHighShelfHz: number | null,
  antiHarshnessGainDb: number,
): AcousticHeadroomRecipe {
  return {
    profileTrim: 1,
    maxGainCeiling: 0.85,
    userVolumeMin: 0,
    userVolumeMax: 1,
    antiHarshnessHighShelfHz,
    antiHarshnessGainDb,
  };
}

/** Deep-ish plain clone safe for SSR JSON boundaries (no functions / class instances). */
export function cloneFamilyDefaults(defaults: AcousticFamilyDefaults): AcousticFamilyDefaults {
  return JSON.parse(JSON.stringify(defaults)) as AcousticFamilyDefaults;
}

export const ACOUSTIC_FAMILY_DEFAULTS: Record<AcousticFamilyDefaultsId, AcousticFamilyDefaults> = {
  "foundation:combustion-hybrid-v2": {
    id: "foundation:combustion-hybrid-v2",
    rendererKind: "combustion-hybrid-v2",
    capabilities: [
      "virtual-transmission",
      "combustion-events",
      "combustion-shift-accents",
      "sample-bank",
      "continuous-motion",
    ],
    cycle: {
      cylinders: 8,
      stroke: "four-stroke",
      cycleDegrees: 720,
      bankRouting: "v90",
      architecture: "cross-plane-v8",
      idleRpm: 800,
      maxRpm: 6500,
      harmonicOrderWeights: [0.72, 0.46, 0.29, 0.18, 0.1, 0.05],
      cycleVariation: 0.08,
    },
    layerRecipes: COMBUSTION_LAYERS,
    virtualTransmission: {
      enabled: true,
      gearRatios: [3.5, 2.2, 1.45, 1.08, 0.85],
      finalDrive: 3.5,
      wheelCircumferenceM: 2.05,
      shiftMode: "automatic",
      upshiftThresholdsKmh: [],
      downshiftThresholdsKmh: [],
      hysteresisKmh: 4,
      torqueCutMs: 180,
      recoveryMs: 220,
      downshiftBlip: 0.35,
      minGearDwellSeconds: 0.9,
      eventCooldownSeconds: 0.9,
      allowCombustionShiftAccents: true,
    },
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(4200, -2.5),
    listening: pendingListening(),
  },
  "foundation:combustion-improved": {
    id: "foundation:combustion-improved",
    rendererKind: "combustion-improved",
    capabilities: ["virtual-transmission", "combustion-events", "continuous-motion"],
    cycle: {
      cylinders: 1,
      stroke: "two-stroke",
      cycleDegrees: 360,
      bankRouting: "single",
      architecture: "single",
      idleRpm: 280,
      maxRpm: 650,
      harmonicOrderWeights: [1, 0.35, 0.18],
      cycleVariation: 0.18,
    },
    layerRecipes: COMBUSTION_LAYERS.map((l) =>
      l.role === "induction" ? { ...l, gains: { idle: 0, cruise: 0, onLoad: 0.15, overrun: 0.05 } } : l,
    ),
    virtualTransmission: {
      enabled: true,
      gearRatios: [4.5, 3.15, 2.35, 1.82],
      finalDrive: 4.75,
      wheelCircumferenceM: 2.25,
      shiftMode: "automatic",
      upshiftThresholdsKmh: [],
      downshiftThresholdsKmh: [],
      hysteresisKmh: 3,
      torqueCutMs: 280,
      recoveryMs: 360,
      downshiftBlip: 0,
      minGearDwellSeconds: 1.5,
      eventCooldownSeconds: 1.4,
      allowCombustionShiftAccents: true,
    },
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(3800, -2),
    listening: pendingListening(),
  },
  "foundation:electric-designed": {
    id: "foundation:electric-designed",
    rendererKind: "electric-designed",
    capabilities: ["regen-identity", "continuous-motion"],
    cycle: noneCycle(),
    layerRecipes: ELECTRIC_LAYERS,
    virtualTransmission: disabledVt(false),
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(6500, -1.5),
    listening: pendingListening(),
  },
  "foundation:creature-cinematic": {
    id: "foundation:creature-cinematic",
    rendererKind: "creature-cinematic",
    capabilities: ["continuous-motion"],
    cycle: noneCycle(),
    layerRecipes: CREATURE_LAYERS,
    virtualTransmission: disabledVt(false),
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(5000, -2),
    listening: pendingListening(),
  },
  "foundation:environmental-ambient": {
    id: "foundation:environmental-ambient",
    rendererKind: "environmental-ambient",
    capabilities: ["continuous-motion"],
    cycle: noneCycle(),
    layerRecipes: AMBIENT_LAYERS,
    virtualTransmission: disabledVt(false),
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(8000, -1),
    listening: pendingListening(),
  },
  "foundation:musical": {
    id: "foundation:musical",
    rendererKind: "musical",
    capabilities: ["musical-grammar", "continuous-motion"],
    cycle: noneCycle(),
    layerRecipes: MUSICAL_LAYERS,
    virtualTransmission: disabledVt(false),
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(10000, -1),
    listening: pendingListening(),
  },
  "foundation:physical-machine": {
    id: "foundation:physical-machine",
    rendererKind: "physical-machine",
    capabilities: ["continuous-motion"],
    cycle: noneCycle(),
    layerRecipes: MACHINE_LAYERS,
    virtualTransmission: disabledVt(false),
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(5500, -2),
    listening: pendingListening(),
  },
  "foundation:symphony": {
    id: "foundation:symphony",
    rendererKind: "symphony",
    capabilities: ["musical-grammar", "continuous-motion"],
    cycle: noneCycle(),
    layerRecipes: MUSICAL_LAYERS,
    virtualTransmission: disabledVt(false),
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(12000, -1),
    listening: pendingListening(),
  },
  "foundation:world": {
    id: "foundation:world",
    rendererKind: "world",
    capabilities: ["continuous-motion"],
    cycle: noneCycle(),
    layerRecipes: AMBIENT_LAYERS,
    virtualTransmission: disabledVt(false),
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(9000, -1.5),
    listening: pendingListening(),
  },
  "foundation:fusion": {
    id: "foundation:fusion",
    rendererKind: "fusion",
    capabilities: ["musical-grammar", "continuous-motion"],
    cycle: noneCycle(),
    layerRecipes: [
      ...COMBUSTION_LAYERS.filter((l) => l.role !== "induction"),
      layer("music", { idle: 0.45, cruise: 0.7, onLoad: 0.95, overrun: 0.4 }, {
        filterLowpassHz: 11000,
        filterHighpassHz: 40,
        saturation: 0.04,
        rpmTimbreResponse: 0.35,
        loadTimbreResponse: 0.5,
      }),
    ],
    virtualTransmission: disabledVt(false),
    sampleBankRecipe: emptySampleBank(),
    headroom: headroom(6000, -2),
    listening: pendingListening(),
  },
};

export function familyDefaultsFor(id: AcousticFamilyDefaultsId): AcousticFamilyDefaults {
  return cloneFamilyDefaults(ACOUSTIC_FAMILY_DEFAULTS[id]);
}
