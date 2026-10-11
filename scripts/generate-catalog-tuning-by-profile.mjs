/**
 * One-shot generator for src/lib/sound/realism/catalog-tuning/by-profile.ts
 * Run: node scripts/generate-catalog-tuning-by-profile.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const COMBUSTION_V2 = new Set([
  "gt-v8",
  "american-muscle-v8",
  "flat-six-sport",
  "turbo-inline-6",
  "racing-v10",
  "race-car",
  "rally-car",
  "motorcycle-superbike",
  "big-twin",
]);

const V3_PILOTS = new Set(["american-muscle-v8", "flat-six-sport"]);

/** @type {Record<string, object>} */
const DEFS = {
  "gt-v8": {
    hint: "cross-plane-gt-v8",
    identity: "Polished cross-plane GT V8 — weight with restraint, not muscle lope",
    previous: "Realism V2 HybridCombustionSynth + GT_V8 acoustic archetype",
    problem: "Baseline: slightly thin cruise body vs design promise; intake can compete with exhaust under light load",
    acoustic: {
      exhaustPulse: 0.8,
      intakePresence: 0.38,
      mechanicalIntensity: 0.32,
      bodyBrightness: 0.4,
      loadContrast: 0.6,
      upperRpmEnergy: 0.52,
      bodyResonanceHz: [108, 228, 490],
    },
    experience: {
      phases: { idleCharacter: 0.95, accelerationTexture: 1.14, cruiseIntrusiveScale: 0.64, releaseCharacter: 0.46 },
    },
    layer: "Exhaust/combustion lead; intake secondary; mechanical tertiary",
    rpm: "Pull-away body; cruise quieter; load opens enrichment",
    bass: "Mid-bass formants +108/228 Hz body — not muscle 78 Hz lope",
    harsh: "Keep GT edge; no blanket LPF",
    tx: "VT shift accents when intensity > 0",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "GT stays smoother than muscle: lower idle irregularity path, higher upperRpmEnergy than muscle family",
    code: ["acoustic-engine.ts via applyAcousticCatalogTuning", "by-profile.ts:gt-v8"],
  },
  "american-muscle-v8": {
    hint: "cross-plane-muscle-v8",
    identity: "Cross-plane muscle V8 — textured exhaust pulse groups, restrained intake",
    previous: "V2 hybrid + AMERICAN_V8; V3 raw-mechanical opt-in pilot",
    problem: "Pilot review: risk of modeling all unevenness as global random firing; intake/whine historically too present",
    acoustic: {
      exhaustPulse: 0.99,
      intakePresence: 0.22,
      mechanicalIntensity: 0.2,
      idleIrregularity: 0.42,
      bodyBrightness: 0.33,
      loadContrast: 0.9,
      upperRpmEnergy: 0.26,
      combustionSharpness: 0.48,
      bodyResonanceHz: [82, 164, 380],
      exhaustFormantsHz: [74, 148, 300, 560],
    },
    experience: {
      phases: {
        idleCharacter: 1.12,
        pullAwayTexture: 1.16,
        accelerationTexture: 1.2,
        cruiseIntrusiveScale: 0.62,
        releaseCharacter: 0.82,
      },
    },
    layer: "Bank/exhaust pulse groups dominate; intake restrained; mechanical soft",
    rpm: "Idle lope; load opens exhaust mass; cruise restrained",
    bass: "Deeper body resonances vs GT; supportWeights bias low orders",
    harsh: "Soften metallic grit; keep burble-adjacent overrun",
    tx: "Shift choreography + intensity; V3 pilots share path",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "Stronger lope/exhaust vs GT; intentionally lower upperRpmEnergy so it does not race-whine",
    code: ["by-profile.ts:american-muscle-v8", "raw-mechanical-presets.ts (V3 flag)", "applyAcousticCatalogTuning"],
  },
  "flat-six-sport": {
    hint: "flat-six-sport",
    identity: "Flat-six sports — mechanical texture, balanced midrange, strong body without muscle rumble",
    previous: "V2 hybrid + FLAT_SIX; V3 raw-mechanical opt-in pilot",
    problem: "Risk of cross-plane rumble bleed; midrange mechanical under-represented vs intake scream",
    acoustic: {
      exhaustPulse: 0.52,
      intakePresence: 0.88,
      mechanicalIntensity: 0.78,
      bodyBrightness: 0.55,
      upperRpmEnergy: 0.88,
      intakeLoadResponse: 0.97,
      combustionSharpness: 0.64,
      bodyResonanceHz: [150, 330, 700],
    },
    experience: {
      phases: { idleCharacter: 0.86, accelerationTexture: 1.26, cruiseIntrusiveScale: 0.56, releaseCharacter: 0.45 },
    },
    layer: "Intake + mechanical lead; exhaust balanced; no muscle bank lope",
    rpm: "Body at low/mid; upper harmonics with RPM",
    bass: "Flat/boxer body mid — not 78 Hz muscle",
    harsh: "Narrow tame of grit; keep mechanical bite",
    tx: "Sport VT; V3 pilot path",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "Raises mechanicalIntensity vs family default; lowers exhaustPulse so it cannot become V8 rumble",
    code: ["by-profile.ts:flat-six-sport", "raw-mechanical-presets.ts", "applyAcousticCatalogTuning"],
  },
  "turbo-inline-6": {
    hint: "turbo-inline-6",
    identity: "Turbo inline-six — smooth body + load-responsive spool; no constant idle whistle",
    previous: "V2 hybrid + TURBO_I6",
    problem: "Baseline intakePresence can read as constant whistle at idle/cruise",
    acoustic: {
      intakePresence: 0.36,
      intakeLoadResponse: 0.84,
      upperRpmEnergy: 0.5,
      overrunCharacter: 0.38,
      bodyBrightness: 0.45,
      exhaustPulse: 0.55,
      loadContrast: 0.7,
    },
    experience: {
      phases: { accelerationTexture: 1.2, cruiseIntrusiveScale: 0.56, releaseCharacter: 0.72, idleCharacter: 0.9 },
      aspirationDynamics: { attackSeconds: 0.72, decaySeconds: 0.48, minimumReleaseState: 0.55 },
    },
    layer: "Body/exhaust cruise; intake/boost opens with load",
    rpm: "Spool gated by aspirationDynamics + intakeLoadResponse",
    bass: "Smooth low-mid; no whistle-as-body",
    harsh: "Idle intake capped; enrichment under load only",
    tx: "Turbo release character; shift accents when engaged",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "Idle intakePresence cut vs archetype; slower spool attack than rally",
    code: ["by-profile.ts:turbo-inline-6", "applyAcousticCatalogTuning", "applyExperienceCatalogTuning"],
  },
  "racing-v10": {
    hint: "high-rev-race",
    identity: "High-rev even V10 — upper harmonics with RPM; justified low/mid body",
    previous: "V2 hybrid + V10",
    problem: "Thin low/mid body; temptation to blanket-LPF harshness and erase identity",
    acoustic: {
      upperRpmEnergy: 0.97,
      bodyBrightness: 0.6,
      combustionSharpness: 0.64,
      highLoadEnrichment: 0.88,
      exhaustPulse: 0.68,
      mechanicalIntensity: 0.62,
      bodyResonanceHz: [135, 300, 740],
    },
    experience: {
      phases: { idleCharacter: 0.8, accelerationTexture: 1.28, cruiseIntrusiveScale: 0.5, releaseCharacter: 0.48 },
      transitionTauSeconds: 0.05,
    },
    layer: "Upper partials retained; body added at low/mid without muscle lope",
    rpm: "upperRpmEnergy primary; load enrichment secondary",
    bass: "Justified body resonances — not cross-plane rumble",
    harsh: "Sharpness slightly down; no dulling LPF",
    tx: "Fast tau; sport shifts",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "Higher upperRpmEnergy than race-car flat-plane; slightly darker bodyBrightness than race-car",
    code: ["by-profile.ts:racing-v10", "applyAcousticCatalogTuning"],
  },
  "race-car": {
    hint: "high-rev-race",
    identity: "Flat-plane track V8 — bright, urgent, retains high-RPM scream identity",
    previous: "V2 hybrid + FLAT_PLANE_V8_TRACK",
    problem: "Harsh fatigue in midband; low body at idle vs design",
    acoustic: {
      upperRpmEnergy: 0.92,
      bodyBrightness: 0.7,
      combustionSharpness: 0.7,
      highLoadEnrichment: 0.85,
      exhaustPulse: 0.72,
      mechanicalIntensity: 0.68,
      bodyResonanceHz: [150, 340, 820],
    },
    experience: {
      phases: { idleCharacter: 0.76, accelerationTexture: 1.3, cruiseIntrusiveScale: 0.5, releaseCharacter: 0.56 },
      transitionTauSeconds: 0.042,
    },
    layer: "Flat-plane pulse + upper energy; mechanical present",
    rpm: "Aggressive accel texture; cruise thinner",
    bass: "Track body mid — brighter than V10",
    harsh: "Narrow sharpness trim only",
    tx: "Very fast tau",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "Brighter and faster tau than racing-v10; keeps flat-plane identity",
    code: ["by-profile.ts:race-car", "applyAcousticCatalogTuning"],
  },
  "rally-car": {
    hint: "turbo-inline-6",
    identity: "Turbo inline-three rally — aggressive spool, overrun, gravel-adjacent mechanical",
    previous: "V2 hybrid + RALLY_TURBO_3",
    problem: "Constant boost hiss risk; overrun can clip-crackle",
    acoustic: {
      intakePresence: 0.5,
      intakeLoadResponse: 0.82,
      overrunCharacter: 0.62,
      combustionSharpness: 0.62,
      loadContrast: 0.88,
      upperRpmEnergy: 0.66,
      idleIrregularity: 0.22,
    },
    experience: {
      phases: { accelerationTexture: 1.22, cruiseIntrusiveScale: 0.52, releaseCharacter: 0.84 },
      aspirationDynamics: { attackSeconds: 0.42, decaySeconds: 0.3, minimumReleaseState: 0.55 },
      variation: { depth: 0.028, minEventCooldownSeconds: 3.5, maxEventVoices: 2 },
    },
    layer: "Boost/intake on load; mechanical + environment roles",
    rpm: "Faster spool than street turbo-I6; release pops gated",
    bass: "Uneven I3 pulse body",
    harsh: "Sharpness down vs archetype to avoid crackle",
    tx: "Dense events allowed; still intensity-gated",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "Faster aspiration attack than turbo-inline-6; higher overrunCharacter; not diesel",
    code: ["by-profile.ts:rally-car", "applyAcousticCatalogTuning"],
  },
  "motorcycle-superbike": {
    hint: "high-rev-race",
    identity: "Inline-four superbike — high-rev scream, light body, sharp intake",
    previous: "V2 hybrid + INLINE_4",
    problem: "Harsh mid; insufficient high-RPM identity; body can sound car-like",
    acoustic: {
      upperRpmEnergy: 0.94,
      bodyBrightness: 0.74,
      combustionSharpness: 0.68,
      exhaustPulse: 0.5,
      intakePresence: 0.74,
      mechanicalIntensity: 0.64,
      bodyResonanceHz: [190, 440, 960],
    },
    experience: {
      phases: { idleCharacter: 0.7, accelerationTexture: 1.32, cruiseIntrusiveScale: 0.48, releaseCharacter: 0.42 },
      transitionTauSeconds: 0.04,
      variation: { depth: 0.007, minEventCooldownSeconds: 5 },
    },
    layer: "Intake/upper lead; light exhaust; mechanical valvetrain",
    rpm: "Fastest tau in catalog combustion set",
    bass: "Higher body resonances — motorcycle, not car",
    harsh: "Sharpness trim; keep scream",
    tx: "Quick shifts; low variation depth",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "Highest bodyBrightness among combustion; bodyResonanceHz shifted up vs cars",
    code: ["by-profile.ts:motorcycle-superbike", "applyAcousticCatalogTuning"],
  },
  "big-twin": {
    hint: "cross-plane-muscle-v8",
    identity: "V-twin cruiser — loping uneven pulse, deep exhaust, restrained intake",
    previous: "V2 hybrid + V_TWIN",
    problem: "Can thin out under cruise; unevenness must stay architectural not random noise",
    acoustic: {
      idleIrregularity: 0.58,
      exhaustPulse: 0.95,
      intakePresence: 0.24,
      mechanicalIntensity: 0.22,
      bodyBrightness: 0.3,
      upperRpmEnergy: 0.18,
      loadContrast: 0.76,
      bodyResonanceHz: [55, 120, 280],
    },
    experience: {
      phases: {
        idleCharacter: 1.16,
        pullAwayTexture: 1.1,
        accelerationTexture: 1.14,
        cruiseIntrusiveScale: 0.7,
        releaseCharacter: 0.84,
      },
      transitionTauSeconds: 0.18,
    },
    layer: "Exhaust pulse + idle irregularity; intake quiet",
    rpm: "Low-RPM mass; slow tau",
    bass: "Lowest body resonances in combustion set",
    harsh: "Soft sharpness; no crackle",
    tx: "Relaxed shift feel",
    sample: "hybrid-ready-awaiting-banks",
    rationale: "Uses muscle-family restraint on intake but V-twin architecture; deeper bass than muscle V8",
    code: ["by-profile.ts:big-twin", "applyAcousticCatalogTuning"],
  },
  "wiesn-tractor": {
    hint: "heavy-mechanical",
    identity: "Heavy mechanical / festival tractor — controlled clatter, low-RPM mass (no dedicated diesel archetype)",
    previous: "ImprovedSynth combustion experience; no ACOUSTIC_ENGINE_BY_PROFILE entry",
    problem: "No diesel acoustic engine; risk of clipping crackle if sharpness pushed; needs procedural mass",
    experience: {
      phases: {
        idleCharacter: 1.18,
        pullAwayTexture: 1.08,
        accelerationTexture: 1.06,
        cruiseIntrusiveScale: 0.82,
        releaseCharacter: 0.8,
      },
      transitionTauSeconds: 0.58,
      variation: { depth: 0.02, minEventCooldownSeconds: 12, maxEventVoices: 1 },
    },
    layer: "Combustion/exhaust/mechanical roles via experience; strategy path",
    rpm: "Very slow tau; heavy idle",
    bass: "IdleCharacter up for low-RPM mass",
    harsh: "No clipping crackle — event density low",
    tx: "Sparse events",
    sample: "asset-pending",
    rationale: "Catalog has no diesel ID; tractor is closest heavy-mechanical — experience-only until acoustic single exists",
    outcome: "blocked-assets",
    blocker: "No dedicated diesel/single acoustic engine + no approved recordings; procedural experience tune shipped",
    renderer: "improved-strategy",
    code: ["by-profile.ts:wiesn-tractor", "applyExperienceCatalogTuning"],
  },
};

