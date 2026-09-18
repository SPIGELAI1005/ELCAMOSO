import {
  createCombustionPulseLayer,
  createCreakLayer,
  createElectricPulseLayer,
  createFilteredNoiseLayer,
  createGearboxWhineLayer,
  createHarmonicEngineLayer,
  createHoofLayer,
  createHotBulbTractorLayer,
  createImpactLayer,
  createIntakeRoarLayer,
  createKazooLayer,
  createLaughCadenceLayer,
  createFartCadenceLayer,
  createMechanicalLayer,
  createOneShotEventLayer,
  createResonantBodyLayer,
  createRotorLayer,
  createSteamChuffLayer,
  createTurbineLayer,
  createTurboLayer,
  createUfoLayer,
  createWaterLayer,
  createWindLayer,
  type LayerHandle,
} from "@/lib/sound/dsp/layers";
import type { ProfileStrategy, StrategyBuses } from "@/lib/sound/realism/types";
import type { ProfileFamily } from "@/lib/sound/realism/families";
import { familyForProfile } from "@/lib/sound/realism/families";
import { EXPANSION_STRATEGIES } from "@/lib/sound/realism/strategies-extra";

/** Expose family for debug / Studio tooling. */
export function strategyFamily(id: string): ProfileFamily {
  return familyForProfile(id);
}

function combustionFamily(
  id: string,
  opts: {
    ratios: number[];
    weights: number[];
    cylinders: number;
    drive: number;
    filterBase: number;
    intake: number;
    mechanical: number;
    body: number[];
    gearbox?: number;
    pulse?: number;
  },
): ProfileStrategy {
  const isGt = id === "gt-v8";
  return {
    id,
    build(ctx, buses) {
      const layers: LayerHandle[] = [
        createHarmonicEngineLayer(ctx, {
          id: "combustion-harmonics",
          destination: buses.body,
          ratios: opts.ratios,
          weights: opts.weights,
          drive: opts.drive,
          filterBase: opts.filterBase,
          ...(isGt ? { filterCeiling: 3400 } : {}),
          level: isGt ? 0.46 : 0.42,
          detuneCents: isGt ? 7 : 3,
        }),
        createCombustionPulseLayer(ctx, {
          id: "combustion-pulse",
          destination: buses.body,
          cylinders: opts.cylinders,
          tone: opts.pulse ?? (isGt ? 85 : 110),
          level: isGt ? 0.34 : 0.22,
          ...(isGt ? { lumpiness: 0.3, idlePresence: 0.22 } : {}),
        }),
        createResonantBodyLayer(ctx, {
          id: "exhaust-body",
          destination: buses.body,
          freqs: opts.body,
          level: isGt ? 0.3 : 0.22,
        }),
        createIntakeRoarLayer(ctx, {
          id: "intake",
          destination: buses.beds,
          level: opts.intake,
        }),
        createMechanicalLayer(ctx, {
          id: "mechanical",
          destination: buses.accents,
          tone: id === "racing-v10" ? 2200 : 1400,
          level: opts.mechanical,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "overrun",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 700,
          level: isGt ? 0.05 : 0.06,
        }),
        createWindLayer(ctx, {
          id: "wind",
          destination: buses.beds,
          level: 0.12,
        }),
      ];
      if (id === "race-car" || id === "racing-v10") {
        layers.push(
          createOneShotEventLayer(ctx, {
            id: "exhaust-crack",
            destination: buses.accents,
            level: 1,
            events: [
              {
                kind: "antilag",
                everySeconds: id === "race-car" ? 4 : 7,
                jitter: 3,
                level: id === "race-car" ? 0.16 : 0.1,
                tone: 1600,
                onlyOnLift: true,
              },
            ],
          }),
        );
      }
      if (opts.gearbox) {
        layers.push(
          createGearboxWhineLayer(ctx, {
            id: "gearbox",
            destination: buses.accents,
            baseHz: opts.gearbox,
            level: id === "race-car" ? 0.1 : 0.07,
          }),
        );
      }
      return layers;
    },
  };
}

