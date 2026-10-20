/**
 * Authoritative entitlement / profile access resolver (Prompt 11).
 *
 * Precedence (first match wins for *allow*), evaluated at a UTC epoch `now`:
 * 1. Permanent free Sound Profile ids (`FREE_SOUND_PROFILE_IDS`)
 * 2. Active purchased / grandfathered profile grants (non-expired)
 * 3. Active temporary reward profile grants (non-expired)
 * 4. Subscription / trial / past-due grace / cancel-at-period-end → `all_sound_profiles`
 * 5. Live-drive / offline lease hold (bounded; does not extend rights past lease expiry)
 * 6. Otherwise denied
 *
 * Capability entitlements (`dynamic_drive`, etc.) follow plan ∪ trial ∪ reward
 * entitlement grants ∪ live-drive lease, after subscription access policy.
 *
 * Client booleans never grant server access — call `requireEntitlement` /
 * `assertServerEntitlement` / this resolver on the server with a verified session.
 */

import {
  evaluateSubscriptionAccess,
  type SubscriptionAccessInput,
} from "@/lib/billing/subscription-access-policy";
import { entitlementsForPlan } from "@/lib/entitlements/plans";
import { isTrialActive } from "@/lib/entitlements/trial";
import type { Entitlement, EntitlementUser, SubscriptionStatus } from "@/lib/entitlements/types";
import { canAccessExperience } from "@/lib/experiences/access";
import { experienceForProfileId } from "@/lib/experiences/catalog";
import {
  FALLBACK_SOUND_PROFILE_ID,
  FREE_SOUND_PROFILE_IDS,
  resolveProfileAccess,
  type ProfileAccessFields,
} from "@/lib/sound/profile-access";
import { getProfile } from "@/lib/sound/profiles";
import {
  TESTING_UNLOCKED_SOUND_ENTITLEMENTS,
  allSoundsFreeAt,
} from "@/lib/sound/sound-unlock-flag";

export type AccessSource =
  | "permanent_free"
  | "purchased_grant"
  | "grandfathered_grant"
  | "reward_grant"
  | "subscription"
  | "past_due_grace"
  | "cancel_period"
  | "trial"
  | "offline_lease"
  | "denied";

export interface AccessResolverInput {
  user: EntitlementUser;
  /** Active profile grants for the account (UTC-filtered by caller). */
  grantedProfileIds?: readonly string[];
  /** Grant kind hints for attribution (optional). */
  grantKindsByProfileId?: ReadonlyMap<string, AccessSource>;
  /** Extra entitlements from reward grants. */
  grantedEntitlements?: readonly Entitlement[];
  /** Subscription fields for grace / cancel evaluation when available. */
  subscription?: SubscriptionAccessInput | null;
  /** Committed offline / live-drive lease entitlements (bounded). */
  leaseEntitlements?: readonly Entitlement[];
  leaseProfileIds?: readonly string[];
  leaseExpiresAtUtc?: number | null;
  leaseAccountId?: string | null;
  now?: number;
}

export interface ProfileDriveAccessDecision {
  allowed: boolean;
  source: AccessSource;
  /** UTC epoch ms when this allow ends; null if permanent for this source. */
  expiresAtUtc: number | null;
  fallbackProfileId: string;
}

export interface CapabilityAccessDecision {
  allowed: boolean;
  source: AccessSource;
  expiresAtUtc: number | null;
}

const FREE_SET = new Set(FREE_SOUND_PROFILE_IDS);

function subscriptionSource(
  reason: string,
): Extract<AccessSource, "subscription" | "past_due_grace" | "cancel_period" | "denied"> {
  if (reason === "past_due_grace") return "past_due_grace";
  if (reason === "cancel_at_period_end") return "cancel_period";
  if (reason === "active" || reason === "trialing") return "subscription";
  return "denied";
}

function hasAllSoundsFromSubscription(
  user: EntitlementUser,
  subscription: SubscriptionAccessInput | null | undefined,
  now: number,
): { allowed: boolean; source: AccessSource; expiresAtUtc: number | null } {
  if (subscription) {
    const decision = evaluateSubscriptionAccess(subscription, now);
    if (decision.hasDrivePlusAccess) {
      return {
        allowed: true,
        source: subscriptionSource(decision.reason),
        expiresAtUtc: decision.effectiveUntil?.getTime() ?? null,
      };
    }
    // Explicit subscription record examined — do not second-guess with plan flags.
    return { allowed: false, source: "denied", expiresAtUtc: null };
  }
  // Fallback: `resolveEntitlementUser` only sets plan=DRIVE_PLUS after
  // `hasDrivePlusSubscriptionAccess` (includes past_due grace / cancel period).
  if (user.plan === "DRIVE_PLUS") {
    const status: SubscriptionStatus = user.subscriptionStatus;
    const source: AccessSource =
      status === "past_due"
        ? "past_due_grace"
        : status === "canceled"
          ? "cancel_period"
          : "subscription";
    return { allowed: true, source, expiresAtUtc: null };
  }
  return { allowed: false, source: "denied", expiresAtUtc: null };
}

function leaseValid(input: AccessResolverInput, now: number): boolean {
  if (input.leaseExpiresAtUtc != null && input.leaseExpiresAtUtc <= now) return false;
  if (input.leaseAccountId != null && input.user.accountId !== input.leaseAccountId) return false;
  return Boolean(input.leaseEntitlements?.length || input.leaseProfileIds?.length);
}

