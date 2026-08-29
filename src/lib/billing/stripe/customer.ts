import { getStripeClient } from "@/lib/billing/stripe/client";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";

export interface EnsureStripeCustomerInput {
  userId: string;
  email: string;
}

/** Creates or reuses a Stripe Customer and persists stripeCustomerId on the user. */
export async function ensureStripeCustomer(input: EnsureStripeCustomerInput): Promise<string> {
  const repository = getUserBillingRepository();
  const existing = await repository.getStripeCustomerId(input.userId);
  const stripe = getStripeClient();

  if (existing) {
    try {
      const customer = await stripe.customers.retrieve(existing);
      if (!customer.deleted) {
        return existing;
      }
    } catch {
      /* fall through and recreate */
    }
  }

  const customer = await stripe.customers.create({
    email: input.email,
    metadata: {
      userId: input.userId,
    },
  });

  await repository.setStripeCustomerId(input.userId, customer.id, input.email);
  return customer.id;
}
