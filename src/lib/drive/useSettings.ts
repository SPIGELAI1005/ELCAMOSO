import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SETTINGS,
  getLastLoadReport,
  materializeCustom,
  readSettings,
  writeSettings,
  type ElcamosoSettings,
  type LoadReport,
} from "@/lib/drive/settings";
import { registerCustomProfiles } from "@/lib/sound/profiles";
import { setRuntimeFusionPresets, type FusionPreset } from "@/lib/fusion";
import {
  setRuntimeFusionParams,
  setRuntimeSymphonyParams,
  type ExperiencePreset,
} from "@/lib/studio";
import type { SoundProfile } from "@/lib/sound/profiles";

function materializeFusionProfile(saved: { id: string; name: string }): SoundProfile {
  return {
    id: saved.id,
    name: saved.name,
    category: "Musical",
    traits: ["Fusion", "Machine", "Music"],
    description: "Saved Fusion blend.",
    drivetrainMode: "continuous",
    motionModel: "ambient",
    sourceMode: "hybrid",
    access: "free",
    voice: {
      baseFrequency: 100,
      harmonics: [1],
      waveResponse: 0.5,
      filterBase: 400,
      filterRange: 800,
      noise: 0,
      wave: "sine",
      detune: 0,
      coreLevel: 0.5,
    },
  };
}

function applyExperienceRuntime(presets: ExperiencePreset[]) {
  for (const p of presets) {
    if (p.kind === "symphony" && p.symphonyPackId && p.symphonyParams) {
      setRuntimeSymphonyParams(p.symphonyPackId, p.symphonyParams);
    }
    if (p.kind === "fusion" && p.fusionParams) {
      setRuntimeFusionParams(p.id, p.fusionParams);
    }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<ElcamosoSettings>(DEFAULT_SETTINGS);
  /** false until the stored settings have been read on the client */
  const [loaded, setLoaded] = useState(false);
  const [loadReport, setLoadReport] = useState<LoadReport>(() => getLastLoadReport());

  useEffect(() => {
    const sync = () => {
      // Never let a storage failure keep the app in a loading state: fall back
      // to defaults so Drive stays reachable.
      try {
        setSettings(readSettings());
        setLoadReport(getLastLoadReport());
      } catch (error) {
        setSettings(DEFAULT_SETTINGS);
        setLoadReport({
          outcome: "corrupt",
          at: Date.now(),
          size: 0,
          issues: [
            {
              field: "storage",
              detail: error instanceof Error ? error.message : "unreadable",
            },
          ],
          message:
            "Saved settings could not be read on this device, so defaults are in use. Drive still works.",
        });
      }
    };
    try {
      sync();
    } finally {
      setLoaded(true);
    }
    window.addEventListener("elcamoso:settings", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("elcamoso:settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Studio creations + saved Fusion must be resolvable by id everywhere the engine looks them up.
  const customProfiles = useMemo(() => {
    const studio = settings.customSounds.map(materializeCustom);
    const fusionProfiles = settings.savedFusionPresets.map(materializeFusionProfile);
    registerCustomProfiles([...studio, ...fusionProfiles]);
    const runtime: FusionPreset[] = settings.savedFusionPresets.map((s) => ({
      id: s.id,
      name: s.name,
      tagline: "Saved Fusion",
      description: "Custom Machine + Music blend from Garage.",
      machineProfileId: s.machineProfileId,
      symphonyProfileId: s.symphonyProfileId,
      defaultMix: s.mix,
      harmonicResonance: s.harmonicResonance,
      softPump: false,
    }));
    setRuntimeFusionPresets(runtime);
    applyExperienceRuntime(settings.experiencePresets ?? []);
    return [...studio, ...fusionProfiles];
  }, [settings.customSounds, settings.savedFusionPresets, settings.experiencePresets]);

  const update = useCallback((next: Partial<ElcamosoSettings>) => {
    setSettings(writeSettings(next));
    setLoadReport(getLastLoadReport());
  }, []);

  return { settings, update, loaded, loadReport, customProfiles };
}