/** Whether the user may start / continue full playback of a Sound Profile. */
export function resolveProfileDriveAccess(
  profileId: string,
  input: AccessResolverInput,
): ProfileDriveAccessDecision {
  const now = input.now ?? Date.now();
  const fallbackProfileId = FALLBACK_SOUND_PROFILE_ID;
  const profile: ProfileAccessFields = (() => {
    try {
      return getProfile(profileId);
    } catch {
      return { id: profileId };
    }
  })();

  if (
    FREE_SET.has(profileId) ||
    resolveProfileAccess(profile) === "free" ||
    allSoundsFreeAt(input.now)
  ) {
    return {
      allowed: true,
      source: "permanent_free",
      expiresAtUtc: null,
      fallbackProfileId,
    };
  }

  if (input.grantedProfileIds?.includes(profileId)) {
    const kind = input.grantKindsByProfileId?.get(profileId);
    return {
      allowed: true,
      source: kind ?? "purchased_grant",
      expiresAtUtc: null,
      fallbackProfileId,
    };
  }

  // Symphony / World / Fusion IDs: paid experience entitlement (free-plan ones do not unlock driving).
  if (
    profileId.startsWith("symphony-") ||
    profileId.startsWith("fusion-") ||
    profileId.startsWith("world-")
  ) {
    const experience = experienceForProfileId(profileId);
    if (
      experience.kind !== "engine" &&
      experience.capabilities.selectableInDrive &&
      canAccessExperience(experience, (entitlement) => {
        const decision = resolveCapabilityAccess(entitlement, input);
        return decision.allowed;
      })
    ) {
      const required = experience.capabilities.requiredEntitlement;
      const cap = required
        ? resolveCapabilityAccess(required, input)
        : { allowed: true, source: "permanent_free" as const, expiresAtUtc: null };
      // Free tier drives only the three free engine profiles (see profile-access-config).
      if (cap.source !== "permanent_free")
        return {
          allowed: true,
          source: cap.source,
          expiresAtUtc: cap.expiresAtUtc,
          fallbackProfileId,
        };
    }
  }

  if (isTrialActive(input.user, now)) {
    return {
      allowed: true,
      source: "trial",
      expiresAtUtc: input.user.trialEndsAt ?? null,
      fallbackProfileId,
    };
  }

  const sub = hasAllSoundsFromSubscription(input.user, input.subscription, now);
  if (sub.allowed) {
    return {
      allowed: true,
      source: sub.source,
      expiresAtUtc: sub.expiresAtUtc,
      fallbackProfileId,
    };
  }

  if (leaseValid(input, now) && input.leaseProfileIds?.includes(profileId)) {
    return {
      allowed: true,
      source: "offline_lease",
      expiresAtUtc: input.leaseExpiresAtUtc ?? null,
      fallbackProfileId,
    };
  }

  if (leaseValid(input, now) && input.leaseEntitlements?.includes("all_sound_profiles")) {
    return {
      allowed: true,
      source: "offline_lease",
      expiresAtUtc: input.leaseExpiresAtUtc ?? null,
      fallbackProfileId,
    };
  }

  return {
    allowed: false,
    source: "denied",
    expiresAtUtc: null,
    fallbackProfileId,
  };
}

/** Capability check with the same precedence model. */
export function resolveCapabilityAccess(
  entitlement: Entitlement,
  input: AccessResolverInput,
): CapabilityAccessDecision {
  const now = input.now ?? Date.now();

  // Permanent free-tier capabilities (cockpit, volume path, gear realism, essential catalog).
  if (entitlementsForPlan("FREE").includes(entitlement)) {
    return { allowed: true, source: "permanent_free", expiresAtUtc: null };
  }

  if (input.grantedEntitlements?.includes(entitlement)) {
    return { allowed: true, source: "reward_grant", expiresAtUtc: null };
  }

  if (isTrialActive(input.user, now) && input.user.trialEntitlements?.includes(entitlement)) {
    return {
      allowed: true,
      source: "trial",
      expiresAtUtc: input.user.trialEndsAt ?? null,
    };
  }

  const sub = hasAllSoundsFromSubscription(input.user, input.subscription, now);
  if (sub.allowed && entitlementsForPlan("DRIVE_PLUS").includes(entitlement)) {
    return { allowed: true, source: sub.source, expiresAtUtc: sub.expiresAtUtc };
  }

  if (leaseValid(input, now) && input.leaseEntitlements?.includes(entitlement)) {
    return {
      allowed: true,
      source: "offline_lease",
      expiresAtUtc: input.leaseExpiresAtUtc ?? null,
    };
  }

  return { allowed: false, source: "denied", expiresAtUtc: null };
}

/** Resolve the full effective entitlement set (for snapshots / UI). */
export function resolveEffectiveEntitlements(input: AccessResolverInput): ReadonlySet<Entitlement> {
  const now = input.now ?? Date.now();
  const granted = new Set<Entitlement>(entitlementsForPlan("FREE"));

  for (const e of input.grantedEntitlements ?? []) granted.add(e);

  if (isTrialActive(input.user, now) && input.user.trialEntitlements) {
    for (const e of input.user.trialEntitlements) granted.add(e);
  }

  const sub = hasAllSoundsFromSubscription(input.user, input.subscription, now);
  if (sub.allowed) {
    for (const e of entitlementsForPlan("DRIVE_PLUS")) granted.add(e);
  }

  if (leaseValid(input, now)) {
    for (const e of input.leaseEntitlements ?? []) granted.add(e);
  }

  // Pre-launch: every sound free until SOUND_TIER_GATE_STARTS_AT_ISO.
  if (allSoundsFreeAt(input.now)) {
    for (const e of TESTING_UNLOCKED_SOUND_ENTITLEMENTS) granted.add(e);
  }

  return granted;
}
