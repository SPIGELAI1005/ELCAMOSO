import { readClientDriveSessionId } from "@/lib/tesla-upgrade/drive-session-id";
import type { TrialUpgradeMilestone } from "@/lib/dynamic-drive-trial/display";

const STORAGE_KEY = "elcamoso.trial.milestones.v1";

function readStore(): Record<string, number[]> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number[]>) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, number[]>): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readTrialMilestonesForDrive(driveSessionId = readClientDriveSessionId()): Set<number> {
  const store = readStore();
  return new Set(store[driveSessionId] ?? []);
}

export function acknowledgeTrialMilestone(
  milestone: TrialUpgradeMilestone,
  driveSessionId = readClientDriveSessionId(),
): void {
  const store = readStore();
  const current = new Set(store[driveSessionId] ?? []);
  current.add(milestone);
  store[driveSessionId] = [...current];
  writeStore(store);
}

export function resetTrialMilestonesForTests(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
