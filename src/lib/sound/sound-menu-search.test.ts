import { describe, expect, it } from "vitest";
import {
  driveSpecialPinned,
  profileIdForMenuItem,
  filterMenuGroups,
  matchesSoundQuery,
  normalizeSearch,
  pricingHrefForProfile,
  packageForProfile,
} from "@/lib/sound/sound-menu-search";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import { profilesByCategory } from "@/components/HeaderSoundsMenu";
import { t } from "@/lib/i18n";

const romanian = {
  id: "romanian-85-carriage",
  name: "Romanian '85 Carriage",
  category: "Heritage",
};

describe("sounds search", () => {
  it("is case and diacritic insensitive", () => {
    expect(normalizeSearch("Trăsură ȘÎ Straße")).toBe("trasura si strasse");
    expect(matchesSoundQuery(romanian, "ROMANIAN")).toBe(true);
    expect(matchesSoundQuery(romanian, "trăsură")).toBe(true);
    expect(matchesSoundQuery(romanian, "Kutsche")).toBe(true);
    expect(matchesSoundQuery(romanian, "rocket")).toBe(false);
  });
  it("matches DE/RO words for police and music", () => {
    const police = SOUND_PROFILES.find((p) => p.id === "police-patrol")!;
    expect(matchesSoundQuery(police, "polizei")).toBe(true);
    expect(matchesSoundQuery(police, "poliție")).toBe(true);
    const music = SOUND_PROFILES.find((p) => p.id.startsWith("symphony-"))!;
    expect(matchesSoundQuery(music, "muzică")).toBe(true);
  });
  it("drops empty groups and returns nothing for no match", () => {
    const groups = profilesByCategory(Date.parse("2026-11-05T12:00:00+01:00"));
    expect(filterMenuGroups(groups, "zzzz-nothing")).toEqual([]);
    expect(filterMenuGroups(groups, "").length).toBe(groups.length);
  });
  it("sends locked sounds to the right package", () => {
    expect(pricingHrefForProfile("symphony-neon-run")).toBe("/pricing#drive-music");
    expect(pricingHrefForProfile("police-patrol")).toBe("/pricing#drive-plus");
  });
  it("has No match in EN/DE/RO", () => {
    expect(t("en", "sounds.noMatch")).toBe("No match");
    expect(t("de", "sounds.noMatch")).toBe("Kein Treffer");
    expect(t("ro", "sounds.noMatch")).toBe("Niciun rezultat");
  });
});

describe("special pinning", () => {
  it("puts the named sounds then music on top while active, none after", () => {
    const { pinned } = driveSpecialPinned(SOUND_PROFILES);
    expect(pinned.slice(0, 5).map((p) => p.id)).toEqual([
      "american-muscle-v8",
      "racing-v10",
      "police-patrol",
      "wild-west-carriage",
      "romanian-85-carriage",
    ]);
    expect(pinned.slice(5).every((p) => /^(symphony-|fusion-|genre:)/.test(p.id))).toBe(true);
    const ids = pinned.map((p) => p.id);
    expect(ids).not.toContain("fusion-mechanical-symphony");
    expect(ids).not.toContain("fusion-future-pulse");
    expect(pinned.slice(5, 20).map((p) => p.name)).toEqual([
      "Cinematic Orchestra",
      "House / Techno",
      "Rock",
      "Pop",
      "Metal",
      "Hip-hop",
      "Country",
      "Vienna Waltz",
      "Electro Bass",
      "Road Anthem",
      "Midnight Dark Rave",
      "Latino Fiesta",
      "Gothic Night",
      "Piano Flow",
      "Jazz Cruise",
    ]);
    expect(profileIdForMenuItem("genre:rock")).toBe("symphony-motion-orchestra");
    expect(profileIdForMenuItem("genre:darkrave")).toBe("fusion-midnight-boost");
    expect(packageForProfile("genre:gothic")).toBe("drive_music");
    const musical = profilesByCategory(Date.parse("2026-11-15T12:00:00+01:00")).find(
      (g) => g.category === "Musical",
    );
    expect(musical?.profiles.map((p) => p.id)).toEqual(
      expect.arrayContaining(["fusion-mechanical-symphony", "fusion-future-pulse"]),
    );
    expect(profilesByCategory(Date.parse("2026-11-15T12:00:00+01:00"))[0].category).toBe(
      "Black Friday Special",
    );
    expect(profilesByCategory(Date.parse("2026-11-08T23:59:59+01:00"))[0].category).not.toBe(
      "Black Friday Special",
    );
    expect(profilesByCategory(Date.parse("2026-11-28T00:00:00+01:00"))[0].category).not.toBe(
      "Black Friday Special",
    );
  });
});
