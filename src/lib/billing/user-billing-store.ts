import { postgresUserBillingRepository } from "@/lib/billing/user-billing-repository-postgres";

export interface UserBillingRepository {
  getStripeCustomerId(userId: string): Promise<string | null>;
  getUserIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null>;
  setStripeCustomerId(userId: string, stripeCustomerId: string, email?: string | null): Promise<void>;
}

const stripeCustomerByUser = new Map<string, string>();

export function resetUserBillingStoreForTests(): void {
  stripeCustomerByUser.clear();
}

export const memoryUserBillingRepository: UserBillingRepository = {
  async getStripeCustomerId(userId) {
    return stripeCustomerByUser.get(userId) ?? null;
  },

  async getUserIdByStripeCustomerId(stripeCustomerId) {
    for (const [userId, customerId] of stripeCustomerByUser.entries()) {
      if (customerId === stripeCustomerId) return userId;
    }
    return null;
  },

  async setStripeCustomerId(userId, stripeCustomerId) {
    stripeCustomerByUser.set(userId, stripeCustomerId);
  },
};

let activeRepositoryOverride: UserBillingRepository | null = null;

export function setUserBillingRepository(repository: UserBillingRepository): void {
  activeRepositoryOverride = repository;
}

export function resetUserBillingRepositoryForTests(): void {
  activeRepositoryOverride = memoryUserBillingRepository;
  resetUserBillingStoreForTests();
}

export function getUserBillingRepository(): UserBillingRepository {
  if (activeRepositoryOverride) return activeRepositoryOverride;
  if (process.env.DATABASE_URL) return postgresUserBillingRepository;
  return memoryUserBillingRepository;
}
