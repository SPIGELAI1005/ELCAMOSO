/** Public connection status returned to the client — never includes tokens. */
export interface TeslaConnectionStatus {
  available: boolean;
  linked: boolean;
  environment: string;
  scopes: string[];
  selectedVin: string | null;
  vehicles: TeslaVehicleSummary[];
  linkedAt: number | null;
  virtualKeyUrl: string | null;
  /** Tesla account consent management (scope revoke) — no secrets. */
  consentRevokeUrl?: string | null;
  message?: string;
}

export interface TeslaVehicleSummary {
  vin: string;
  displayName: string;
}

export interface TeslaOAuthStartResult {
  ok: boolean;
  authorizeUrl?: string;
  message?: string;
}

export interface TeslaStoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  fleetApiBase: string;
  scopes: string;
  region: string;
}

export interface TeslaLinkRecord {
  linkId: string;
  tokens: TeslaStoredTokens;
  selectedVin: string | null;
  vehicles: TeslaVehicleSummary[];
  linkedAt: number;
  environment: string;
}

export interface TeslaOAuthCallbackInput {
  code?: string | undefined;
  state?: string | undefined;
  error?: string | undefined;
  error_description?: string | undefined;
}

export type TeslaCallbackResult =
  | { ok: true; status: "connected" | "denied" | "error"; message?: string }
  | { ok: false; status: "error"; message: string };