const baseStrategies: ProfileStrategy[] = [
  combustionFamily("gt-v8", {
    ratios: [1, 2, 3, 4.02, 6],
    weights: [1, 0.7, 0.45, 0.28, 0.16],
    cylinders: 8,
    drive: 0.4,
    filterBase: 200,
    intake: 0.18,
    mechanical: 0.06,
    body: [85, 150, 260],
    pulse: 80,
  }),
  combustionFamily("racing-v10", {
    ratios: [1, 2, 3.01, 5, 7.03, 9],
    weights: [0.55, 0.7, 0.65, 0.5, 0.35, 0.22],
    cylinders: 10,
    drive: 0.3,
    filterBase: 420,
    intake: 0.28,
    mechanical: 0.1,
    body: [140, 260, 480],
    gearbox: 280,
    pulse: 120,
  }),
  combustionFamily("race-car", {
    ratios: [1, 2, 3, 4, 5.02, 8],
    weights: [0.65, 0.7, 0.55, 0.4, 0.3, 0.18],
    cylinders: 6,
    drive: 0.34,
    filterBase: 480,
    intake: 0.3,
    mechanical: 0.12,
    body: [150, 300, 520],
    gearbox: 320,
    pulse: 130,
  }),
  {
    id: "rally-car",
    build(ctx, buses) {
      return [
        createHarmonicEngineLayer(ctx, {
          id: "engine",
          destination: buses.body,
          ratios: [1, 2, 3.04, 4.5],
          weights: [0.8, 0.55, 0.35, 0.2],
          wave: "square",
          drive: 0.4,
          filterBase: 340,
          level: 0.36,
          detuneCents: 10,
        }),
        createCombustionPulseLayer(ctx, {
          id: "pulse",
          destination: buses.body,
          cylinders: 4,
          tone: 100,
          level: 0.2,
        }),
        createIntakeRoarLayer(ctx, { id: "intake", destination: buses.beds, level: 0.26 }),
        createTurboLayer(ctx, {
          id: "turbo",
          destination: buses.accents,
          baseHz: 2100,
          level: 0.22,
        }),
        createImpactLayer(ctx, {
          id: "gravel",
          destination: buses.beds,
          kind: "gravel",
          level: 0.28,
        }),
        createResonantBodyLayer(ctx, {
          id: "suspension",
          destination: buses.body,
          freqs: [70, 120],
          level: 0.16,
        }),
        createOneShotEventLayer(ctx, {
          id: "antilag",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "antilag",
              everySeconds: 6,
              jitter: 3,
              level: 0.22,
              tone: 1800,
              onlyOnLift: true,
            },
            {
              kind: "wastegate",
              everySeconds: 8,
              jitter: 4,
              level: 0.16,
              tone: 2400,
              onlyOnLift: true,
            },
          ],
        }),
      ];
    },
  },
  {
    id: "cyber-pulse",
    build(ctx, buses) {
      return [
        createElectricPulseLayer(ctx, {
          id: "electric",
          destination: buses.body,
          baseHz: 62,
          level: 0.45,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "turbine-air",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 3200,
          level: 0.1,
        }),
        createWindLayer(ctx, { id: "motion-air", destination: buses.beds, level: 0.1 }),
      ];
    },
  },
  {
    id: "space-ship",
    build(ctx, buses) {
      return [
        createResonantBodyLayer(ctx, {
          id: "hull",
          destination: buses.body,
          freqs: [40, 68, 110, 165],
          level: 0.35,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "plasma",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 500,
          q: 0.5,
          level: 0.2,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "shimmer",
          destination: buses.beds,
          color: "white",
          filterType: "highpass",
          tone: 3500,
          level: 0.08,
        }),
        createHarmonicEngineLayer(ctx, {
          id: "choir",
          destination: buses.body,
          ratios: [1, 1.5, 2.02, 2.99],
          weights: [0.4, 0.3, 0.2, 0.12],
          wave: "triangle",
          drive: 0.15,
          filterBase: 180,
          level: 0.22,
          detuneCents: 14,
        }),
        createOneShotEventLayer(ctx, {
          id: "signals",
          destination: buses.accents,
          level: 1,
          events: [{ kind: "beam", everySeconds: 16, jitter: 8, level: 0.08, tone: 900 }],
        }),
      ];
    },
  },
  {
    id: "ufo",
    build(ctx, buses) {
      return [
        // Theremin is the whole character - keep beds/accents from masking it.
        createUfoLayer(ctx, {
          id: "theremin",
          destination: buses.body,
          baseHz: 760,
          level: 0.88,
        }),
      ];
    },
  },
  {
    id: "speed-boat",
    build(ctx, buses) {
      return [
        // Excitation: outboard
        createHarmonicEngineLayer(ctx, {
          id: "outboard-excitation",
          destination: buses.body,
          ratios: [1, 2.02, 3.01],
          weights: [0.7, 0.4, 0.22],
          drive: 0.3,
          filterBase: 280,
          level: 0.3,
          detuneCents: 9,
        }),
        createCombustionPulseLayer(ctx, {
          id: "outboard-pulse",
          destination: buses.body,
          cylinders: 2,
          tone: 120,
          level: 0.16,
          maxFireHz: 45,
        }),
        // Mechanical / prop load
        createMechanicalLayer(ctx, {
          id: "prop-load",
          destination: buses.accents,
          tone: 900,
          level: 0.08,
        }),
        // Environment: physically evolving water + cavitation regimes
        createWaterLayer(ctx, {
          id: "water",
          destination: buses.beds,
          planing: true,
          outboard: true,
          level: 0.55,
        }),
      ];
    },
  },
  {
    id: "cruise-ship",
    build(ctx, buses) {
      return [
        createResonantBodyLayer(ctx, {
          id: "engine-room",
          destination: buses.body,
          freqs: [36, 55, 72, 110],
          level: 0.4,
        }),
        createHarmonicEngineLayer(ctx, {
          id: "machinery",
          destination: buses.body,
          ratios: [1, 1.5, 2],
          weights: [0.5, 0.3, 0.18],
          wave: "sine",
          drive: 0.12,
          filterBase: 90,
          level: 0.22,
          detuneCents: 12,
        }),
        createWaterLayer(ctx, { id: "hull-wash", destination: buses.beds, level: 0.35 }),
        createFilteredNoiseLayer(ctx, {
          id: "generator",
          destination: buses.accents,
          color: "pink",
          filterType: "bandpass",
          tone: 120,
          q: 4,
          level: 0.08,
        }),
        createOneShotEventLayer(ctx, {
          id: "horn",
          destination: buses.accents,
          level: 1,
          events: [{ kind: "horn", everySeconds: 40, jitter: 18, level: 0.16, tone: 78 }],
        }),
      ];
    },
  },
  {
    id: "turbine-jet",
    build(ctx, buses) {
      return [
        // Full turbofan stack (jet + fan broadband + BPF + compressor + discrete)
        createTurbineLayer(ctx, {
          id: "turbofan",
          destination: buses.body,
          fanBase: 360,
          roarLevel: 0.72,
          cabin: false,
          level: 0.58,
        }),
        createWindLayer(ctx, { id: "intake-airflow", destination: buses.beds, level: 0.18 }),
        createResonantBodyLayer(ctx, {
          id: "airframe-rumble",
          destination: buses.body,
          freqs: [42, 68],
          level: 0.14,
        }),
      ];
    },
  },
  {
    id: "private-jet",
    build(ctx, buses) {
      return [
        createTurbineLayer(ctx, {
          id: "cabin-fan",
          destination: buses.body,
          fanBase: 520,
          roarLevel: 0.45,
          cabin: true,
          level: 0.42,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "cabin-air",
          destination: buses.beds,
          color: "pink",
          filterType: "lowpass",
          tone: 1800,
          level: 0.22,
        }),
        createResonantBodyLayer(ctx, {
          id: "cabin-vibration",
          destination: buses.body,
          freqs: [55, 90],
          level: 0.12,
        }),
      ];
    },
  },
  {
    id: "helicopter",
    build(ctx, buses) {
      return [
        createRotorLayer(ctx, {
          id: "main-rotor",
          destination: buses.body,
          blades: 4,
          tone: 42,
          level: 0.6,
        }),
        createHarmonicEngineLayer(ctx, {
          id: "turboshaft",
          destination: buses.accents,
          ratios: [1, 2.01],
          weights: [0.35, 0.2],
          wave: "sine",
          drive: 0.1,
          filterBase: 900,
          level: 0.12,
        }),
        createGearboxWhineLayer(ctx, {
          id: "tail-gearbox",
          destination: buses.accents,
          baseHz: 480,
          level: 0.05,
        }),
        createWindLayer(ctx, { id: "downwash", destination: buses.beds, level: 0.22 }),
      ];
    },
  },
  {
    id: "wild-west-carriage",
    build(ctx, buses) {
      return [
        createHoofLayer(ctx, {
          id: "hooves",
          destination: buses.accents,
          horses: 4,
          tone: 380,
          level: 0.32,
        }),
        createCreakLayer(ctx, {
          id: "wood-creak",
          destination: buses.accents,
          tone: 180,
          level: 0.12,
        }),
        createImpactLayer(ctx, {
          id: "gravel",
          destination: buses.beds,
          kind: "gravel",
          level: 0.22,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "wheels",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 400,
          level: 0.1,
        }),
        createOneShotEventLayer(ctx, {
          id: "whip",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "whip",
              everySeconds: 18,
              jitter: 10,
              level: 0.14,
              tone: 2600,
              onlyOnHardAccel: true,
            },
          ],
        }),
      ];
    },
  },
  {
    id: "romanian-85-carriage",
    build(ctx, buses) {
      return [
        createHoofLayer(ctx, {
          id: "horse",
          destination: buses.accents,
          horses: 1,
          tone: 320,
          level: 0.28,
        }),
        createImpactLayer(ctx, {
          id: "cobbles",
          destination: buses.beds,
          kind: "cobble",
          level: 0.3,
        }),
        createCreakLayer(ctx, {
          id: "heavy-creak",
          destination: buses.accents,
          tone: 140,
          metal: true,
          level: 0.16,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "iron-rim",
          destination: buses.accents,
          color: "white",
          filterType: "bandpass",
          tone: 900,
          q: 5,
          level: 0.08,
        }),
        createResonantBodyLayer(ctx, {
          id: "cart-body",
          destination: buses.body,
          freqs: [70, 110],
          level: 0.14,
        }),
      ];
    },
  },
  {
    id: "steam-train",
    build(ctx, buses) {
      return [
        createSteamChuffLayer(ctx, {
          id: "chuff",
          destination: buses.accents,
          tone: 200,
          level: 0.4,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "steam",
          destination: buses.beds,
          color: "pink",
          filterType: "highpass",
          tone: 2800,
          level: 0.28,
        }),
        createResonantBodyLayer(ctx, {
          id: "boiler",
          destination: buses.body,
          freqs: [55, 85],
          level: 0.2,
        }),
        createImpactLayer(ctx, {
          id: "rail",
          destination: buses.beds,
          kind: "stone",
          level: 0.12,
        }),
        createOneShotEventLayer(ctx, {
          id: "whistle",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "whistle",
              everySeconds: 22,
              jitter: 10,
              level: 0.16,
              tone: 880,
              speedLinked: true,
            },
          ],
        }),
      ];
    },
  },
  {
    id: "wiesn-tractor",
    build(ctx, buses) {
      return [
        // Hero: absurdly slow two-stroke hot-bulb events + flywheel inertia
        createHotBulbTractorLayer(ctx, {
          id: "hot-bulb",
          destination: buses.body,
          idleRpm: 280,
          peakRpm: 630,
          level: 0.58,
        }),
        createResonantBodyLayer(ctx, {
          id: "flywheel-body",
          destination: buses.body,
          freqs: [48, 72, 96],
          level: 0.2,
        }),
        createMechanicalLayer(ctx, {
          id: "gear-clatter",
          destination: buses.accents,
          tone: 750,
          level: 0.1,
        }),
        createCreakLayer(ctx, {
          id: "chassis-creak",
          destination: buses.accents,
          tone: 130,
          metal: true,
          level: 0.07,
        }),
        // Ambient crowd: extremely quiet, not part of driving response
        createFilteredNoiseLayer(ctx, {
          id: "crowd-distant",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 760,
          level: 0.025,
        }),
      ];
    },
  },
  {
    id: "open-wind",
    build(ctx, buses) {
      return [
        createWindLayer(ctx, {
          id: "wind",
          destination: buses.beds,
          level: 0.7,
          bands: [
            { tone: 220, level: 0.3, q: 0.6 },
            { tone: 1100, level: 0.55, q: 0.75 },
            { tone: 3200, level: 0.28, q: 0.85 },
          ],
        }),
      ];
    },
  },
  {
    id: "storm-glider",
    build(ctx, buses) {
      return [
        createWindLayer(ctx, {
          id: "storm-wind",
          destination: buses.beds,
          level: 0.65,
          bands: [
            { tone: 180, level: 0.45, q: 0.5 },
            { tone: 850, level: 0.55, q: 0.7 },
            { tone: 4200, level: 0.35, q: 0.9 },
          ],
        }),
        createFilteredNoiseLayer(ctx, {
          id: "pressure",
          destination: buses.body,
          color: "brown",
          filterType: "lowpass",
          tone: 90,
          level: 0.22,
        }),
        createOneShotEventLayer(ctx, {
          id: "thunder",
          destination: buses.accents,
          level: 1,
          events: [{ kind: "thunder", everySeconds: 28, jitter: 14, level: 0.12, tone: 80 }],
        }),
      ];
    },
  },
  {
    id: "santa-sleigh",
    build(ctx, buses) {
      return [
        createOneShotEventLayer(ctx, {
          id: "bells",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "bell",
              everySeconds: 0.45,
              jitter: 0.2,
              level: 0.14,
              tone: 2100,
              speedLinked: true,
            },
          ],
        }),
        createHoofLayer(ctx, {
          id: "soft-hooves",
          destination: buses.accents,
          horses: 4,
          tone: 280,
          level: 0.12,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "snow",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 900,
          level: 0.2,
        }),
        createWindLayer(ctx, { id: "winter-wind", destination: buses.beds, level: 0.14 }),
        createOneShotEventLayer(ctx, {
          id: "hohoho",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "hohoho",
              everySeconds: 24,
              jitter: 10,
              level: 0.12,
              tone: 150,
              onlyOnHardAccel: true,
            },
          ],
        }),
      ];
    },
  },
  {
    id: "laughing-machine",
    build(ctx, buses) {
      return [
        createLaughCadenceLayer(ctx, {
          id: "laugh-cadence",
          destination: buses.accents,
          tone: 210,
          level: 0.72,
        }),
        createOneShotEventLayer(ctx, {
          id: "belly-laugh",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "laugh",
              everySeconds: 1.8,
              jitter: 0.7,
              level: 0.5,
              tone: 155,
              speedLinked: true,
            },
          ],
        }),
        createFilteredNoiseLayer(ctx, {
          id: "breath-bed",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 900,
          q: 1.2,
          level: 0.06,
          throttleWeight: 0.9,
          speedWeight: 0.25,
        }),
        createResonantBodyLayer(ctx, {
          id: "cabin-giggle",
          destination: buses.body,
          freqs: [95, 190],
          level: 0.12,
        }),
      ];
    },
  },
  {
    id: "farting-car",
    build(ctx, buses) {
      return [
        createFartCadenceLayer(ctx, {
          id: "gas-cadence",
          destination: buses.accents,
          tone: 95,
          level: 0.68,
        }),
        createOneShotEventLayer(ctx, {
          id: "lift-bubbles",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "fart",
              everySeconds: 2.2,
              jitter: 1.0,
              level: 0.42,
              tone: 60,
              onlyOnLift: true,
            },
          ],
        }),
        createFilteredNoiseLayer(ctx, {
          id: "exhaust-hiss",
          destination: buses.beds,
          color: "brown",
          filterType: "lowpass",
          tone: 220,
          level: 0.06,
          throttleWeight: 1.2,
          speedWeight: 0.2,
        }),
      ];
    },
  },
  {
    id: "kazoo-kart",
    build(ctx, buses) {
      return [
        createKazooLayer(ctx, {
          id: "kazoo",
          destination: buses.body,
          baseHz: 175,
          level: 0.72,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "wheel-buzz",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 650,
          q: 1.4,
          level: 0.05,
          throttleWeight: 0.8,
          speedWeight: 0.4,
        }),
      ];
    },
  },
];

const strategies: ProfileStrategy[] = [...baseStrategies, ...EXPANSION_STRATEGIES];

const byId = new Map(strategies.map((s) => [s.id, s]));

export function getStrategy(profileId: string): ProfileStrategy | null {
  return byId.get(profileId) ?? null;
}

export function listStrategyIds() {
  return strategies.map((s) => s.id);
}

export type { StrategyBuses, LayerHandle };
