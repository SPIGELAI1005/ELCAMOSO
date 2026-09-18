/** Human-friendly trial time - minutes only, no anxiety-inducing seconds ticker. */
export function formatTrialRemainingMinutes(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "0 min remaining";
  const mins = Math.max(1, Math.ceil(remainingSeconds / 60));
  return `${mins} min remaining`;
}

export const TRIAL_UPGRADE_MILESTONES_MIN = [10, 5, 1] as const;

export type TrialUpgradeMilestone = (typeof TRIAL_UPGRADE_MILESTONES_MIN)[number];

/** Next milestone to surface once - lowest unacknowledged threshold the user has reached. */
export function resolveTrialUpgradeMilestone(
  remainingSeconds: number,
  acknowledged: ReadonlySet<number>,
): TrialUpgradeMilestone | null {
  const mins = Math.ceil(Math.max(0, remainingSeconds) / 60);
  for (const threshold of TRIAL_UPGRADE_MILESTONES_MIN) {
    if (mins <= threshold && !acknowledged.has(threshold)) return threshold;
  }
  return null;
}

export function trialUpgradeMilestoneMessage(milestone: TrialUpgradeMilestone): string {
  switch (milestone) {
    case 10:
      return "About 10 minutes of preview remaining.";
    case 5:
      return "About five minutes of preview remaining.";
    case 1:
      return "About one minute of preview remaining.";
  }
}

export const TRIAL_OFFER_POINTS = ["30 minutes", "Up to 3 drives", "No card required"] as const;
