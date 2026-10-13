/**
 * Sample Pack Catalog
 * Central registry for all sample pack manifests.
 * Provides lookup and filtering by profile ID.
 */

import type {
  SamplePackEntry,
  SamplePackIndex,
  SamplePackProfileManifest,
  SamplePackProfileSummary,
  DeliveryFormat,
} from "./types";
import { isEntryApproved } from "./types";

import indexData from "./manifests/index.json";
import ambientManifest from "./manifests/ambient.json";
import americanMuscleV8Manifest from "./manifests/american-muscle-v8.json";
import bigTwinManifest from "./manifests/big-twin.json";
import constructionMonsterManifest from "./manifests/construction-monster.json";
import cruiseShipManifest from "./manifests/cruise-ship.json";
import cyberPulseManifest from "./manifests/cyber-pulse.json";
import deepBassPulseManifest from "./manifests/deep-bass-pulse.json";
import dragonManifest from "./manifests/dragon.json";
import electricHypercarManifest from "./manifests/electric-hypercar.json";
import fartingCarManifest from "./manifests/farting-car.json";
import flatSixSportManifest from "./manifests/flat-six-sport.json";
import formulaElectricManifest from "./manifests/formula-electric.json";
import fusionFuturePulseManifest from "./manifests/fusion-future-pulse.json";
import fusionMechanicalSymphonyManifest from "./manifests/fusion-mechanical-symphony.json";
import fusionMidnightBoostManifest from "./manifests/fusion-midnight-boost.json";
import fusionRoadAnthemManifest from "./manifests/fusion-road-anthem.json";
import gtV8Manifest from "./manifests/gt-v8.json";
import heartbeatManifest from "./manifests/heartbeat.json";
import helicopterManifest from "./manifests/helicopter.json";
import highSpeedTrainManifest from "./manifests/high-speed-train.json";
import horseGallopManifest from "./manifests/horse-gallop.json";
import jetSkiManifest from "./manifests/jet-ski.json";
import kazooKartManifest from "./manifests/kazoo-kart.json";
import laughingMachineManifest from "./manifests/laughing-machine.json";
import maglevTrainManifest from "./manifests/maglev-train.json";
import motorcycleSuperbikManifest from "./manifests/motorcycle-superbike.json";
import neonDriveManifest from "./manifests/neon-drive.json";
import oceanDriveManifest from "./manifests/ocean-drive.json";
import openWindManifest from "./manifests/open-wind.json";
import privateJetManifest from "./manifests/private-jet.json";
import raceCarManifest from "./manifests/race-car.json";
import racingV10Manifest from "./manifests/racing-v10.json";
import rainDriveManifest from "./manifests/rain-drive.json";
import rallyCarManifest from "./manifests/rally-car.json";
import retroArcadeManifest from "./manifests/retro-arcade.json";
import romanian85CarriageManifest from "./manifests/romanian-85-carriage.json";
import santaSleighManifest from "./manifests/santa-sleigh.json";
import signatureManifest from "./manifests/signature.json";
import snowmobileManifest from "./manifests/snowmobile.json";
import spaceShipManifest from "./manifests/space-ship.json";
import speedBoatManifest from "./manifests/speed-boat.json";
import steamTrainManifest from "./manifests/steam-train.json";
import stormGliderManifest from "./manifests/storm-glider.json";
import submarineManifest from "./manifests/submarine.json";
import symphonyCinematicRockManifest from "./manifests/symphony-cinematic-rock.json";
import symphonyMotionOrchestraManifest from "./manifests/symphony-motion-orchestra.json";
import symphonyNeonRunManifest from "./manifests/symphony-neon-run.json";
import synthwaveDriveManifest from "./manifests/synthwave-drive.json";
import tankManifest from "./manifests/tank.json";
import thunderBeastManifest from "./manifests/thunder-beast.json";
import turbineJetManifest from "./manifests/turbine-jet.json";
import turboInline6Manifest from "./manifests/turbo-inline-6.json";
import ufoManifest from "./manifests/ufo.json";
import uiManifest from "./manifests/ui.json";
import wiesnTractorManifest from "./manifests/wiesn-tractor.json";
import wildWestCarriageManifest from "./manifests/wild-west-carriage.json";
import worldCyberCityManifest from "./manifests/world-cyber-city.json";
import worldSpaceDriveManifest from "./manifests/world-space-drive.json";
import worldStormRunManifest from "./manifests/world-storm-run.json";
import zenDriveManifest from "./manifests/zen-drive.json";

