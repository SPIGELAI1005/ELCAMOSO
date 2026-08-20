import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type ElcamosoSettings,
} from "@/lib/drive/settings";

export function useSettings() {
  const [settings, setSettings] = useState<ElcamosoSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(readSettings());
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

  return { settings, update };
}
