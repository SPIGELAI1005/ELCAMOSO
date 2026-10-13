import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  // Types
  isCombustionLoop,
  isNonCombustionLoop,
  isTransient,
  isEntryApproved,
  isEntryUnknown,
  
  // Catalog
  SAMPLE_PACK_INDEX,
  getAllProfileIds,
  getAppProfileIds,
  getProfileManifest,
  getProfileSummary,
  getProfileEntries,
  getProfileLoops,
  getProfileOneShots,
  isCombustionProfile,
  isSystemProfile,
  getCatalogStats,
  COMBUSTION_PROFILE_IDS,
  SYSTEM_PROFILE_IDS,
  
  // Approval
  isUnapprovedPacksAllowed,
  setUnapprovedPacksAllowed,
  getApprovedProfileIds,
  approveProfile,
  revokeProfileApproval,
  isProfileApproved,
  checkEntryApproval,
  filterApprovedEntries,
  getLoadableEntries,
  getProfileApprovalStatus,
  resetAllApprovals,
  
  // Engine
  buildCombustionSampleBank,
  buildSpeedKeyedSampleBank,
  buildTransientPools,
  buildUnifiedSampleBank,
  selectSpeedKeyedLoops,
  selectTransientVariant,
  getAvailableTransientKinds,
  getSampleEngineDiagnostics,
  
  // Delivery
  getAssetBaseUrl,
  buildAssetUrl,
  verifyChecksum,
  getCacheStats,
  clearBufferCache,
} from "./index";

describe("Sample Pack Types", () => {
  it("identifies combustion loops correctly", () => {
    const entry = getProfileEntries("american-muscle-v8").find((e) => e.kind === "loop");
    expect(entry).toBeDefined();
    if (entry) {
      expect(isCombustionLoop(entry)).toBe(true);
      expect(isNonCombustionLoop(entry)).toBe(false);
      expect(isTransient(entry)).toBe(false);
    }
  });

  it("identifies non-combustion loops correctly", () => {
    const entry = getProfileEntries("horse-gallop").find((e) => e.kind === "loop");
    expect(entry).toBeDefined();
    if (entry) {
      expect(isNonCombustionLoop(entry)).toBe(true);
      expect(isCombustionLoop(entry)).toBe(false);
      expect(isTransient(entry)).toBe(false);
    }
  });

  it("identifies transients correctly", () => {
    const entry = getProfileEntries("american-muscle-v8").find((e) => e.kind === "one-shot");
    expect(entry).toBeDefined();
    if (entry) {
      expect(isTransient(entry)).toBe(true);
      expect(isCombustionLoop(entry)).toBe(false);
      expect(isNonCombustionLoop(entry)).toBe(false);
    }
  });
});

