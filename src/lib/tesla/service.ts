import { readTeslaOAuthConfig } from "@/lib/tesla/config";
import { refreshVehicleList } from "@/lib/tesla/fleet-api";
import {
  deleteLink,
  getLinkRecord,
  saveLinkTokens,
  updateSelectedVin,
} from "@/lib/tesla/link-store";
import {
  buildAuthorizeUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeAuthorizationCode,
  revokeRefreshToken,
} from "@/lib/tesla/oauth";
import { TESLA_MINIMUM_SCOPES } from "@/lib/tesla/scopes";
import type {
  TeslaCallbackResult,
  TeslaConnectionStatus,
  TeslaOAuthCallbackInput,
  TeslaOAuthStartResult,
} from "@/lib/tesla/types";

function virtualKeyUrl(vin: string | null): string | null {
  const { developerDomain } = readTeslaOAuthConfig();
  if (!developerDomain || !vin) return null;
  return `https://tesla.com/_ak/${developerDomain}?${new URLSearchParams({ vin }).toString()}`;
}

function consentRevokeUrl(): string | null {
  const config = readTeslaOAuthConfig();
  if (!config.clientId || !config.redirectUri) return null;
  try {
    const back = new URL(config.redirectUri);
    back.pathname = "/settings";
    back.search = "workspace=sensors";
    return `https://auth.tesla.com/user/revoke/consent?revoke_client_id=${encodeURIComponent(config.clientId)}&back_url=${encodeURIComponent(back.toString())}`;
  } catch {
    return null;
  }
}

export function getTeslaConnectionStatus(linkId: string | null | undefined): TeslaConnectionStatus {
  const config = readTeslaOAuthConfig();
  if (!config.configured) {
    return {
      available: false,
      linked: false,
      environment: config.deploy,
      scopes: [...TESLA_MINIMUM_SCOPES],
      selectedVin: null,
      vehicles: [],
      linkedAt: null,
      virtualKeyUrl: null,
      message: "Vehicle connection is not configured on this server.",
    };
  }
  const revokeUrl = consentRevokeUrl();
  if (!linkId) {
    return {
      available: true,
      linked: false,
      environment: config.deploy,
      scopes: [...TESLA_MINIMUM_SCOPES],
      selectedVin: null,
      vehicles: [],
      linkedAt: null,
      virtualKeyUrl: null,
      consentRevokeUrl: revokeUrl,
    };
  }
  const record = getLinkRecord(linkId);
  if (!record) {
    return {
      available: true,
      linked: false,
      environment: config.deploy,
      scopes: [...TESLA_MINIMUM_SCOPES],
      selectedVin: null,
      vehicles: [],
      linkedAt: null,
      virtualKeyUrl: null,
      consentRevokeUrl: revokeUrl,
    };
  }
  return {
    available: true,
    linked: true,
    environment: record.environment,
    scopes: record.tokens.scopes.split(" ").filter(Boolean),
    selectedVin: record.selectedVin,
    vehicles: record.vehicles,
    linkedAt: record.linkedAt,
    virtualKeyUrl: virtualKeyUrl(record.selectedVin),
    consentRevokeUrl: revokeUrl,
    ...(record.selectedVin
      ? {}
      : {
          message:
            "Select a vehicle below. Fleet Telemetry also requires a virtual key on the vehicle.",
        }),
  };
}

export function startTeslaOAuth(input: {
  linkId: string;
  consentAccepted: boolean;
}): TeslaOAuthStartResult {
  const config = readTeslaOAuthConfig();
  if (!config.configured) {
    return { ok: false, message: "Tesla OAuth is not configured on this server." };
  }
  if (!input.consentAccepted) {
    return { ok: false, message: "Consent is required before connecting." };
  }
  if (!input.linkId || input.linkId.length < 8) {
    return { ok: false, message: "Invalid link id." };
  }
  const state = createOAuthState(input.linkId);
  return { ok: true, authorizeUrl: buildAuthorizeUrl(state) };
}

export async function handleTeslaOAuthCallback(
  input: TeslaOAuthCallbackInput,
): Promise<TeslaCallbackResult> {
  if (input.error) {
    return {
      ok: true,
      status: "denied",
      message: input.error_description ?? input.error,
    };
  }
  if (!input.code || !input.state) {
    return { ok: false, status: "error", message: "Missing authorization code or state." };
  }

  const pending = consumeOAuthState(input.state);
  if (!pending) {
    return { ok: false, status: "error", message: "OAuth state expired or invalid. Try again." };
  }

  try {
    const tokens = await exchangeAuthorizationCode(input.code);
    saveLinkTokens(pending.linkId, tokens);
    try {
      await refreshVehicleList(pending.linkId);
    } catch {
      /* list can be refreshed from Settings */
    }
    return { ok: true, status: "connected" };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Authorization failed.",
    };
  }
}

export async function disconnectTesla(linkId: string): Promise<{ ok: boolean }> {
  if (!linkId) return { ok: false };
  const record = getLinkRecord(linkId);
  if (record?.tokens.refreshToken) {
    await revokeRefreshToken(record.tokens.refreshToken);
  }
  deleteLink(linkId);
  return { ok: true };
}

export async function selectTeslaVehicle(
  linkId: string,
  vin: string,
): Promise<{ ok: boolean; message?: string }> {
  const record = getLinkRecord(linkId);
  if (!record) return { ok: false, message: "Not connected." };
  if (!record.vehicles.find((v) => v.vin === vin)) {
    return { ok: false, message: "Unknown vehicle." };
  }
  updateSelectedVin(linkId, vin);
  return { ok: true };
}

export async function syncTeslaVehicles(linkId: string): Promise<TeslaConnectionStatus> {
  await refreshVehicleList(linkId);
  return getTeslaConnectionStatus(linkId);
}