// M4A delivery manifests (for AAC-encoded assets with gapless loop handling)
import horseGallopM4aManifest from "./manifests-m4a/horse-gallop.json";
import romanian85CarriageM4aManifest from "./manifests-m4a/romanian-85-carriage.json";
import santaSleighM4aManifest from "./manifests-m4a/santa-sleigh.json";
import wildWestCarriageM4aManifest from "./manifests-m4a/wild-west-carriage.json";

/** Package index with profile summaries. */
export const SAMPLE_PACK_INDEX: SamplePackIndex = indexData as SamplePackIndex;

/** All profile manifests keyed by profile ID. */
const PROFILE_MANIFESTS: Record<string, SamplePackProfileManifest> = {
  ambient: ambientManifest as SamplePackProfileManifest,
  "american-muscle-v8": americanMuscleV8Manifest as SamplePackProfileManifest,
  "big-twin": bigTwinManifest as SamplePackProfileManifest,
  "construction-monster": constructionMonsterManifest as SamplePackProfileManifest,
  "cruise-ship": cruiseShipManifest as SamplePackProfileManifest,
  "cyber-pulse": cyberPulseManifest as SamplePackProfileManifest,
  "deep-bass-pulse": deepBassPulseManifest as SamplePackProfileManifest,
  dragon: dragonManifest as SamplePackProfileManifest,
  "electric-hypercar": electricHypercarManifest as SamplePackProfileManifest,
  "farting-car": fartingCarManifest as SamplePackProfileManifest,
  "flat-six-sport": flatSixSportManifest as SamplePackProfileManifest,
  "formula-electric": formulaElectricManifest as SamplePackProfileManifest,
  "fusion-future-pulse": fusionFuturePulseManifest as SamplePackProfileManifest,
  "fusion-mechanical-symphony": fusionMechanicalSymphonyManifest as SamplePackProfileManifest,
  "fusion-midnight-boost": fusionMidnightBoostManifest as SamplePackProfileManifest,
  "fusion-road-anthem": fusionRoadAnthemManifest as SamplePackProfileManifest,
  "gt-v8": gtV8Manifest as SamplePackProfileManifest,
  heartbeat: heartbeatManifest as SamplePackProfileManifest,
  helicopter: helicopterManifest as SamplePackProfileManifest,
  "high-speed-train": highSpeedTrainManifest as SamplePackProfileManifest,
  "horse-gallop": horseGallopManifest as SamplePackProfileManifest,
  "jet-ski": jetSkiManifest as SamplePackProfileManifest,
  "kazoo-kart": kazooKartManifest as SamplePackProfileManifest,
  "laughing-machine": laughingMachineManifest as SamplePackProfileManifest,
  "maglev-train": maglevTrainManifest as SamplePackProfileManifest,
  "motorcycle-superbike": motorcycleSuperbikManifest as SamplePackProfileManifest,
  "neon-drive": neonDriveManifest as SamplePackProfileManifest,
  "ocean-drive": oceanDriveManifest as SamplePackProfileManifest,
  "open-wind": openWindManifest as SamplePackProfileManifest,
  "private-jet": privateJetManifest as SamplePackProfileManifest,
  "race-car": raceCarManifest as SamplePackProfileManifest,
  "racing-v10": racingV10Manifest as SamplePackProfileManifest,
  "rain-drive": rainDriveManifest as SamplePackProfileManifest,
  "rally-car": rallyCarManifest as SamplePackProfileManifest,
  "retro-arcade": retroArcadeManifest as SamplePackProfileManifest,
  "romanian-85-carriage": romanian85CarriageManifest as SamplePackProfileManifest,
  "santa-sleigh": santaSleighManifest as SamplePackProfileManifest,
  signature: signatureManifest as SamplePackProfileManifest,
  snowmobile: snowmobileManifest as SamplePackProfileManifest,
  "space-ship": spaceShipManifest as SamplePackProfileManifest,
  "speed-boat": speedBoatManifest as SamplePackProfileManifest,
  "steam-train": steamTrainManifest as SamplePackProfileManifest,
  "storm-glider": stormGliderManifest as SamplePackProfileManifest,
  submarine: submarineManifest as SamplePackProfileManifest,
  "symphony-cinematic-rock": symphonyCinematicRockManifest as SamplePackProfileManifest,
  "symphony-motion-orchestra": symphonyMotionOrchestraManifest as SamplePackProfileManifest,
  "symphony-neon-run": symphonyNeonRunManifest as SamplePackProfileManifest,
  "synthwave-drive": synthwaveDriveManifest as SamplePackProfileManifest,
  tank: tankManifest as SamplePackProfileManifest,
  "thunder-beast": thunderBeastManifest as SamplePackProfileManifest,
  "turbine-jet": turbineJetManifest as SamplePackProfileManifest,
  "turbo-inline-6": turboInline6Manifest as SamplePackProfileManifest,
  ufo: ufoManifest as SamplePackProfileManifest,
  ui: uiManifest as SamplePackProfileManifest,
  "wiesn-tractor": wiesnTractorManifest as SamplePackProfileManifest,
  "wild-west-carriage": wildWestCarriageManifest as SamplePackProfileManifest,
  "world-cyber-city": worldCyberCityManifest as SamplePackProfileManifest,
  "world-space-drive": worldSpaceDriveManifest as SamplePackProfileManifest,
  "world-storm-run": worldStormRunManifest as SamplePackProfileManifest,
  "zen-drive": zenDriveManifest as SamplePackProfileManifest,
};