describe("Sample Pack Catalog", () => {
  it("loads index with correct structure", () => {
    expect(SAMPLE_PACK_INDEX.version).toBe(1);
    expect(SAMPLE_PACK_INDEX.sampleRateHz).toBe(48000);
    expect(SAMPLE_PACK_INDEX.bitDepth).toBe(24);
    expect(SAMPLE_PACK_INDEX.channelFormat).toBe("mono");
    expect(SAMPLE_PACK_INDEX.totals.profiles).toBe(60);
    expect(SAMPLE_PACK_INDEX.totals.files).toBe(1112);
  });

  it("lists all profile IDs", () => {
    const ids = getAllProfileIds();
    expect(ids.length).toBe(60);
    expect(ids).toContain("american-muscle-v8");
    expect(ids).toContain("horse-gallop");
    expect(ids).toContain("ambient");
    expect(ids).toContain("ui");
  });

  it("lists app profile IDs excluding system", () => {
    const appIds = getAppProfileIds();
    expect(appIds.length).toBe(57);
    expect(appIds).not.toContain("ambient");
    expect(appIds).not.toContain("ui");
    expect(appIds).not.toContain("signature");
  });

  it("identifies combustion profiles", () => {
    expect(isCombustionProfile("american-muscle-v8")).toBe(true);
    expect(isCombustionProfile("gt-v8")).toBe(true);
    expect(isCombustionProfile("flat-six-sport")).toBe(true);
    expect(isCombustionProfile("horse-gallop")).toBe(false);
    expect(isCombustionProfile("cyber-pulse")).toBe(false);
  });

  it("identifies system profiles", () => {
    expect(isSystemProfile("ambient")).toBe(true);
    expect(isSystemProfile("ui")).toBe(true);
    expect(isSystemProfile("signature")).toBe(true);
    expect(isSystemProfile("american-muscle-v8")).toBe(false);
  });

  it("loads profile manifests", () => {
    const manifest = getProfileManifest("american-muscle-v8");
    expect(manifest).not.toBeNull();
    expect(manifest?.profileId).toBe("american-muscle-v8");
    expect(manifest?.familyId).toBe("american-v8");
    expect(manifest?.entries.length).toBeGreaterThan(0);
  });

  it("loads profile summary from index", () => {
    const summary = getProfileSummary("american-muscle-v8");
    expect(summary).not.toBeNull();
    expect(summary?.quality).toBe("good");
    expect(summary?.loops).toBe(22);
    expect(summary?.oneShots).toBe(23);
  });

  it("gets profile entries", () => {
    const entries = getProfileEntries("american-muscle-v8");
    expect(entries.length).toBe(45);
  });

  it("filters loops and one-shots", () => {
    const loops = getProfileLoops("american-muscle-v8");
    const oneShots = getProfileOneShots("american-muscle-v8");
    expect(loops.length).toBe(22);
    expect(oneShots.length).toBe(23);
  });

  it("calculates catalog statistics", () => {
    const stats = getCatalogStats();
    expect(stats.totalProfiles).toBe(60);
    expect(stats.appProfiles).toBe(57);
    expect(stats.systemProfiles).toBe(3);
    expect(stats.totalEntries).toBe(1112);
    expect(stats.totalLoops).toBeGreaterThan(0);
    expect(stats.totalOneShots).toBeGreaterThan(0);
  });
});

describe("Approval Gating", () => {
  beforeEach(() => {
    resetAllApprovals();
  });

  afterEach(() => {
    resetAllApprovals();
  });

  it("starts with no approvals", () => {
    expect(isUnapprovedPacksAllowed()).toBe(false);
    expect(getApprovedProfileIds().size).toBe(0);
  });

  it("can toggle unapproved packs flag", () => {
    expect(isUnapprovedPacksAllowed()).toBe(false);
    setUnapprovedPacksAllowed(true);
    expect(isUnapprovedPacksAllowed()).toBe(true);
    setUnapprovedPacksAllowed(false);
    expect(isUnapprovedPacksAllowed()).toBe(false);
  });

  it("can approve and revoke profiles", () => {
    expect(getApprovedProfileIds().has("american-muscle-v8")).toBe(false);
    approveProfile("american-muscle-v8");
    expect(getApprovedProfileIds().has("american-muscle-v8")).toBe(true);
    revokeProfileApproval("american-muscle-v8");
    expect(getApprovedProfileIds().has("american-muscle-v8")).toBe(false);
  });

  it("checks entry approval status", () => {
    const entries = getProfileEntries("american-muscle-v8");
    const entry = entries[0]!;
    
    // By default, entries with "unknown" approval are blocked
    const result = checkEntryApproval(entry);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("blocked");
  });

  it("allows unapproved entries when flag is set", () => {
    setUnapprovedPacksAllowed(true);
    const entries = getProfileEntries("american-muscle-v8");
    const entry = entries[0]!;
    
    const result = checkEntryApproval(entry);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("unapproved-allowed");
  });

  it("allows entries for manually approved profiles", () => {
    approveProfile("american-muscle-v8");
    const entries = getProfileEntries("american-muscle-v8");
    const entry = entries[0]!;
    
    const result = checkEntryApproval(entry);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("profile-approved");
  });

  it("filters approved entries", () => {
    const entries = getProfileEntries("american-muscle-v8");
    
    // Without approvals, all should be filtered out
    const filtered = filterApprovedEntries(entries);
    expect(filtered.length).toBe(0);
    
    // With unapproved allowed, all should pass
    setUnapprovedPacksAllowed(true);
    const filteredWithFlag = filterApprovedEntries(entries);
    expect(filteredWithFlag.length).toBe(entries.length);
  });

  it("gets loadable entries respecting approval", () => {
    const loadable = getLoadableEntries("american-muscle-v8");
    expect(loadable.length).toBe(0);
    
    approveProfile("american-muscle-v8");
    const loadableApproved = getLoadableEntries("american-muscle-v8");
    expect(loadableApproved.length).toBe(45);
  });

  it("calculates profile approval status", () => {
    const status = getProfileApprovalStatus("american-muscle-v8");
    expect(status.profileId).toBe("american-muscle-v8");
    expect(status.totalEntries).toBe(45);
    expect(status.approvedEntries).toBe(0);
    expect(status.unknownEntries).toBe(45);
    expect(status.isFullyApproved).toBe(false);
    expect(status.isBlocked).toBe(true);
  });
});