// Non-combustion / designed / ambient / musical — experience overlays with unique deltas
const EXTRA = [
  ["cyber-pulse", "electric-futuristic", "Cyber EV pulse — intentional electronic motor identity", "ImprovedSynth designed motor/regen", "Harsh electronic edge + thin body at idle", { phases: { idleCharacter: 0.34, accelerationTexture: 1.18, cruiseIntrusiveScale: 0.58, regenCharacter: 0.92, releaseCharacter: 0.4 } }, "Motor/regen lead; no ICE", "Motor-speed driver", "Phase idle body — not combustion rumble", "Cruise scale down", "Gearless", "procedural-only", "Slightly higher idleCharacter than formula-electric; keeps cyber grit"],
  ["electric-hypercar", "electric-futuristic", "Multi-speed EV hypercar — motor scream + regen", "ImprovedSynth EV roles", "Weak idle body; harsh on long cruise", { phases: { idleCharacter: 0.32, pullAwayTexture: 1.12, accelerationTexture: 1.22, cruiseIntrusiveScale: 0.5, regenCharacter: 1.02, releaseCharacter: 0.44, stopTail: 0.28 } }, "Motor/mechanical/regen", "Torque-demand load", "Pull-away body boost", "Cruise intrusion cut", "Gearless continuous", "procedural-only", "Higher regenCharacter than cyber-pulse; stopTail shorter"],
  ["formula-electric", "electric-futuristic", "Competition EV — thin idle, aggressive motor", "ImprovedSynth formula EV", "Idle too silent to feel armed; harsh accel", { phases: { idleCharacter: 0.18, accelerationTexture: 1.26, cruiseIntrusiveScale: 0.48, regenCharacter: 0.86, releaseCharacter: 0.4, stopTail: 0.22 } }, "Motor-first", "Fast tau already in base", "Minimal idle; accel texture up", "Lower cruise", "No shift clacks", "procedural-only", "Lowest idleCharacter in EV set — competition silence at standstill"],
  ["neon-drive", "musical-fusion", "Neon musical drive — designed runtime family with musical layers", "ImprovedSynth / musical roles", "Fatigue from bright cruise; identity must stay musical not ICE", { phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.52, regenCharacter: 0.68, releaseCharacter: 0.7 } }, "Music/core/regen", "Energy motion", "Musical bass only", "Cruise down", "Musical events", "not-applicable", "Runtime family designed (package musical mismatch preserved)"],
  ["space-ship", "creature-cinematic", "Cinematic spacecraft energy field", "ImprovedSynth designed energy", "Generic sci-fi hiss; weak stop tail differentiation", { phases: { accelerationTexture: 1.2, cruiseIntrusiveScale: 0.66, releaseCharacter: 0.64, stopTail: 0.88 } }, "Core/mechanical/env", "Energy driver", "StopTail mass", "Cruise moderate", "Sparse events", "procedural-only", "Longer stopTail than ufo"],
  ["ufo", "creature-cinematic", "UFO — hovering vehicle-speed drone with event chirps", "ImprovedSynth designed", "Can sound like space-ship clone", { phases: { accelerationTexture: 1.08, cruiseIntrusiveScale: 0.6, releaseCharacter: 0.82 }, variation: { depth: 0.02, minEventCooldownSeconds: 7, maxEventVoices: 1 } }, "Core/env/event", "Vehicle-speed", "Release character high (hover settle)", "Softer accel than space-ship", "Chirp events", "procedural-only", "Higher releaseCharacter; more eventful than space-ship"],
  ["speed-boat", "generic-motion", "Planing boat — RPM + water environment", "ImprovedSynth motion", "Engine can dominate water; harsh mid", { phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.62, releaseCharacter: 0.66, pullAwayTexture: 1.08 } }, "Core/mechanical/env", "Engine-rpm", "Pull-away hull body", "Cruise water balance", "Splash events", "asset-pending", "More accel texture than cruise-ship"],
  ["cruise-ship", "generic-motion", "Ocean liner — slow massive RPM bed + environment", "ImprovedSynth motion", "Too lively; needs long tails", { phases: { accelerationTexture: 1.02, cruiseIntrusiveScale: 0.78, releaseCharacter: 0.82, stopTail: 0.94 }, variation: { depth: 0.008, minEventCooldownSeconds: 30, maxEventVoices: 1 }, transitionTauSeconds: 0.45 }, "Env mass + core", "Slow RPM", "StopTail maximum", "High cruise scale (presence as bed)", "Rare horn-like events", "asset-pending", "Slowest ship tau; calm accel"],
  ["santa-sleigh", "creature-cinematic", "Holiday sleigh — cadence bells/environment", "ImprovedSynth designed cadence", "Risk of generic jingle loop fatigue", { phases: { accelerationTexture: 1.1, cruiseIntrusiveScale: 0.54, releaseCharacter: 0.7 }, variation: { depth: 0.024, minEventCooldownSeconds: 11, maxEventVoices: 1 } }, "Core/mechanical/env/event", "Cadence", "Light body", "Lower cruise for fatigue", "Bell events", "procedural-only", "Lower cruise than wild-west; festive variation depth"],
  ["wild-west-carriage", "creature-cinematic", "Western carriage — cadence wood/leather/horse-adjacent", "ImprovedSynth environmental cadence", "Engine-ratio bleed risk", { phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.62, releaseCharacter: 0.64 }, variation: { minEventCooldownSeconds: 13, maxEventVoices: 1 } }, "Mechanical/env", "Cadence not cylinders", "Wood/body texture via phases", "Moderate cruise", "Creak events", "asset-pending", "Slightly more accel than romanian carriage"],
  ["romanian-85-carriage", "creature-cinematic", "Traditional carriage — slower cadence, denser cruise bed", "ImprovedSynth environmental", "Can merge with wild-west", { phases: { accelerationTexture: 1.04, cruiseIntrusiveScale: 0.74, releaseCharacter: 0.72 }, transitionTauSeconds: 0.24 }, "Mechanical/env", "Slower cadence feel", "Heavier cruise bed", "Softer accel", "Few events", "asset-pending", "Higher cruiseIntrusiveScale; slower tau than wild-west"],
  ["laughing-machine", "creature-cinematic", "Comedy machine — cadence laughs/events", "ImprovedSynth designed", "Event spam fatigue", { phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.46, releaseCharacter: 0.56 }, variation: { minEventCooldownSeconds: 5.5, maxEventVoices: 1 } }, "Core/env/event", "Cadence", "Light", "Low cruise", "Laugh events gated", "procedural-only", "Lower cruise than farting-car; comedy not ICE"],
  ["farting-car", "creature-cinematic", "Comedy car — release-heavy joke accents", "ImprovedSynth designed", "Over-trigger on release", { phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.44, releaseCharacter: 0.94 }, variation: { minEventCooldownSeconds: 2.4, maxEventVoices: 1 } }, "Core/mechanical/event", "Engine-rpm joke mapping", "Joke body on release", "Very low cruise", "Fast event cooldown but single voice", "procedural-only", "Highest releaseCharacter in comedy set"],
  ["steam-train", "heavy-mechanical", "Steam train — cadence chuff + environment", "ImprovedSynth motion cadence", "Chuff can clip; needs mass without crackle", { phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.72, releaseCharacter: 0.74 }, variation: { minEventCooldownSeconds: 16, maxEventVoices: 1 }, transitionTauSeconds: 0.2 }, "Core/mechanical/env", "Cadence chuff", "Low-RPM mass via cruise bed", "No clipping events", "Whistle-like sparse events", "asset-pending", "Heavier cruise than high-speed-train"],
  ["kazoo-kart", "creature-cinematic", "Kazoo kart — toy intake/mechanical comedy", "ImprovedSynth designed", "Harsh toy reed fatigue", { phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.42, releaseCharacter: 0.58 }, variation: { depth: 0.016, minEventCooldownSeconds: 4, maxEventVoices: 1 }, transitionTauSeconds: 0.065 }, "Intake/mechanical joke", "Fast RPM toy", "Light", "Lowest cruise in comedy", "Toy events", "procedural-only", "Fastest comedy tau; no VT combustion accents (recipe)"],
  ["turbine-jet", "generic-motion", "Turbine jet — slow spool bed", "ImprovedSynth motion", "Spool too fast; thin cruise", { phases: { accelerationTexture: 1.1, cruiseIntrusiveScale: 0.74, releaseCharacter: 0.76 }, transitionTauSeconds: 0.55 }, "Core/intake/mechanical/env", "Slow engine-rpm spool", "Cruise bed mass", "Long tau", "No pop events", "asset-pending", "Slower tau than helicopter"],
  ["helicopter", "generic-motion", "Helicopter — fixed-pitch rotor bed", "ImprovedSynth motion fixed pitch", "Pitch wandering like jet", { phases: { accelerationTexture: 1.06, cruiseIntrusiveScale: 0.78, releaseCharacter: 0.76 }, transitionTauSeconds: 0.32 }, "Rotor mechanical/env", "Fixed pitch driver", "Steady bed", "High cruise presence", "No turbine spool mimic", "asset-pending", "Fixed pitch — less accel texture than turbine-jet"],
  ["private-jet", "generic-motion", "Private jet — refined turbine, slower than military", "ImprovedSynth motion", "Too close to turbine-jet", { phases: { accelerationTexture: 1.06, cruiseIntrusiveScale: 0.76, releaseCharacter: 0.8 }, transitionTauSeconds: 0.62 }, "Core/mechanical/env", "Very slow spool", "Refined bed", "Highest jet tau", "Quiet events", "asset-pending", "Slowest aerospace tau; softer accel than turbine-jet"],
  ["open-wind", "ambient-world", "Open wind — environment only", "ImprovedSynth env-only", "Can gain fake engine hiss", { phases: { accelerationTexture: 1.06, cruiseIntrusiveScale: 0.78, releaseCharacter: 0.84, stopTail: 0.88 }, transitionTauSeconds: 0.4 }, "Environment only", "Vehicle-speed wind", "Air mass", "No mechanical harsh", "None", "procedural-only", "Env-only roles preserved"],
  ["storm-glider", "ambient-world", "Storm glider — designed weather energy", "ImprovedSynth designed env", "Thunder events spam", { phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.62, releaseCharacter: 0.84 }, variation: { minEventCooldownSeconds: 22, maxEventVoices: 1 }, transitionTauSeconds: 0.32 }, "Core/env/event", "Vehicle-speed storm", "Storm body", "Event cooldown long", "Lightning-like sparse", "procedural-only", "Longer event cooldown than world-storm-run"],
  ["maglev-train", "electric-futuristic", "Maglev — motor-speed glide + regen", "ImprovedSynth motion motor", "Harsh guideway whine", { phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.66, releaseCharacter: 0.78, regenCharacter: 0.62 }, transitionTauSeconds: 0.32 }, "Motor/mechanical/env", "Motor-speed", "Glide body", "Whine via cruise scale", "Gearless", "procedural-only", "Higher regen than high-speed-train"],
  ["high-speed-train", "electric-futuristic", "High-speed train — motor + aero", "ImprovedSynth motion", "Aero harshness", { phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.64, releaseCharacter: 0.74, regenCharacter: 0.54 }, transitionTauSeconds: 0.28 }, "Motor/mechanical/env", "Motor-speed", "Aero bed", "Slightly more accel than maglev", "Gearless", "procedural-only", "Faster tau; less regen than maglev"],
  ["submarine", "ambient-world", "Submarine — deep motor/env pressure bed", "ImprovedSynth motion", "Surface-boat likeness", { phases: { accelerationTexture: 1.06, cruiseIntrusiveScale: 0.76, releaseCharacter: 0.86 }, variation: { minEventCooldownSeconds: 14, maxEventVoices: 1 }, transitionTauSeconds: 0.48 }, "Motor/mechanical/env", "Deep slow", "Pressure mass", "Very high release settle", "Sonar-like rare events", "asset-pending", "Darker/slower than cruise-ship metaphor"],
  ["jet-ski", "generic-motion", "Jet-ski — snappy RPM + spray", "ImprovedSynth motion", "Harsh reed; weak spray env", { phases: { accelerationTexture: 1.22, cruiseIntrusiveScale: 0.56, releaseCharacter: 0.6, pullAwayTexture: 1.1 }, transitionTauSeconds: 0.1 }, "Core/intake/mechanical/env", "Snappy RPM", "Light hull body", "Lower cruise than speed-boat", "Spray events", "asset-pending", "Faster/more aggressive than speed-boat"],
  ["snowmobile", "generic-motion", "Snowmobile — two-stroke-ish RPM + snow env", "ImprovedSynth motion (combustion roles in experience)", "Car-like body bleed; harsh top", { phases: { accelerationTexture: 1.2, cruiseIntrusiveScale: 0.54, releaseCharacter: 0.58 }, transitionTauSeconds: 0.085 }, "Combustion/mechanical/env roles", "Engine-rpm", "Light chassis", "Bright but cruise cut", "No heavy VT", "asset-pending", "Between jet-ski and motorcycle energy"],
  ["tank", "heavy-mechanical", "Tank — heavy mechanical tread bed", "ImprovedSynth motion", "Clipping clatter risk", "phases: { accelerationTexture: 1.1, cruiseIntrusiveScale: 0.72, releaseCharacter: 0.78 }, transitionTauSeconds: 0.36", "Core/mechanical/env", "Slow RPM mass", "Tread body", "No crackle events", "Sparse", "asset-pending", "Heavier cruise than construction-monster"],
  ["construction-monster", "heavy-mechanical", "Construction plant — hydraulic/mechanical", "ImprovedSynth motion", "Event beep spam; thin idle", { phases: { idleCharacter: 1.08, accelerationTexture: 1.16, cruiseIntrusiveScale: 0.66, releaseCharacter: 0.72 }, variation: { minEventCooldownSeconds: 9, maxEventVoices: 1 }, transitionTauSeconds: 0.3 }, "Core/mechanical/env/event", "Working RPM", "Idle mass up", "Beep events gated", "Single event voice", "asset-pending", "More accel + events than tank"],
  ["horse-gallop", "creature-cinematic", "Horse gallop — cadence hoof/env", "ImprovedSynth environmental cadence", "Engine pulse bleed", { phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.66, releaseCharacter: 0.74 }, transitionTauSeconds: 0.22 }, "Core/mechanical/env", "Cadence gallop", "Hoof body not V8", "Natural cruise", "No gear clacks", "asset-pending", "Gallop cadence — distinct from carriage creak"],
  ["dragon", "creature-cinematic", "Dragon — cinematic roar/energy (runtime designed)", "ImprovedSynth designed", "Generic monster; package environmental mismatch preserved", { phases: { accelerationTexture: 1.2, cruiseIntrusiveScale: 0.54, releaseCharacter: 0.76 }, variation: { minEventCooldownSeconds: 7.5, maxEventVoices: 1 } }, "Core/mechanical/env/event", "Energy roar", "Creature chest body", "Roar events", "Not ICE ratios", "procedural-only", "More eventful than thunder-beast; family mismatch kept"],
  ["thunder-beast", "creature-cinematic", "Thunder beast — slower cinematic storm creature", "ImprovedSynth designed", "Dragon clone risk", { phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.6, releaseCharacter: 0.84 }, variation: { minEventCooldownSeconds: 15, maxEventVoices: 1 }, transitionTauSeconds: 0.3 }, "Core/mechanical/env/event", "Energy storm", "Heavier release", "Longer event gaps", "Not diesel clatter", "procedural-only", "Slower/heavier than dragon"],
  ["retro-arcade", "musical-fusion", "Retro arcade score — chiptune motion", "ImprovedSynth musical", "Harsh square fatigue", { phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.48, releaseCharacter: 0.68 }, variation: { depth: 0.006, minEventCooldownSeconds: 2.8, maxEventVoices: 1 }, transitionTauSeconds: 0.075 }, "Music/core/event", "Energy", "8-bit bass", "Low cruise", "Coin events", "not-applicable", "Fastest musical tau"],
  ["synthwave-drive", "musical-fusion", "Synthwave — pads + drive pulse", "ImprovedSynth musical", "Neon-drive clone", { phases: { accelerationTexture: 1.1, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.72 }, transitionTauSeconds: 0.17 }, "Music/env/event", "Energy", "Pad bass", "Softer than neon", "Musical hits", "not-applicable", "Softer accel than neon-drive"],
  ["deep-bass-pulse", "musical-fusion", "Deep bass pulse — sub-focused musical", "ImprovedSynth musical", "Mud vs heartbeat", { phases: { accelerationTexture: 1.04, cruiseIntrusiveScale: 0.7, releaseCharacter: 0.74 }, variation: { depth: 0.006, minEventCooldownSeconds: 9, maxEventVoices: 1 }, transitionTauSeconds: 0.22 }, "Music/core", "Energy sub", "Sub body intentional", "High cruise bed OK", "Rare hits", "not-applicable", "Highest musical cruise bed"],
  ["zen-drive", "ambient-world", "Zen — calm intentional atmosphere", "ImprovedSynth intentional env", "Accidental brightness", { phases: { accelerationTexture: 1.02, cruiseIntrusiveScale: 0.8, releaseCharacter: 0.88 }, variation: { depth: 0.008, minEventCooldownSeconds: 20, maxEventVoices: 1 }, transitionTauSeconds: 0.55 }, "Core/env/event", "Energy calm", "Soft mass", "Very high cruise calm", "Rare bowls", "procedural-only", "Calmest accel in ambient set"],
  ["rain-drive", "ambient-world", "Rain — precipitation environment", "ImprovedSynth env", "White-noise harsh", { phases: { accelerationTexture: 1.06, cruiseIntrusiveScale: 0.74, releaseCharacter: 0.84 }, transitionTauSeconds: 0.36 }, "Environment", "Vehicle-speed rain", "Wet bed", "Hiss control via cruise", "None", "procedural-only", "More motion than ocean-drive"],
  ["ocean-drive", "ambient-world", "Ocean — slow swell environment", "ImprovedSynth env", "Rain clone", { phases: { accelerationTexture: 1.02, cruiseIntrusiveScale: 0.82, releaseCharacter: 0.9 }, transitionTauSeconds: 0.65 }, "Environment", "Energy swell", "Deep swell mass", "Highest ambient cruise", "None", "procedural-only", "Slowest ambient tau"],
  ["heartbeat", "musical-fusion", "Heartbeat — pulse musical motif", "ImprovedSynth musical", "Loop artefact risk", { phases: { accelerationTexture: 1.06, cruiseIntrusiveScale: 0.72, releaseCharacter: 0.76 }, variation: { depth: 0.005, minEventCooldownSeconds: 8, maxEventVoices: 1 }, transitionTauSeconds: 0.26 }, "Music/core/event", "Pulse energy", "Body = pulse not ICE", "Steady bed", "Pulse events", "not-applicable", "Lower variation depth than deep-bass"],
  ["symphony-cinematic-rock", "musical-fusion", "Symphony cinematic rock", "Symphony musical path", "Arrangement harsh on cruise", { phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.52, releaseCharacter: 0.72 }, transitionTauSeconds: 0.18 }, "Music/event", "Energy arrangement", "Rock body", "Cruise arrangement down", "Hits", "not-applicable", "Rockier accel than motion-orchestra"],
  ["symphony-motion-orchestra", "musical-fusion", "Symphony motion orchestra", "Symphony musical path", "Rock clone", { phases: { accelerationTexture: 1.1, cruiseIntrusiveScale: 0.56, releaseCharacter: 0.74 }, transitionTauSeconds: 0.24 }, "Music/event", "Orchestral energy", "Orchestral mass", "Softer", "Hits", "not-applicable", "Slower/softer than cinematic-rock"],
  ["symphony-neon-run", "musical-fusion", "Symphony neon run", "Symphony musical path", "Neon-drive bleed", { phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.5, releaseCharacter: 0.68 }, transitionTauSeconds: 0.13 }, "Music/event", "Neon energy", "Synth bass", "Bright but cruise cut", "Hits", "not-applicable", "Fastest symphony tau"],
  ["world-space-drive", "ambient-world", "World space drive — designed space atmosphere", "World designed path", "space-ship clone", { phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.6, releaseCharacter: 0.78 }, transitionTauSeconds: 0.26 }, "Core/env/event", "Energy world", "Space bed", "Distinct stop via release", "Sparse", "procedural-only", "World layering vs space-ship profile"],
  ["world-cyber-city", "electric-futuristic", "World cyber city — urban designed bed", "World designed path", "Neon harsh", { phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.54, releaseCharacter: 0.66 }, variation: { minEventCooldownSeconds: 6.5, maxEventVoices: 2 }, transitionTauSeconds: 0.17 }, "Core/env/event", "Vehicle-speed city", "Urban body", "City events denser", "Up to 2 voices", "procedural-only", "Only world with maxEventVoices 2"],
  ["world-storm-run", "ambient-world", "World storm run", "World environmental path", "storm-glider clone", { phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.82 }, variation: { minEventCooldownSeconds: 15, maxEventVoices: 1 }, transitionTauSeconds: 0.2 }, "Core/env/event", "Storm speed", "Storm mass", "Event gaps", "World mix", "procedural-only", "Faster tau than storm-glider"],
  ["fusion-road-anthem", "musical-fusion", "Fusion road anthem — hybrid combustion metaphor + music", "Fusion hybrid physics", "ICE metaphor too literal", { phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.52 }, transitionTauSeconds: 0.13 }, "Combustion roles + music", "Engine-rpm hybrid", "Anthem bass", "Music not muscle rumble", "Hybrid events", "asset-pending", "NA fusion; less turbo than midnight-boost"],
  ["fusion-mechanical-symphony", "musical-fusion", "Fusion mechanical symphony", "Fusion hybrid", "Too close to road-anthem", { phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.54, releaseCharacter: 0.46 }, transitionTauSeconds: 0.095 }, "Mechanical + music", "Engine-rpm", "Mechanical body metaphor", "Brighter accel", "Events", "asset-pending", "Faster/more mechanical than road-anthem"],
  ["fusion-midnight-boost", "musical-fusion", "Fusion midnight boost — turbo hybrid + music", "Fusion hybrid turbo", "Constant boost whistle risk", { phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.52, releaseCharacter: 0.72 }, aspirationDynamics: { attackSeconds: 0.7, decaySeconds: 0.45, minimumReleaseState: 0.58 }, transitionTauSeconds: 0.1 }, "Boost + music", "Turbo hybrid", "Night body", "Spool gated", "Boost release", "asset-pending", "Only fusion with turbo aspirationDynamics"],
  ["fusion-future-pulse", "electric-futuristic", "Fusion future pulse — EV motor + music", "Fusion hybrid motor", "Combustion bleed risk", { phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.5, releaseCharacter: 0.5, regenCharacter: 0.88 }, transitionTauSeconds: 0.095 }, "Motor/regen/music", "Motor-speed", "Future pulse body", "No ICE overlay", "Gearless fusion", "procedural-only", "Only fusion on motor-speed + regen"],
];

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function fmtObj(obj, indent = 4) {
  return JSON.stringify(obj, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : " ".repeat(indent) + line))
    .join("\n")
    .replace(/"([^"]+)":/g, "$1:");
}

