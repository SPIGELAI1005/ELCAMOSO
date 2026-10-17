import type { UserSubscriptionRecord } from "@/lib/billing/subscription-store";

/** Prefix for lifetime grants mirrored into the subscription repository. */
export const LIFETIME_PROVIDER_ID_PREFIX = "lifetime:";

export function lifetimeProviderId(paymentIntentId: string): string {
  return `${LIFETIME_PROVIDER_ID_PREFIX}${paymentIntentId}`;
}

export function isLifetimeProviderId(providerSubscriptionId: string): boolean {
  return providerSubscriptionId.startsWith(LIFETIME_PROVIDER_ID_PREFIX);
}

export interface LifetimeGrant {
  userId: string;
  paymentIntentId: string;
  checkoutSessionId: string | null;
  stripeCustomerId: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
}

const grantsByUser = new Map<string, LifetimeGrant>();
const userByPaymentIntent = new Map<string, string>();
/** Last recurring-subscription record per user, restored if a lifetime grant is refunded. */
const underlyingByUser = new Map<string, UserSubscriptionRecord>();

export function resetLifetimeStoreForTests(): void {
  grantsByUser.clear();
  userByPaymentIntent.clear();
  underlyingByUser.clear();
}

/** Drops all cached lifetime state for one user (before re-hydrating from Postgres). */
export function clearLifetimeStateForUser(userId: string): void {
  const grant = grantsByUser.get(userId);
  if (grant) userByPaymentIntent.delete(grant.paymentIntentId);
  for (const [pi, owner] of userByPaymentIntent) if (owner === userId) userByPaymentIntent.delete(pi);
  grantsByUser.delete(userId);
  underlyingByUser.delete(userId);
}

/** Restore a grant loaded from durable storage (active or revoked). */
export function restoreLifetimeGrant(grant: LifetimeGrant): void {
  const existing = grantsByUser.get(grant.userId);
  // An active grant wins over a revoked one when a user has several lifetime rows.
  if (!existing || (existing.revokedAt && !grant.revokedAt)) grantsByUser.set(grant.userId, grant);
  userByPaymentIntent.set(grant.paymentIntentId, grant.userId);
}

export function getLifetimeGrant(userId: string): LifetimeGrant | null {
  return grantsByUser.get(userId) ?? null;
}

export function hasActiveLifetimeGrant(userId: string): boolean {
  const grant = grantsByUser.get(userId);
  return Boolean(grant && !grant.revokedAt);
}

export function findUserIdForLifetimePaymentIntent(paymentIntentId: string): string | null {
  return userByPaymentIntent.get(paymentIntentId) ?? null;
}

/** Idempotent: re-granting the same payment intent keeps the original grant. */
export function recordLifetimeGrant(
  input: Omit<LifetimeGrant, "grantedAt" | "revokedAt"> & { grantedAt?: Date },
): { grant: LifetimeGrant; created: boolean } {
  const existing = grantsByUser.get(input.userId);
  if (existing && existing.paymentIntentId === input.paymentIntentId) {
    return { grant: existing, created: false };
  }
  if (existing && !existing.revokedAt) {
    // Already owns lifetime via another payment - keep the original grant.
    userByPaymentIntent.set(input.paymentIntentId, input.userId);
    return { grant: existing, created: false };
  }
  const grant: LifetimeGrant = {
    userId: input.userId,
    paymentIntentId: input.paymentIntentId,
    checkoutSessionId: input.checkoutSessionId,
    stripeCustomerId: input.stripeCustomerId,
    grantedAt: input.grantedAt ?? new Date(),
    revokedAt: null,
  };
  grantsByUser.set(input.userId, grant);
  userByPaymentIntent.set(input.paymentIntentId, input.userId);
  return { grant, created: true };
}

/** Revokes when the refunded payment intent is the one backing the active grant. */
export function revokeLifetimeGrant(paymentIntentId: string, now = new Date()): LifetimeGrant | null {
  const userId = userByPaymentIntent.get(paymentIntentId);
  if (!userId) return null;
  const grant = grantsByUser.get(userId);
  if (!grant || grant.paymentIntentId !== paymentIntentId) return null;
  if (grant.revokedAt) return grant;
  grant.revokedAt = now;
  return grant;
}

export function setUnderlyingSubscriptionRecord(record: UserSubscriptionRecord): void {
  underlyingByUser.set(record.userId, record);
}

export function getUnderlyingSubscriptionRecord(userId: string): UserSubscriptionRecord | null {
  return underlyingByUser.get(userId) ?? null;
}

export function countActiveLifetimeGrants(): number {
  let count = 0;
  for (const grant of grantsByUser.values()) if (!grant.revokedAt) count += 1;
  return count;
}

export function lifetimeEntitlementRecord(userId: string): UserSubscriptionRecord {
  return {
    userId,
    plan: "DRIVE_PLUS",
    status: "active",
    interval: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    pastDueSince: null,
    lifetime: true,
  };
}