describe("Sample Engine - Bank Building", () => {
  beforeEach(() => {
    setUnapprovedPacksAllowed(true);
  });

  afterEach(() => {
    resetAllApprovals();
  });

  it("builds combustion sample bank", () => {
    const bank = buildCombustionSampleBank("american-muscle-v8");
    expect(bank.personalityId).toBe("american-muscle-v8");
    // 21 RPM-keyed loops (22 total loops minus 1 speed-keyed reverse whine)
    expect(bank.entries.length).toBe(21);
  });

  it("builds combustion bank with correct entry mapping", () => {
    const bank = buildCombustionSampleBank("american-muscle-v8");
    const idleEntry = bank.entries.find((e) => e.load === "idle");
    expect(idleEntry).toBeDefined();
    expect(idleEntry?.rpmRef).toBe(700);
    expect(idleEntry?.character).toBe("idle");
  });

  it("builds speed-keyed sample bank for non-combustion", () => {
    const bank = buildSpeedKeyedSampleBank("horse-gallop");
    expect(bank.profileId).toBe("horse-gallop");
    expect(bank.entries.length).toBeGreaterThan(0);
  });

  it("builds transient pools", () => {
    const pools = buildTransientPools("american-muscle-v8");
    expect(pools.profileId).toBe("american-muscle-v8");
    expect(pools.pools.size).toBeGreaterThan(0);
    expect(pools.pools.has("upshift")).toBe(true);
    expect(pools.pools.has("downshift")).toBe(true);
  });

  it("builds unified bank for combustion profile", () => {
    const bank = buildUnifiedSampleBank("american-muscle-v8");
    expect(bank.type).toBe("combustion");
    expect(bank.combustion).not.toBeNull();
    expect(bank.speedKeyed).toBeNull();
    expect(bank.transients.pools.size).toBeGreaterThan(0);
  });

  it("builds unified bank for non-combustion profile", () => {
    const bank = buildUnifiedSampleBank("horse-gallop");
    expect(bank.type).toBe("speed-keyed");
    expect(bank.combustion).toBeNull();
    expect(bank.speedKeyed).not.toBeNull();
    expect(bank.transients.pools.size).toBeGreaterThan(0);
  });

  it("returns empty bank when no approved entries", () => {
    resetAllApprovals();
    const bank = buildUnifiedSampleBank("american-muscle-v8");
    expect(bank.type).toBe("empty");
    expect(bank.entryCount).toBe(0);
  });
});

