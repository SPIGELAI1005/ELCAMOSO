/**
 * Sample Pack Approval Gating
 * Controls which sample entries can be loaded based on approval status.
 */

import type { SamplePackEntry, SamplePackApproval } from "./types";
import { isEntryApproved, isEntryUnknown } from "./types";
import { getProfileEntries, getProfileManifest } from "./catalog";

/**
 * In-memory state for test environments where localStorage is unavailable.
 */
let _testUnapprovedAllowed = false;
let _testApprovedProfiles = new Set<string>();

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Feature flag: allow loading unapproved sample packs for testing.
 * Controlled by VITE_SAMPLE_PACKS_ALLOW_UNAPPROVED env var or localStorage.
 */
export function isUnapprovedPacksAllowed(): boolean {
  if (hasLocalStorage()) {
    const stored = localStorage.getItem("elcamoso.samplePacks.allowUnapproved");
    if (stored === "true") return true;
  } else {
    if (_testUnapprovedAllowed) return true;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env["VITE_SAMPLE_PACKS_ALLOW_UNAPPROVED"] === "1";
  }
  return false;
}

/**
 * Enable/disable unapproved packs for testing (dev mode).
 */
export function setUnapprovedPacksAllowed(allowed: boolean): void {
  if (hasLocalStorage()) {
    if (allowed) {
      localStorage.setItem("elcamoso.samplePacks.allowUnapproved", "true");
    } else {
      localStorage.removeItem("elcamoso.samplePacks.allowUnapproved");
    }
  } else {
    _testUnapprovedAllowed = allowed;
  }
}

/**
 * Approved profile IDs stored in localStorage.
 * Format: comma-separated list of profile IDs.
 */
const APPROVED_PROFILES_KEY = "elcamoso.samplePacks.approvedProfiles";

/**
 * Get the set of manually approved profile IDs.
 */
export function getApprovedProfileIds(): Set<string> {
  if (hasLocalStorage()) {
    const stored = localStorage.getItem(APPROVED_PROFILES_KEY);
    if (!stored) return new Set();
    return new Set(stored.split(",").filter(Boolean));
  }
  return new Set(_testApprovedProfiles);
}

/**
 * Mark a profile as approved.
 */
export function approveProfile(profileId: string): void {
  if (hasLocalStorage()) {
    const approved = getApprovedProfileIds();
    approved.add(profileId);
    localStorage.setItem(APPROVED_PROFILES_KEY, [...approved].join(","));
  } else {
    _testApprovedProfiles.add(profileId);
  }
}

/**
 * Revoke approval for a profile.
 */
export function revokeProfileApproval(profileId: string): void {
  if (hasLocalStorage()) {
    const approved = getApprovedProfileIds();
    approved.delete(profileId);
    if (approved.size === 0) {
      localStorage.removeItem(APPROVED_PROFILES_KEY);
    } else {
      localStorage.setItem(APPROVED_PROFILES_KEY, [...approved].join(","));
    }
  } else {
    _testApprovedProfiles.delete(profileId);
  }
}

/**
 * Check if a profile is approved for loading.
 */
export function isProfileApproved(profileId: string): boolean {
  const manifest = getProfileManifest(profileId);
  if (!manifest) return false;
  
  // Check if manually approved at profile level
  if (getApprovedProfileIds().has(profileId)) return true;
  
  // Check if any entries are approved in the manifest
  return manifest.entries.some(isEntryApproved);
}

/**
 * Approval gate result for an entry.
 */
export interface ApprovalGateResult {
  allowed: boolean;
  reason: "approved" | "profile-approved" | "unapproved-allowed" | "blocked";
  entry: SamplePackEntry;
}

/**
 * Check if an entry can be loaded based on approval gating.
 */
export function checkEntryApproval(entry: SamplePackEntry): ApprovalGateResult {
  // Entry is explicitly approved
  if (isEntryApproved(entry)) {
    return { allowed: true, reason: "approved", entry };
  }
  
  // Profile is manually approved
  if (getApprovedProfileIds().has(entry.profileId)) {
    return { allowed: true, reason: "profile-approved", entry };
  }
  
  // Unapproved packs are allowed (dev mode)
  if (isUnapprovedPacksAllowed() && isEntryUnknown(entry)) {
    return { allowed: true, reason: "unapproved-allowed", entry };
  }
  
  // Blocked
  return { allowed: false, reason: "blocked", entry };
}

/**
 * Filter entries to only those that pass approval gating.
 */
export function filterApprovedEntries(
  entries: SamplePackEntry[],
): SamplePackEntry[] {
  return entries.filter((entry) => checkEntryApproval(entry).allowed);
}

/**
 * Get loadable entries for a profile with approval gating applied.
 */
export function getLoadableEntries(profileId: string): SamplePackEntry[] {
  const entries = getProfileEntries(profileId);
  return filterApprovedEntries(entries);
}

/**
 * Approval status summary for a profile.
 */
export interface ProfileApprovalStatus {
  profileId: string;
  totalEntries: number;
  approvedEntries: number;
  unknownEntries: number;
  rejectedEntries: number;
  loadableEntries: number;
  isFullyApproved: boolean;
  isPartiallyApproved: boolean;
  isBlocked: boolean;
  isProfileManuallyApproved: boolean;
}

/**
 * Get approval status for a profile.
 */
export function getProfileApprovalStatus(profileId: string): ProfileApprovalStatus {
  const entries = getProfileEntries(profileId);
  const loadable = getLoadableEntries(profileId);
  
  const approvedCount = entries.filter(isEntryApproved).length;
  const unknownCount = entries.filter(isEntryUnknown).length;
  const rejectedCount = entries.length - approvedCount - unknownCount;
  
  return {
    profileId,
    totalEntries: entries.length,
    approvedEntries: approvedCount,
    unknownEntries: unknownCount,
    rejectedEntries: rejectedCount,
    loadableEntries: loadable.length,
    isFullyApproved: approvedCount === entries.length && entries.length > 0,
    isPartiallyApproved: approvedCount > 0 && approvedCount < entries.length,
    isBlocked: loadable.length === 0,
    isProfileManuallyApproved: getApprovedProfileIds().has(profileId),
  };
}

/**
 * Bulk approve all entries in a profile (dev utility).
 * This only marks the profile as approved, not individual entries.
 */
export function bulkApproveProfile(profileId: string): void {
  approveProfile(profileId);
}

/**
 * Reset all approvals (dev utility).
 */
export function resetAllApprovals(): void {
  // Reset in-memory state
  _testUnapprovedAllowed = false;
  _testApprovedProfiles = new Set<string>();
  
  // Reset localStorage if available
  if (hasLocalStorage()) {
    localStorage.removeItem(APPROVED_PROFILES_KEY);
    localStorage.removeItem("elcamoso.samplePacks.allowUnapproved");
  }
}