/** M4A delivery manifests keyed by profile ID. */
const M4A_PROFILE_MANIFESTS: Record<string, SamplePackProfileManifest> = {
  "horse-gallop": horseGallopM4aManifest as SamplePackProfileManifest,
  "romanian-85-carriage": romanian85CarriageM4aManifest as SamplePackProfileManifest,
  "santa-sleigh": santaSleighM4aManifest as SamplePackProfileManifest,
  "wild-west-carriage": wildWestCarriageM4aManifest as SamplePackProfileManifest,
};

/** Profile IDs that have M4A delivery manifests available. */
export const M4A_AVAILABLE_PROFILES = Object.keys(M4A_PROFILE_MANIFESTS);

/**
 * Check if a profile has M4A delivery manifests available.
 */
export function hasM4aManifest(profileId: string): boolean {
  return profileId in M4A_PROFILE_MANIFESTS;
}

/**
 * List of combustion profile IDs that use RPM/load sample banks.
 */
export const COMBUSTION_PROFILE_IDS = [
  "american-muscle-v8",
  "big-twin",
  "flat-six-sport",
  "gt-v8",
  "motorcycle-superbike",
  "race-car",
  "racing-v10",
  "rally-car",
  "turbo-inline-6",
  "wiesn-tractor",
  "snowmobile",
  "tank",
  "construction-monster",
] as const;

export type CombustionProfileId = (typeof COMBUSTION_PROFILE_IDS)[number];

/**
 * System profile IDs (not sound profiles).
 */
export const SYSTEM_PROFILE_IDS = ["ambient", "ui", "signature"] as const;

export type SystemProfileId = (typeof SYSTEM_PROFILE_IDS)[number];

/**
 * Get the manifest for a profile.
 * @param profileId - The profile ID to look up.
 * @param format - Optional delivery format (defaults to "wav"). When "m4a" and
 *   available, returns the M4A delivery manifest with AAC gapless loop metadata.
 */