describe("Sample Engine - Loop Selection", () => {
  beforeEach(() => {
    setUnapprovedPacksAllowed(true);
  });

  afterEach(() => {
    resetAllApprovals();
  });

  it("selects speed-keyed loops at idle", () => {
    const bank = buildSpeedKeyedSampleBank("horse-gallop");
    const selection = selectSpeedKeyedLoops(bank, 0, 0.1);
    expect(selection.a).not.toBeNull();
  });

  it("selects and crossfades between speed points", () => {
    const bank = buildSpeedKeyedSampleBank("horse-gallop");
    if (bank.entries.length < 2) return; // Skip if not enough entries
    
    const selection = selectSpeedKeyedLoops(bank, 15, 0.5);
    // Should select based on speed
    expect(selection.a).not.toBeNull();
  });

  it("returns empty selection for empty bank", () => {
    const emptyBank = { profileId: "test", entries: [] };
    const selection = selectSpeedKeyedLoops(emptyBank, 50, 0.5);
    expect(selection.a).toBeNull();
    expect(selection.b).toBeNull();
  });
});

describe("Sample Engine - Transient Selection", () => {
  beforeEach(() => {
    setUnapprovedPacksAllowed(true);
  });

  afterEach(() => {
    resetAllApprovals();
  });

  it("selects transient variants with round-robin", () => {
    const pools = buildTransientPools("american-muscle-v8");
    const lastIndex = new Map<string, number>();
    
    const first = selectTransientVariant(pools, "upshift", lastIndex);
    expect(first).not.toBeNull();
    expect(first?.variantIndex).toBe(0);
    
    const second = selectTransientVariant(pools, "upshift", lastIndex);
    expect(second).not.toBeNull();
    expect(second?.variantIndex).toBe(1);
  });

  it("returns null for missing transient kind", () => {
    const pools = buildTransientPools("american-muscle-v8");
    const lastIndex = new Map<string, number>();
    
    const result = selectTransientVariant(pools, "nonexistent", lastIndex);
    expect(result).toBeNull();
  });

  it("gets available transient kinds", () => {
    const kinds = getAvailableTransientKinds("american-muscle-v8");
    expect(kinds).toContain("upshift");
    expect(kinds).toContain("downshift");
    expect(kinds).toContain("exhaust-pop");
  });
});

describe("Sample Engine - Diagnostics", () => {
  beforeEach(() => {
    setUnapprovedPacksAllowed(true);
  });

  afterEach(() => {
    resetAllApprovals();
  });

  it("returns diagnostics for combustion profile", () => {
    const diag = getSampleEngineDiagnostics("american-muscle-v8");
    expect(diag.profileId).toBe("american-muscle-v8");
    expect(diag.bankType).toBe("combustion");
    expect(diag.loopCount).toBe(22);
    expect(diag.transientKinds.length).toBeGreaterThan(0);
    expect(diag.manifestStatus).toBe("partial");
  });

  it("returns diagnostics for non-combustion profile", () => {
    const diag = getSampleEngineDiagnostics("horse-gallop");
    expect(diag.profileId).toBe("horse-gallop");
    expect(diag.bankType).toBe("speed-keyed");
    expect(diag.loopCount).toBeGreaterThan(0);
  });
});

describe("Asset Delivery", () => {
  it("constructs correct asset URLs", () => {
    const url = buildAssetUrl("american-muscle-v8/idle_loop.wav");
    expect(url).toBe("/sample-packs/american-muscle-v8/idle_loop.wav");
  });

  it("provides cache statistics", () => {
    const stats = getCacheStats();
    expect(stats).toHaveProperty("entryCount");
    expect(stats).toHaveProperty("totalDurationSeconds");
  });

  it("can clear buffer cache", () => {
    clearBufferCache();
    const stats = getCacheStats();
    expect(stats.entryCount).toBe(0);
  });

  it("verifies checksums correctly", async () => {
    const testData = new TextEncoder().encode("test");
    const expectedHash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    
    const valid = await verifyChecksum(testData.buffer, expectedHash);
    expect(valid).toBe(true);
    
    const invalid = await verifyChecksum(testData.buffer, "wronghash");
    expect(invalid).toBe(false);
  });

  it("allows empty checksums", async () => {
    const testData = new TextEncoder().encode("test");
    const valid = await verifyChecksum(testData.buffer, "");
    expect(valid).toBe(true);
  });
});
