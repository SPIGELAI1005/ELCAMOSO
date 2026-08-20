import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type ElcamosoSettings,
} from "@/lib/drive/settings";

export function useSettings() {
  const [settings, setSettings] = useState<ElcamosoSettings>(DEFAULT_SETTINGS);
  /** false until the stored settings have been read on the client */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setLoaded(true);
    const sync = () => setSettings(readSettings());
    window.addEventListener("elcamoso:settings", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("elcamoso:settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((next: Partial<ElcamosoSettings>) => {
    setSettings(writeSettings(next));
  }, []);

  return { settings, update, loaded };
}
