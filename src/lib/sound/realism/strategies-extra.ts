/**
 * Improved-synth strategies for the 25 expansion profiles.
 */

import {
  createCombustionPulseLayer,
  createElectricPulseLayer,
  createFilteredNoiseLayer,
  createGearboxWhineLayer,
  createHarmonicEngineLayer,
  createHoofLayer,
  createImpactLayer,
  createIntakeRoarLayer,
  createMechanicalLayer,
  createOneShotEventLayer,
  createResonantBodyLayer,
  createTurboLayer,
  createWaterLayer,
  createWindLayer,
  type LayerHandle,
} from "@/lib/sound/dsp/layers";
import {
  createArcadeLayer,
  createCreatureBreathLayer,
  createDeepBassPulseLayer,
  createHeartbeatLayer,
  createHydraulicLayer,
  createMaglevLayer,
  createNeonPulseLayer,
  createOceanWaveLayer,
  createRainLayer,
  createSynthwaveLayer,
  createTrackCadenceLayer,
  createVtwinPulseLayer,
} from "@/lib/sound/dsp/layers-extra";
import type { ProfileStrategy } from "@/lib/sound/realism/types";

export const EXPANSION_STRATEGIES: ProfileStrategy[] = [
  {
    id: "flat-six-sport",
    build(ctx, buses) {
      return [
        createHarmonicEngineLayer(ctx, {
          id: "combustion",
          destination: buses.body,
          ratios: [1, 2, 3.02, 4.5, 6.1],
          weights: [0.5, 0.65, 0.6, 0.48, 0.32],
          drive: 0.26,
          filterBase: 340,
          filterCeiling: 4800,
          level: 0.36,
          detuneCents: 5,
        }),
        createCombustionPulseLayer(ctx, {
          id: "pulse",
          destination: buses.body,
          cylinders: 6,
          tone: 130,
          level: 0.16,
        }),
        createIntakeRoarLayer(ctx, { id: "intake", destination: buses.beds, level: 0.36 }),
        createMechanicalLayer(ctx, {
          id: "mechanical",
          destination: buses.accents,
          tone: 2100,
          level: 0.12,
        }),
        createGearboxWhineLayer(ctx, {
          id: "driveline",
          destination: buses.accents,
          baseHz: 300,
          level: 0.06,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "lift-rasp",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 2800,
          q: 1.4,
          level: 0.12,
          throttleWeight: 0.85,
          speedWeight: 0.45,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "nasal-mid",
          destination: buses.accents,
          color: "pink",
          filterType: "bandpass",
          tone: 1650,
          q: 1.8,
          level: 0.09,
          throttleWeight: 1.1,
          speedWeight: 0.35,
        }),
      ];
    },
  },
  {
    id: "american-muscle-v8",
    build(ctx, buses) {
      return [
        createCombustionPulseLayer(ctx, {
          id: "lumpy-pulse",
          destination: buses.body,
          cylinders: 8,
          tone: 78,
          level: 0.46,
          lumpiness: 0.7,
          idlePresence: 0.55,
          maxFireHz: 36,
        }),
        createHarmonicEngineLayer(ctx, {
          id: "exhaust",
          destination: buses.body,
          ratios: [1, 2, 2.98, 4],
          weights: [1, 0.55, 0.3, 0.15],
          drive: 0.44,
          filterBase: 160,
          filterCeiling: 3200,
          level: 0.34,
          detuneCents: 16,
        }),
        createResonantBodyLayer(ctx, {
          id: "body",
          destination: buses.body,
          freqs: [78, 130, 210],
          level: 0.28,
        }),
        createIntakeRoarLayer(ctx, { id: "intake", destination: buses.beds, level: 0.18 }),
        createFilteredNoiseLayer(ctx, {
          id: "overrun",
          destination: buses.beds,
          color: "brown",
          filterType: "lowpass",
          tone: 380,
          level: 0.1,
        }),
      ];
    },
  },
  {
    id: "turbo-inline-6",
    build(ctx, buses) {
      return [
        createHarmonicEngineLayer(ctx, {
          id: "smooth-six",
          destination: buses.body,
          ratios: [1, 2, 3, 4.02, 6],
          weights: [0.75, 0.65, 0.5, 0.3, 0.18],
          drive: 0.28,
          filterBase: 280,
          filterCeiling: 3800,
          level: 0.4,
          detuneCents: 3,
        }),
        createCombustionPulseLayer(ctx, {
          id: "pulse",
          destination: buses.body,
          cylinders: 6,
          tone: 105,
          level: 0.16,
        }),
        createIntakeRoarLayer(ctx, { id: "intake", destination: buses.beds, level: 0.22 }),
        createTurboLayer(ctx, {
          id: "turbo",
          destination: buses.accents,
          baseHz: 1850,
          lagSeconds: 0.85,
          level: 0.24,
        }),
        createOneShotEventLayer(ctx, {
          id: "wastegate",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "wastegate",
              everySeconds: 5,
              jitter: 2.5,
              level: 0.16,
              tone: 2100,
              onlyOnLift: true,
            },
          ],
        }),
      ];
    },
  },
  {
    id: "electric-hypercar",
    build(ctx, buses) {
      return [
        createElectricPulseLayer(ctx, {
          id: "motor",
          destination: buses.body,
          baseHz: 85,
          shimmerCeiling: 4800,
          meshBoost: 1,
          level: 0.48,
        }),
        createGearboxWhineLayer(ctx, {
          id: "reduction",
          destination: buses.accents,
          baseHz: 360,
          level: 0.08,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "inverter",
          destination: buses.accents,
          color: "white",
          filterType: "bandpass",
          tone: 3600,
          q: 2.4,
          level: 0.11,
          throttleWeight: 1.35,
          speedWeight: 0.45,
        }),
        createWindLayer(ctx, { id: "aero", destination: buses.beds, level: 0.18 }),
      ];
    },
  },
  {
    id: "formula-electric",
    build(ctx, buses) {
      return [
        createElectricPulseLayer(ctx, {
          id: "motor-whine",
          destination: buses.body,
          baseHz: 115,
          shimmerCeiling: 2800,
          level: 0.4,
        }),
        createHarmonicEngineLayer(ctx, {
          id: "inverter-cluster",
          destination: buses.body,
          ratios: [1, 2, 3, 4.5],
          weights: [0.45, 0.32, 0.2, 0.1],
          wave: "triangle",
          drive: 0.1,
          filterBase: 520,
          filterCeiling: 2600,
          level: 0.18,
          detuneCents: 1.5,
        }),
        createGearboxWhineLayer(ctx, {
          id: "reduction-gear",
          destination: buses.accents,
          baseHz: 380,
          level: 0.07,
        }),
        createWindLayer(ctx, { id: "aero-tire", destination: buses.beds, level: 0.2 }),
      ];
    },
  },
  {
    id: "neon-drive",
    build(ctx, buses) {
      return [
        createNeonPulseLayer(ctx, { id: "neon", destination: buses.body, level: 0.42 }),
        createFilteredNoiseLayer(ctx, {
          id: "shimmer",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 2200,
          q: 0.8,
          level: 0.06,
        }),
      ];
    },
  },
  {
    id: "maglev-train",
    build(ctx, buses) {
      return [
        createMaglevLayer(ctx, { id: "maglev", destination: buses.body, level: 0.52 }),
        createResonantBodyLayer(ctx, {
          id: "structure",
          destination: buses.body,
          freqs: [48, 72, 110],
          level: 0.2,
        }),
        createWindLayer(ctx, { id: "aero", destination: buses.beds, level: 0.26 }),
      ];
    },
  },
  {
    id: "high-speed-train",
    build(ctx, buses) {
      return [
        createElectricPulseLayer(ctx, {
          id: "traction",
          destination: buses.body,
          baseHz: 55,
          shimmerCeiling: 2800,
          level: 0.35,
        }),
        createGearboxWhineLayer(ctx, {
          id: "driveline",
          destination: buses.accents,
          baseHz: 260,
          level: 0.07,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "rail",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 700,
          level: 0.18,
          speedWeight: 1.05,
          throttleWeight: 0.15,
        }),
        createImpactLayer(ctx, {
          id: "joints",
          destination: buses.accents,
          kind: "cobble",
          densityScale: 1.55,
          jerkWeight: 1.5,
          level: 0.12,
        }),
        createWindLayer(ctx, { id: "aero", destination: buses.beds, level: 0.32 }),
      ];
    },
  },
  {
    id: "submarine",
    build(ctx, buses) {
      return [
        createResonantBodyLayer(ctx, {
          id: "hull",
          destination: buses.body,
          freqs: [40, 62, 95],
          level: 0.38,
        }),
        createElectricPulseLayer(ctx, {
          id: "propulsion",
          destination: buses.body,
          baseHz: 42,
          shimmerCeiling: 2200,
          level: 0.28,
        }),
        createWaterLayer(ctx, { id: "pressure", destination: buses.beds, level: 0.3 }),
        createFilteredNoiseLayer(ctx, {
          id: "cavitation",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 900,
          level: 0.1,
        }),
        createOneShotEventLayer(ctx, {
          id: "sonar",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "sonar",
              everySeconds: 28,
              jitter: 12,
              level: 0.11,
              tone: 720,
            },
            {
              kind: "sonar",
              everySeconds: 10,
              jitter: 4,
              level: 0.09,
              tone: 760,
              onlyOnHardAccel: true,
            },
          ],
        }),
      ];
    },
  },
  {
    id: "jet-ski",
    build(ctx, buses) {
      return [
        createHarmonicEngineLayer(ctx, {
          id: "engine",
          destination: buses.body,
          ratios: [1, 2.02, 3.5],
          weights: [0.65, 0.4, 0.22],
          drive: 0.32,
          filterBase: 360,
          filterCeiling: 4200,
          level: 0.34,
          detuneCents: 8,
        }),
        createWaterLayer(ctx, {
          id: "jet-water",
          destination: buses.beds,
          planing: true,
          outboard: true,
          level: 0.5,
        }),
        createImpactLayer(ctx, {
          id: "hull-slap",
          destination: buses.accents,
          kind: "stone",
          jerkWeight: 16,
          level: 0.18,
        }),
        createIntakeRoarLayer(ctx, { id: "intake", destination: buses.beds, level: 0.18 }),
      ];
    },
  },
  {
    id: "motorcycle-superbike",
    build(ctx, buses) {
      return [
        createHarmonicEngineLayer(ctx, {
          id: "combustion",
          destination: buses.body,
          ratios: [1, 2, 3.02, 5, 7],
          weights: [0.42, 0.5, 0.42, 0.28, 0.14],
          drive: 0.26,
          filterBase: 380,
          filterCeiling: 3000,
          level: 0.38,
          detuneCents: 2,
        }),
        createCombustionPulseLayer(ctx, {
          id: "pulse",
          destination: buses.body,
          cylinders: 4,
          tone: 130,
          level: 0.15,
          maxFireHz: 72,
        }),
        createIntakeRoarLayer(ctx, { id: "intake", destination: buses.beds, level: 0.22 }),
        createGearboxWhineLayer(ctx, {
          id: "gearbox",
          destination: buses.accents,
          baseHz: 340,
          level: 0.06,
        }),
        createMechanicalLayer(ctx, {
          id: "chain",
          destination: buses.accents,
          tone: 1800,
          level: 0.045,
        }),
        createWindLayer(ctx, { id: "air", destination: buses.beds, level: 0.18 }),
      ];
    },
  },
  {
    id: "big-twin",
    build(ctx, buses) {
      return [
        createVtwinPulseLayer(ctx, {
          id: "vtwin-pulse",
          destination: buses.body,
          tone: 98,
          level: 0.48,
        }),
        createHarmonicEngineLayer(ctx, {
          id: "exhaust",
          destination: buses.body,
          ratios: [1, 1.98, 3.1],
          weights: [0.8, 0.45, 0.2],
          drive: 0.36,
          filterBase: 190,
          filterCeiling: 2800,
          level: 0.3,
          detuneCents: 10,
        }),
        createResonantBodyLayer(ctx, {
          id: "mid-body",
          destination: buses.body,
          freqs: [95, 160, 240],
          level: 0.2,
        }),
        createMechanicalLayer(ctx, {
          id: "rocker",
          destination: buses.accents,
          tone: 1100,
          level: 0.07,
        }),
        createIntakeRoarLayer(ctx, { id: "intake", destination: buses.beds, level: 0.15 }),
      ];
    },
  },
  {
    id: "snowmobile",
    build(ctx, buses) {
      return [
        createHarmonicEngineLayer(ctx, {
          id: "two-stroke",
          destination: buses.body,
          ratios: [1, 2.03, 3.1, 4.5],
          weights: [0.6, 0.5, 0.35, 0.2],
          drive: 0.32,
          filterBase: 400,
          filterCeiling: 4200,
          level: 0.36,
          detuneCents: 7,
        }),
        createGearboxWhineLayer(ctx, {
          id: "cvt-belt",
          destination: buses.accents,
          baseHz: 320,
          level: 0.1,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "snow",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 1100,
          q: 0.7,
          level: 0.24,
          speedWeight: 1.1,
          throttleWeight: 0.25,
        }),
        createImpactLayer(ctx, {
          id: "track-snow",
          destination: buses.accents,
          kind: "gravel",
          softThump: true,
          densityScale: 1.35,
          jerkWeight: 3,
          level: 0.16,
        }),
        createIntakeRoarLayer(ctx, { id: "intake", destination: buses.beds, level: 0.16 }),
      ];
    },
  },
  {
    id: "tank",
    build(ctx, buses) {
      return [
        createHarmonicEngineLayer(ctx, {
          id: "diesel",
          destination: buses.body,
          ratios: [1, 2, 3, 4.5],
          weights: [0.85, 0.5, 0.28, 0.14],
          wave: "square",
          drive: 0.42,
          filterBase: 130,
          filterCeiling: 1700,
          level: 0.34,
          detuneCents: 14,
        }),
        createCombustionPulseLayer(ctx, {
          id: "diesel-knock",
          destination: buses.body,
          cylinders: 8,
          tone: 105,
          level: 0.2,
          lumpiness: 0.4,
          idlePresence: 0.25,
          maxFireHz: 20,
        }),
        createTrackCadenceLayer(ctx, {
          id: "tracks",
          destination: buses.accents,
          tone: 260,
          midKnock: true,
          level: 0.4,
        }),
        createResonantBodyLayer(ctx, {
          id: "hull",
          destination: buses.body,
          freqs: [55, 85, 140, 220],
          level: 0.32,
        }),
        createMechanicalLayer(ctx, {
          id: "mid-knock",
          destination: buses.accents,
          tone: 620,
          level: 0.1,
        }),
        createGearboxWhineLayer(ctx, {
          id: "gearbox",
          destination: buses.accents,
          baseHz: 180,
          level: 0.06,
        }),
      ];
    },
  },
  {
    id: "construction-monster",
    build(ctx, buses) {
      return [
        createHarmonicEngineLayer(ctx, {
          id: "diesel",
          destination: buses.body,
          ratios: [1, 2.02, 3],
          weights: [0.85, 0.4, 0.2],
          wave: "square",
          drive: 0.38,
          filterBase: 140,
          filterCeiling: 1600,
          level: 0.3,
          detuneCents: 12,
        }),
        createHydraulicLayer(ctx, { id: "hydraulics", destination: buses.accents, level: 0.36 }),
        createResonantBodyLayer(ctx, {
          id: "body",
          destination: buses.body,
          freqs: [60, 95],
          level: 0.2,
        }),
        createMechanicalLayer(ctx, {
          id: "strain",
          destination: buses.accents,
          tone: 700,
          level: 0.1,
        }),
      ];
    },
  },
  {
    id: "horse-gallop",
    build(ctx, buses) {
      return [
        createHoofLayer(ctx, {
          id: "hooves",
          destination: buses.accents,
          horses: 1,
          tone: 320,
          level: 0.52,
        }),
        createImpactLayer(ctx, {
          id: "ground",
          destination: buses.beds,
          kind: "gravel",
          softThump: true,
          level: 0.1,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "breath",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 420,
          q: 1.4,
          level: 0.08,
          throttleWeight: 1.5,
          speedWeight: 0.12,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "snort",
          destination: buses.accents,
          color: "pink",
          filterType: "bandpass",
          tone: 720,
          q: 2.2,
          level: 0.04,
          throttleWeight: 1.8,
          speedWeight: 0.05,
        }),
      ];
    },
  },
  {
    id: "dragon",
    build(ctx, buses) {
      return [
        createCreatureBreathLayer(ctx, {
          id: "creature",
          destination: buses.body,
          mythic: true,
          level: 0.5,
        }),
        createOneShotEventLayer(ctx, {
          id: "roar",
          destination: buses.accents,
          level: 1,
          events: [
            {
              kind: "roar",
              everySeconds: 14,
              jitter: 7,
              level: 0.22,
              tone: 72,
              onlyOnHardAccel: true,
            },
          ],
        }),
        createWindLayer(ctx, { id: "wings", destination: buses.beds, level: 0.14 }),
      ];
    },
  },
  {
    id: "thunder-beast",
    build(ctx, buses) {
      return [
        createCreatureBreathLayer(ctx, {
          id: "growl",
          destination: buses.body,
          dark: true,
          level: 0.46,
        }),
        createResonantBodyLayer(ctx, {
          id: "pressure",
          destination: buses.body,
          freqs: [42, 64, 96],
          level: 0.34,
        }),
        createFilteredNoiseLayer(ctx, {
          id: "turbulence",
          destination: buses.beds,
          color: "brown",
          filterType: "lowpass",
          tone: 280,
          level: 0.18,
        }),
        createOneShotEventLayer(ctx, {
          id: "thunder",
          destination: buses.accents,
          level: 1,
          events: [{ kind: "thunder", everySeconds: 22, jitter: 10, level: 0.14, tone: 58 }],
        }),
      ];
    },
  },
  {
    id: "retro-arcade",
    build(ctx, buses) {
      return [
        createArcadeLayer(ctx, { id: "arcade", destination: buses.body, level: 0.4 }),
        createFilteredNoiseLayer(ctx, {
          id: "cabinet",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 520,
          q: 0.8,
          level: 0.07,
          speedWeight: 0.6,
          throttleWeight: 0.15,
        }),
      ];
    },
  },
  {
    id: "synthwave-drive",
    build(ctx, buses) {
      return [
        createSynthwaveLayer(ctx, { id: "synthwave", destination: buses.body, level: 0.42 }),
        createFilteredNoiseLayer(ctx, {
          id: "air",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 2800,
          q: 0.7,
          level: 0.05,
        }),
      ];
    },
  },
  {
    id: "deep-bass-pulse",
    build(ctx, buses) {
      return [
        createDeepBassPulseLayer(ctx, { id: "bass", destination: buses.body, level: 0.42 }),
        createFilteredNoiseLayer(ctx, {
          id: "air",
          destination: buses.beds,
          color: "pink",
          filterType: "bandpass",
          tone: 180,
          q: 0.6,
          level: 0.06,
          speedWeight: 0.5,
          throttleWeight: 0.35,
        }),
      ];
    },
  },
  {
    id: "zen-drive",
    build(ctx, buses) {
      return [
        createWindLayer(ctx, {
          id: "wind",
          destination: buses.beds,
          level: 0.45,
          bands: [
            { tone: 200, level: 0.25, q: 0.6 },
            { tone: 900, level: 0.45, q: 0.7 },
            { tone: 2400, level: 0.15, q: 0.8 },
          ],
        }),
        createResonantBodyLayer(ctx, {
          id: "drone",
          destination: buses.body,
          freqs: [55, 82],
          level: 0.18,
        }),
        createOneShotEventLayer(ctx, {
          id: "chimes",
          destination: buses.accents,
          level: 1,
          events: [{ kind: "bell", everySeconds: 55, jitter: 28, level: 0.05, tone: 1320 }],
        }),
      ];
    },
  },
  {
    id: "rain-drive",
    build(ctx, buses) {
      return [
        createRainLayer(ctx, { id: "rain", destination: buses.beds, level: 0.36 }),
        createWindLayer(ctx, { id: "air", destination: buses.beds, level: 0.08 }),
        createFilteredNoiseLayer(ctx, {
          id: "glass-mid",
          destination: buses.accents,
          color: "white",
          filterType: "bandpass",
          tone: 3200,
          q: 1.1,
          level: 0.06,
          speedWeight: 0.7,
          throttleWeight: 0.2,
        }),
      ];
    },
  },
  {
    id: "ocean-drive",
    build(ctx, buses) {
      return [
        createOceanWaveLayer(ctx, { id: "ocean", destination: buses.beds, level: 0.5 }),
        createWindLayer(ctx, { id: "wind", destination: buses.beds, level: 0.16 }),
        createResonantBodyLayer(ctx, {
          id: "deep",
          destination: buses.body,
          freqs: [42, 65],
          level: 0.16,
        }),
      ];
    },
  },
  {
    id: "heartbeat",
    build(ctx, buses) {
      return [createHeartbeatLayer(ctx, { id: "heartbeat", destination: buses.body, level: 0.42 })];
    },
  },
];

export type { LayerHandle };
