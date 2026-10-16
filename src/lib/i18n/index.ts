import {
  convertSpeedMps,
  formatSpeedText,
  resolveSpeedUnit,
  speedUnitLabel,
} from "@/lib/drive/speed-units";
export type Locale = "en" | "de" | "ro";
export type Units = "metric" | "imperial";

const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.drive": "Drive",
    "nav.explore": "Explore",
    "nav.sounds": "Sounds",
    "nav.browseSounds": "Browse all",
    "nav.studio": "Studio",
    "nav.garage": "Garage",
    "nav.demo": "Demo",
    "nav.pricing": "Pricing",
    "nav.settings": "Settings",
    "nav.about": "About",
    "nav.story": "Story",
    "nav.science": "Science",
    "nav.account": "Account",
    "nav.signIn": "Sign in",
    "nav.profile": "Profile",
    "nav.menu": "Open menu",
    "nav.close": "Close menu",
    "nav.menuHint": "Your EV. Your Sound.",
    "account.signInTitle": "Sign in",
    "account.signInBody":
      "Sign in to sync your plan, save Dynamic Drive Preview, and pick up where you left off.",
    "account.profileTitle": "Your account",
    "account.signOut": "Sign out",
    "account.signingOut": "Signing out…",
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
    "settings.unitsMetric": "Metric (km/h)",
    "settings.unitsImperial": "Imperial (mph)",
    "settings.knots": "Themed speed units for boats, planes and space",
    "settings.knotsHint":
      "Boats and aircraft show knots (1 kn = 1.852 km/h). Space Ship, UFO and Space Drive show a fraction of light speed, like 5.6 × 10⁻⁸ c. Turn off to keep km/h or mph.",
    "pricing.earlyAccessTitle": "Early access — test drive ELCAMOSO for free",
    "pricing.earlyAccessBody":
      "We're fine-tuning every sound profile on real roads before launch. Until then, enjoy ELCAMOSO free of charge and help shape the final experience. Drive+ and individual sound purchases open on 9.11.2026.",
    "intense.confirm": "This Sound Profile is rated intense. Continue?",
  },
  de: {
    "nav.home": "Start",
    "nav.drive": "Fahrt",
    "nav.explore": "Entdecken",
    "nav.sounds": "Klange",
    "nav.browseSounds": "Alle anzeigen",
    "nav.studio": "Studio",
    "nav.garage": "Garage",
    "nav.demo": "Demo",
    "nav.pricing": "Preise",
    "nav.settings": "Einstellungen",
    "nav.about": "Uber",
    "nav.story": "Geschichte",
    "nav.science": "Wissenschaft",
    "nav.account": "Konto",
    "nav.signIn": "Anmelden",
    "nav.profile": "Profil",
    "nav.menu": "Menue oeffnen",
    "nav.close": "Menue schliessen",
    "nav.menuHint": "Dein EV. Dein Sound.",
    "account.signInTitle": "Anmelden",
    "account.signInBody":
      "Melde dich an, um deinen Plan zu synchronisieren und Dynamic Drive Preview zu speichern.",
    "account.profileTitle": "Dein Konto",
    "account.signOut": "Abmelden",
    "account.signingOut": "Abmelden…",
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
    "settings.unitsMetric": "Metrisch (km/h)",
    "settings.unitsImperial": "Imperial (mph)",
    "settings.knots": "Themen-Einheiten fuer Boote, Flugzeuge und Weltraum",
    "settings.knotsHint":
      "Boote und Flugzeuge zeigen Knoten (1 kn = 1,852 km/h). Space Ship, UFO und Space Drive zeigen einen Bruchteil der Lichtgeschwindigkeit, z. B. 5,6 × 10⁻⁸ c. Ausschalten fuer km/h oder mph.",
    "pricing.earlyAccessTitle": "Early Access — ELCAMOSO kostenlos testen",
    "pricing.earlyAccessBody":
      "Wir feilen noch an jedem Soundprofil auf echten Strassen vor dem Launch. Bis dahin ist ELCAMOSO kostenlos — hilf mit, das finale Erlebnis zu formen. Drive+ und einzelne Sound-Kaeufe starten am 9.11.2026.",
    "intense.confirm": "Dieses Klangprofil ist als intensiv eingestuft. Fortfahren?",
  },
  ro: {
    "nav.home": "Acasa",
    "nav.drive": "Condus",
    "nav.explore": "Exploreaza",
    "nav.sounds": "Sunete",
    "nav.browseSounds": "Vezi toate",
    "nav.studio": "Studio",
    "nav.garage": "Garaj",
    "nav.demo": "Demo",
    "nav.pricing": "Preturi",
    "nav.settings": "Setari",
    "nav.about": "Despre",
    "nav.story": "Poveste",
    "nav.science": "Stiinta",
    "nav.account": "Cont",
    "nav.signIn": "Autentificare",
    "nav.profile": "Profil",
    "nav.menu": "Deschide meniul",
    "nav.close": "Inchide meniul",
    "nav.menuHint": "EV-ul tau. Sunetul tau.",
    "account.signInTitle": "Autentificare",
    "account.signInBody":
      "Autentifica-te pentru a-ti sincroniza planul si a salva Dynamic Drive Preview.",
    "account.profileTitle": "Contul tau",
    "account.signOut": "Deconectare",
    "account.signingOut": "Deconectare…",
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
    "settings.unitsMetric": "Metric (km/h)",
    "settings.unitsImperial": "Imperial (mph)",
    "settings.knots": "Unitati tematice pentru barci, avioane si spatiu",
    "settings.knotsHint":
      "Barcile si avioanele afiseaza noduri (1 kn = 1,852 km/h). Space Ship, UFO si Space Drive afiseaza o fractiune din viteza luminii, de ex. 5,6 × 10⁻⁸ c. Dezactiveaza pentru km/h sau mph.",
    "pricing.earlyAccessTitle": "Acces early — testeaza ELCAMOSO gratuit",
    "pricing.earlyAccessBody":
      "Rafinam fiecare profil de sunet pe drumuri reale inainte de lansare. Pana atunci, ELCAMOSO este gratuit — ajuta-ne sa modelam experienta finala. Drive+ si achizitiile individuale de sunete se deschid pe 9.11.2026.",
    "intense.confirm": "Acest profil de sunet este intens. Continui?",
  },
};

export function t(locale: Locale, key: string): string {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
}

export function formatSpeed(
  mps: number,
  units: Units,
  _locale: Locale,
  opts?: { profileId?: string | null; knotsForNautical?: boolean },
): { value: number; unit: string; text: string } {
  const unit = resolveSpeedUnit(units, opts?.profileId, opts?.knotsForNautical ?? false);
  const raw = convertSpeedMps(mps, unit);
  return {
    value: unit === "c" ? raw : Math.round(raw),
    unit: speedUnitLabel(unit),
    text: formatSpeedText(mps, unit),
  };
}

export function formatNumber(value: number, locale: Locale, digits = 0): string {
  const tag = locale === "en" ? "en-GB" : locale === "de" ? "de-DE" : "ro-RO";
  return new Intl.NumberFormat(tag, { maximumFractionDigits: digits }).format(value);
}