export function getProfileManifest(
  profileId: string,
  format?: DeliveryFormat,
): SamplePackProfileManifest | null {
  // If M4A format requested and available, use M4A manifest
  if (format === "m4a" && profileId in M4A_PROFILE_MANIFESTS) {
    return M4A_PROFILE_MANIFESTS[profileId] ?? null;
  }
  // Fall back to WAV manifest
  return PROFILE_MANIFESTS[profileId] ?? null;
}

/**
 * Get profile summary from index.
 */
export function getProfileSummary(
  profileId: string,
): SamplePackProfileSummary | null {
  return SAMPLE_PACK_INDEX.profiles.find((p) => p.profileId === profileId) ?? null;
}

/**
 * Get all registered profile IDs.
 */
export function getAllProfileIds(): string[] {
  return Object.keys(PROFILE_MANIFESTS);
}

/**
 * Get all app sound profile IDs (excluding system profiles).
 */
export function getAppProfileIds(): string[] {
  const systemSet = new Set<string>(SYSTEM_PROFILE_IDS);
  return Object.keys(PROFILE_MANIFESTS).filter((id) => !systemSet.has(id));
}

/**
 * Check if a profile is a combustion profile.
 */
export function isCombustionProfile(profileId: string): boolean {
  return (COMBUSTION_PROFILE_IDS as readonly string[]).includes(profileId);
}

/**
 * Check if a profile is a system profile.
 */
export function isSystemProfile(profileId: string): boolean {
  return (SYSTEM_PROFILE_IDS as readonly string[]).includes(profileId);
}

/**
 * Get all entries for a profile.
 * @param profileId - The profile ID.
 * @param format - Optional delivery format for manifest selection.
 */
export function getProfileEntries(
  profileId: string,
  format?: DeliveryFormat,
): SamplePackEntry[] {
  const manifest = getProfileManifest(profileId, format);
  return manifest?.entries ?? [];
}

/**
 * Get only approved entries for a profile.
 */
export function getApprovedProfileEntries(
  profileId: string,
  format?: DeliveryFormat,
): SamplePackEntry[] {
  return getProfileEntries(profileId, format).filter(isEntryApproved);
}

/**
 * Get loop entries for a profile.
 */
export function getProfileLoops(
  profileId: string,
  format?: DeliveryFormat,
): SamplePackEntry[] {
  return getProfileEntries(profileId, format).filter((e) => e.kind === "loop");
}

/**
 * Get one-shot entries for a profile.
 */
export function getProfileOneShots(
  profileId: string,
  format?: DeliveryFormat,
): SamplePackEntry[] {
  return getProfileEntries(profileId, format).filter((e) => e.kind === "one-shot");
}

/**
 * Check if any approved entries exist for a profile.
 */
export function hasApprovedEntries(profileId: string): boolean {
  return getApprovedProfileEntries(profileId).length > 0;
}

/**
 * Get catalog statistics.
 */
export function getCatalogStats(): {
  totalProfiles: number;
  appProfiles: number;
  systemProfiles: number;
  totalEntries: number;
  totalLoops: number;
  totalOneShots: number;
  approvedEntries: number;
} {
  let totalEntries = 0;
  let totalLoops = 0;
  let totalOneShots = 0;
  let approvedEntries = 0;

  for (const profileId of getAllProfileIds()) {
    const entries = getProfileEntries(profileId);
    totalEntries += entries.length;
    totalLoops += entries.filter((e) => e.kind === "loop").length;
    totalOneShots += entries.filter((e) => e.kind === "one-shot").length;
    approvedEntries += entries.filter(isEntryApproved).length;
  }

  return {
    totalProfiles: getAllProfileIds().length,
    appProfiles: getAppProfileIds().length,
    systemProfiles: SYSTEM_PROFILE_IDS.length,
    totalEntries,
    totalLoops,
    totalOneShots,
    approvedEntries,
  };
}
