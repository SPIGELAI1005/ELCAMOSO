import type { BillingStatus } from "@/lib/billing/status";
import {
  readSubscriptionAccessPolicyConfig,
  type SubscriptionAccessPolicyConfig,
} from "@/lib/billing/subscription-access-config";
import type { Plan } from "@/lib/entitlements/types";

/** Inputs for subscription access evaluation — no payment instrument data. */
export interface SubscriptionAccessInput {
  plan: Plan;
  status: BillingStatus;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  pastDueSince?: Date | null;
}

export type SubscriptionAccessReason =
  | "not_drive_plus"
  | "active"
  | "trialing"
  | "past_due_grace"
  | "past_due_grace_expired"
  | "cancel_at_period_end"
  | "period_ended"
  | "canceled"
  | "paused"
  | "free";

export interface SubscriptionAccessDecision {
  hasDrivePlusAccess: boolean;
  reason: SubscriptionAccessReason;
  /** When access ends under grace or cancel-at-period-end rules. */
  effectiveUntil: Date | null;
}

function periodEndMs(input: SubscriptionAccessInput): number | null {
  return input.currentPeriodEnd?.getTime() ?? null;
}

function withinPeriodEnd(input: SubscriptionAccessInput, now: number): boolean {
  const end = periodEndMs(input);
  return end != null && now < end;
}

/** Explicit Drive+ authorization from normalized subscription state. */
export function evaluateSubscriptionAccess(
  input: SubscriptionAccessInput,
  now = Date.now(),
  config: SubscriptionAccessPolicyConfig = readSubscriptionAccessPolicyConfig(),
): SubscriptionAccessDecision {
  if (input.plan !== "DRIVE_PLUS") {
    return { hasDrivePlusAccess: false, reason: "not_drive_plus", effectiveUntil: null };
  }

  if (input.status === "active") {
    const effectiveUntil =
      input.cancelAtPeriodEnd && input.currentPeriodEnd ? input.currentPeriodEnd : null;
    return { hasDrivePlusAccess: true, reason: "active", effectiveUntil };
  }

  if (input.status === "trialing") {
    return { hasDrivePlusAccess: true, reason: "trialing", effectiveUntil: input.currentPeriodEnd ?? null };
  }

  if (input.status === "past_due") {
    const since = input.pastDueSince?.getTime() ?? now;
    const graceEndsAt = since + config.pastDueGraceMs;
    if (now < graceEndsAt) {
      return {
        hasDrivePlusAccess: true,
        reason: "past_due_grace",
        effectiveUntil: new Date(graceEndsAt),
      };
    }
    return { hasDrivePlusAccess: false, reason: "past_due_grace_expired", effectiveUntil: null };
  }

  if (input.cancelAtPeriodEnd && withinPeriodEnd(input, now)) {
    return {
      hasDrivePlusAccess: true,
      reason: "cancel_at_period_end",
      effectiveUntil: input.currentPeriodEnd ?? null,
    };
  }

  if (input.status === "canceled") {
    if (withinPeriodEnd(input, now)) {
      return {
        hasDrivePlusAccess: true,
        reason: "cancel_at_period_end",
        effectiveUntil: input.currentPeriodEnd ?? null,
      };
    }
    return { hasDrivePlusAccess: false, reason: "canceled", effectiveUntil: null };
  }

  if (input.status === "paused") {
    return { hasDrivePlusAccess: false, reason: "paused", effectiveUntil: null };
  }

  return { hasDrivePlusAccess: false, reason: "free", effectiveUntil: null };
}

export function hasDrivePlusSubscriptionAccess(
  input: SubscriptionAccessInput,
  now = Date.now(),
  config?: SubscriptionAccessPolicyConfig,
): boolean {
  return evaluateSubscriptionAccess(input, now, config).hasDrivePlusAccess;
}