function renderEntry(id, d) {
  const isCombustion = COMBUSTION_V2.has(id);
  const renderer =
    d.renderer ??
    (isCombustion
      ? V3_PILOTS.has(id)
        ? "realism-v3-raw-mechanical-opt-in"
        : "realism-v2-hybrid"
      : id.startsWith("symphony-")
        ? "symphony"
        : id.startsWith("world-")
          ? "world"
          : id.startsWith("fusion-")
            ? "fusion"
            : "improved-strategy");
  const outcome = d.outcome ?? (isCombustion ? "combustion-tuned" : "experience-tuned");
  const sample = d.sample;
  const baseline = `artifacts/audio-lab/prompt-07-catalog/${id}__baseline`;
  const after = `artifacts/audio-lab/prompt-07-catalog/${id}__after`;
  const blockerLine = d.blocker ? `\n    blocker: ${JSON.stringify(d.blocker)},` : "";
  const acousticLine = d.acoustic
    ? `\n    acousticOverlay: ${fmtObj(d.acoustic, 4)},`
    : "";
  const experienceLine = d.experience
    ? `\n    experienceOverlay: ${fmtObj(d.experience, 4)},`
    : "";

  return `  "${id}": {
    profileId: "${id}",
    family: familyForProfile("${id}"),
    intendedIdentity: ${JSON.stringify(d.identity)},
    previousSource: ${JSON.stringify(d.previous)},
    diagnosedProblem: ${JSON.stringify(d.problem)},
    chosenRenderer: "${renderer}",
    layerOrderBalance: ${JSON.stringify(d.layer)},
    rpmLoadShaping: ${JSON.stringify(d.rpm)},
    bassBodyAdjustment: ${JSON.stringify(d.bass)},
    harshnessTreatment: ${JSON.stringify(d.harsh)},
    transmissionEvents: ${JSON.stringify(d.tx)},
    sampleStatus: "${sample}",
    changedCode: ${JSON.stringify(d.code)},
    baselineCapturePath: ${JSON.stringify(baseline)},
    afterCapturePath: ${JSON.stringify(after)},
    automatedCheck: "pending",
    humanListeningStatus: "unverified",
    deviceStatus: "unverified",
    outcome: "${outcome}",
    audibleRationale: ${JSON.stringify(d.rationale)},
    designFamilyHint: "${d.hint}",${blockerLine}${acousticLine}${experienceLine}
  }`;
}

