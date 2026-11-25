import { describe, expect, it } from "vitest";
import { SOUND_PROFILES, DEFAULT_PROFILE_ID, allProfiles } from "@/lib/sound/profiles";
import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";
import { findSoundsFromPrompt } from "@/lib/sound/find-sound";
import { profilesByMood, searchProfiles } from "@/lib/sound/moods";
import { parseSharedSoundParam, shouldApplySharedSound, soundShareSocialMeta } from "@/lib/drive/sound-share";
import { getSitemapPaths, buildSitemapXml } from "@/lib/seo";
import {
  ADMIN_ONLY_PROFILE_IDS,
  isAdminOnlyProfile,
  resolveVisibleProfileId,
  visibleProfileList,
} from "@/lib/sound/admin-only-profiles";

const CARAVAN = "caravan-carriage";

describe("admin-only sound profiles", () => {
  it("treats Caravan Carriage as admin-only and keeps the public catalog at the pre-PR size", () => {
    expect(ADMIN_ONLY_PROFILE_IDS).toContain(CARAVAN);
    expect(isAdminOnlyProfile(CARAVAN)).toBe(true);
    expect(isAdminOnlyProfile("classic-vespa")).toBe(false);
    expect(isAdminOnlyProfile(null)).toBe(false);
    const publicCatalog = visibleProfileList(SOUND_PROFILES, false);
    expect(publicCatalog.some((p) => p.id === CARAVAN)).toBe(false);
    expect(publicCatalog).toHaveLength(72);
    expect(visibleProfileList(SOUND_PROFILES, true).some((p) => p.id === CARAVAN)).toBe(true);
    expect(visibleProfileList(SOUND_PROFILES, true)).toHaveLength(SOUND_PROFILES.length);
    expect(SOUND_PROFILES).toHaveLength(73);
  });

  it("falls back to the default profile for non-admins and keeps the id for admins", () => {
    expect(FALLBACK_SOUND_PROFILE_ID).toBe(DEFAULT_PROFILE_ID);
    expect(resolveVisibleProfileId(CARAVAN, false)).toBe(DEFAULT_PROFILE_ID);
    expect(resolveVisibleProfileId(CARAVAN, true)).toBe(CARAVAN);
    expect(resolveVisibleProfileId("traby", false)).toBe("traby");
    expect(resolveVisibleProfileId(null, false)).toBe(DEFAULT_PROFILE_ID);
  });

  it("hides Caravan Carriage from public search, mood lists, and the header picker", () => {
    expect(findSoundsFromPrompt("fiare vechi", 5, false).some((m) => m.profileId === CARAVAN)).toBe(
      false,
    );
    expect(findSoundsFromPrompt("caravan carriage", 5, false).some((m) => m.profileId === CARAVAN)).toBe(
      false,
    );
    expect(findSoundsFromPrompt("fiare vechi", 5, true).some((m) => m.profileId === CARAVAN)).toBe(true);
    expect(searchProfiles("caravan", "all", false).some((p) => p.id === CARAVAN)).toBe(false);
    expect(searchProfiles("caravan", "all", true).some((p) => p.id === CARAVAN)).toBe(true);
    expect(profilesByMood("all", false).some((p) => p.id === CARAVAN)).toBe(false);
    expect(profilesByMood("all", true).some((p) => p.id === CARAVAN)).toBe(true);
    expect(allProfiles().some((p) => p.id === CARAVAN)).toBe(true);
  });

  it("does not apply a Caravan Carriage deep link for non-admins and uses generic social meta", () => {
    expect(parseSharedSoundParam(CARAVAN)).toBe(CARAVAN);
    const base = {
      current: "racing-v10",
      alreadyApplied: false,
      lockedFallback: null,
      fallbackId: "racing-v10",
      canDrive: () => true,
    };
    expect(shouldApplySharedSound({ ...base, shared: CARAVAN, isAdmin: false })).toBe(false);
    expect(shouldApplySharedSound({ ...base, shared: CARAVAN, isAdmin: true })).toBe(true);
    expect(shouldApplySharedSound({ ...base, shared: "traby", isAdmin: false })).toBe(true);
    const publicMeta = soundShareSocialMeta(CARAVAN, false);
    expect(publicMeta.title.toLowerCase()).not.toContain("caravan");
    expect(publicMeta.image ?? "").not.toContain("caravan-carriage");
    const adminMeta = soundShareSocialMeta(CARAVAN, true);
    expect(adminMeta.title).toMatch(/Caravan Carriage/);
  });

  it("does not list Caravan Carriage in the sitemap", () => {
    const xml = buildSitemapXml(getSitemapPaths());
    expect(xml).not.toContain("caravan-carriage");
    expect(xml).not.toContain("Caravan Carriage");
  });
});
