import { randomUUID } from "node:crypto";

import type {
  SubscriptionRepository,
  UpsertSubscriptionInput,
} from "@/lib/billing/subscription-repository";
import { postgresSubscriptionRepository } from "@/lib/billing/subscription-repository-postgres";
import type { Subscription } from "@/lib/billing/types";

const byProviderSubscription = new Map<string, Subscription>();
const byUserId = new Map<string, Subscription>();

function key(provider: string, providerSubscriptionId: string): string {
  return `${provider}:${providerSubscriptionId}`;
}

export function resetSubscriptionRepositoryForTests(): void {
  byProviderSubscription.clear();
  byUserId.clear();
}

export const memorySubscriptionRepository: SubscriptionRepository = {
  async upsert(input) {
    const existing = byProviderSubscription.get(
      key(input.provider, input.providerSubscriptionId),
    );
    const now = new Date();
    const next: Subscription = {
      id: existing?.id ?? randomUUID(),
      userId: input.userId,
      provider: input.provider,
      providerCustomerId: input.providerCustomerId,
      providerSubscriptionId: input.providerSubscriptionId,
      plan: input.plan,
      interval: input.interval,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    byProviderSubscription.set(key(input.provider, input.providerSubscriptionId), next);
    byUserId.set(input.userId, next);
    return next;
  },

  async findByProviderSubscriptionId(provider, providerSubscriptionId) {
    return byProviderSubscription.get(key(provider, providerSubscriptionId)) ?? null;
  },

  async findLatestByUserId(userId) {
    return byUserId.get(userId) ?? null;
  },
};

let activeRepository: SubscriptionRepository = memorySubscriptionRepository;

export function setSubscriptionRepository(repository: SubscriptionRepository): void {
  activeRepository = repository;
}

export function getSubscriptionRepository(): SubscriptionRepository {
  if (activeRepository !== memorySubscriptionRepository) return activeRepository;
  if (process.env.DATABASE_URL) return postgresSubscriptionRepository;
  return memorySubscriptionRepository;
}

export function resetSubscriptionRepositoryStoreForTests(): void {
  activeRepository = memorySubscriptionRepository;
  resetSubscriptionRepositoryForTests();
}