// Fix tank entry - I accidentally put experience as string. Fix EXTRA tank row.
for (let i = 0; i < EXTRA.length; i++) {
  if (EXTRA[i][0] === "tank") {
    EXTRA[i] = [
      "tank",
      "heavy-mechanical",
      "Tank — heavy mechanical tread bed",
      "ImprovedSynth motion",
      "Clipping clatter risk",
      {
        phases: { accelerationTexture: 1.1, cruiseIntrusiveScale: 0.72, releaseCharacter: 0.78 },
        transitionTauSeconds: 0.36,
      },
      "Core/mechanical/env",
      "Slow RPM mass",
      "Tread body",
      "No crackle events",
      "Sparse",
      "asset-pending",
      "Heavier cruise than construction-monster",
    ];
  }
}

const lines = [];
lines.push(`/**
 * Prompt 07 — per-profile catalog tuning (all ${Object.keys(DEFS).length + EXTRA.length} public IDs).
 * Generated by scripts/generate-catalog-tuning-by-profile.mjs — edit defs there and re-run, or edit carefully.
 */

import { familyForProfile } from "@/lib/sound/realism/families";
import type { PublicProfileId } from "@/lib/sound/profile-experience-config";
import type { CatalogTuningEntry } from "@/lib/sound/realism/catalog-tuning/types";
import type { DesignFamilyHint } from "@/lib/sound/realism/catalog-tuning/family-defaults";

export interface CatalogTuningRecord extends CatalogTuningEntry {
  designFamilyHint: DesignFamilyHint;
}

`);

