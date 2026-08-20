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
          status: "corrupt",
          at: Date.now(),
          issues: [
            {
              field: "storage",
              detail: error instanceof Error ? error.message : "unreadable",
            },
          ],
          source: "fallback",
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


  // Studio creations must be resolvable by id everywhere the engine looks them up.
  const customProfiles = useMemo(() => {
    const list = settings.customSounds.map(materializeCustom);
    registerCustomProfiles(list);
    return list;
  }, [settings.customSounds]);

  const update = useCallback((next: Partial<ElcamosoSettings>) => {
    setSettings(writeSettings(next));
    setLoadReport(getLastLoadReport());
  }, []);

  return { settings, update, loaded, loadReport, customProfiles };
}
