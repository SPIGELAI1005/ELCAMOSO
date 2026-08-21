export type Locale = "en" | "de" | "ro";
export type Units = "metric" | "imperial";

const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.drive": "Drive",
    "nav.sounds": "Sounds",
    "nav.studio": "Studio",
    "nav.garage": "Garage",
    "nav.demo": "Demo",
    "nav.settings": "Settings",
    "nav.menu": "Open menu",
    "nav.close": "Close menu",
    "nav.menuHint": "Your EV. Your Sound. More Emotion.",
    "player.stop": "Stop",
    "player.playing": "Playing",
    "drive.start": "Start Drive",
    "drive.stop": "Stop Drive",
    "drive.cockpit": "Cockpit",
    "speed.unit": "km/h",
    "settings.search": "Search settings",
    "settings.restore": "Restore recommended setup",
    "settings.language": "Language",
    "settings.units": "Units",
    "intense.confirm": "This Sound Profile is rated intense. Continue?",
  },
  de: {
    "nav.home": "Start",
    "nav.drive": "Fahrt",
    "nav.sounds": "Klange",
    "nav.studio": "Studio",
    "nav.garage": "Garage",
    "nav.demo": "Demo",
    "nav.settings": "Einstellungen",
    "nav.menu": "Menue oeffnen",
    "nav.close": "Menue schliessen",
    "nav.menuHint": "Dein EV. Dein Sound. Mehr Emotion.",
    "player.stop": "Stopp",
    "player.playing": "Aktiv",
    "drive.start": "Fahrt starten",
    "drive.stop": "Fahrt beenden",
    "drive.cockpit": "Cockpit",
    "speed.unit": "km/h",
    "settings.search": "Einstellungen suchen",
    "settings.restore": "Empfohlene Einrichtung wiederherstellen",
    "settings.language": "Sprache",
    "settings.units": "Einheiten",
    "intense.confirm": "Dieses Klangprofil ist als intensiv eingestuft. Fortfahren?",
  },
  ro: {
    "nav.home": "Acasa",
    "nav.drive": "Condus",
    "nav.sounds": "Sunete",
    "nav.studio": "Studio",
    "nav.garage": "Garaj",
    "nav.demo": "Demo",
    "nav.settings": "Setari",
    "nav.menu": "Deschide meniul",
    "nav.close": "Inchide meniul",
    "nav.menuHint": "EV-ul tau. Sunetul tau. Mai multa emotie.",
    "player.stop": "Stop",
    "player.playing": "Redare",
    "drive.start": "Porneste",
    "drive.stop": "Opreste",
    "drive.cockpit": "Cockpit",
    "speed.unit": "km/h",
    "settings.search": "Cauta setari",
    "settings.restore": "Restabileste configurarea recomandata",
    "settings.language": "Limba",
    "settings.units": "Unitati",
    "intense.confirm": "Acest profil de sunet este intens. Continui?",
  },
};

export function t(locale: Locale, key: string): string {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
}

export function formatSpeed(mps: number, units: Units, locale: Locale): { value: number; unit: string } {
  if (units === "imperial") {
    return { value: Math.round(mps * 2.236936), unit: locale === "de" ? "mph" : "mph" };
  }
  return { value: Math.round(mps * 3.6), unit: "km/h" };
}

export function formatNumber(value: number, locale: Locale, digits = 0): string {
  const tag = locale === "en" ? "en-GB" : locale === "de" ? "de-DE" : "ro-RO";
  return new Intl.NumberFormat(tag, { maximumFractionDigits: digits }).format(value);
}
