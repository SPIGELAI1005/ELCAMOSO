import type { Plan } from "@/lib/entitlements/types";

export type TeslaUpgradeTokenStatus = "pending" | "completed" | "expired";

export interface TeslaUpgradeTokenRecord {
  token: string;
  userId: string | null;
  clientDriveSessionId: string;
  relaySessionId: string | null;
  status: TeslaUpgradeTokenStatus;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
}

export interface CreateTeslaUpgradeTokenResult {
  token: string;
  expiresAt: number;
  upgradePath: string;
  upgradeUrl: string;
}

export interface ResolveTeslaUpgradeTokenResult {
  valid: boolean;
  expired: boolean;
  status: TeslaUpgradeTokenStatus;
  userId: string | null;
  clientDriveSessionId: string;
}

export interface RelayEntitlementUpdatePayload {
  plan: Plan;
  revision: number;
  upgradeToken?: string;
}
