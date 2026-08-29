import { userHasLocalDrivePlusAccess } from "@/lib/billing/resilience/local-access";

/**
 * Checkout guard — local subscription store only.
 * Premium feature gates and entitlements never call Stripe.
 * Use reconcileUserBillingFromStripe() explicitly when ops needs a Stripe pull.
 */
export function userHasActiveDrivePlusLocally(userId: string, now = Date.now()): boolean {
  return userHasLocalDrivePlusAccess(userId, now);
}

export async function userHasActiveDrivePlusSubscription(
  userId: string,
  _stripeCustomerId: string | null = null,
): Promise<boolean> {
  return userHasActiveDrivePlusLocally(userId);
}