const allEntries = [];

for (const [id, d] of Object.entries(DEFS)) {
  allEntries.push(renderEntry(id, d));
}

for (const row of EXTRA) {
  const [id, hint, identity, previous, problem, experience, layer, rpm, bass, harsh, tx, sample, rationale] =
    row;
  allEntries.push(
    renderEntry(id, {
      hint,
      identity,
      previous,
      problem,
      experience,
      layer,
      rpm,
      bass,
      harsh,
      tx,
      sample,
      rationale,
      code: [`by-profile.ts:${id}`, "applyExperienceCatalogTuning"],
    }),
  );
}

lines.push(`export const CATALOG_TUNING_BY_PROFILE: Record<PublicProfileId, CatalogTuningRecord> = {\n`);
lines.push(allEntries.join(",\n"));
lines.push(`\n};\n\n`);

lines.push(`export function catalogTuningForProfile(profileId: string): CatalogTuningRecord | null {
  return (CATALOG_TUNING_BY_PROFILE as Record<string, CatalogTuningRecord>)[profileId] ?? null;
}

export function allCatalogTuningEntries(): CatalogTuningRecord[] {
  // Avoid importing PUBLIC_PROFILE_IDS (value) — breaks cycle with profile-experience-config.
  return Object.values(CATALOG_TUNING_BY_PROFILE);
}

/** Mark automated check results after test run (mutates in-memory for report export). */
export function setCatalogAutomatedCheck(
  profileId: string,
  status: CatalogTuningRecord["automatedCheck"],
): void {
  const entry = catalogTuningForProfile(profileId);
  if (entry) entry.automatedCheck = status;
}
`);

const out = path.join(process.cwd(), "src/lib/sound/realism/catalog-tuning/by-profile.ts");
await writeFile(out, lines.join(""));
console.log("Wrote", out, "entries", allEntries.length);