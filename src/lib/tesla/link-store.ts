import { decryptSecret, encryptSecret } from "@/lib/tesla/crypto";
import { readTeslaOAuthConfig } from "@/lib/tesla/config";
import { refreshAccessToken } from "@/lib/tesla/oauth";
import type { TeslaLinkRecord, TeslaStoredTokens } from "@/lib/tesla/types";

interface EncryptedLinkRow {
  encryptedRefreshToken: string;
  tokens: Omit<TeslaStoredTokens, "refreshToken"> & { refreshToken?: never };
  selectedVin: string | null;
  vehiclesJson: string;
  linkedAt: number;
  environment: string;
}

const links = new Map<string, EncryptedLinkRow>();

function serializeTokens(tokens: TeslaStoredTokens, encryptionKey: string): EncryptedLinkRow {
  return {
    encryptedRefreshToken: encryptSecret(tokens.refreshToken, encryptionKey),
    tokens: {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      fleetApiBase: tokens.fleetApiBase,
      scopes: tokens.scopes,
      region: tokens.region,
    },
    selectedVin: null,
    vehiclesJson: "[]",
    linkedAt: Date.now(),
    environment: readTeslaOAuthConfig().deploy,
  };
}

function deserializeTokens(row: EncryptedLinkRow, encryptionKey: string): TeslaStoredTokens {
  return {
    ...row.tokens,
    refreshToken: decryptSecret(row.encryptedRefreshToken, encryptionKey),
  };
}

export function saveLinkTokens(linkId: string, tokens: TeslaStoredTokens): TeslaLinkRecord {
  const config = readTeslaOAuthConfig();
  links.set(linkId, serializeTokens(tokens, config.encryptionKey));
  return getLinkRecord(linkId)!;
}

export function getLinkRecord(linkId: string): TeslaLinkRecord | null {
  const row = links.get(linkId);
  if (!row) return null;
  const config = readTeslaOAuthConfig();
  let tokens: TeslaStoredTokens;
  try {
    tokens = deserializeTokens(row, config.encryptionKey);
  } catch {
    return null;
  }
  let vehicles: TeslaLinkRecord["vehicles"] = [];
  try {
    vehicles = JSON.parse(row.vehiclesJson) as TeslaLinkRecord["vehicles"];
  } catch {
    vehicles = [];
  }
  return {
    linkId,
    tokens,
    selectedVin: row.selectedVin,
    vehicles,
    linkedAt: row.linkedAt,
    environment: row.environment,
  };
}

export async function getValidAccessToken(linkId: string): Promise<TeslaStoredTokens | null> {
  const record = getLinkRecord(linkId);
  if (!record) return null;
  if (Date.now() < record.tokens.expiresAt) return record.tokens;

  const config = readTeslaOAuthConfig();
  const row = links.get(linkId);
  if (!row) return null;

  try {
    const refreshed = await refreshAccessToken(
      record.tokens.refreshToken,
      record.tokens.fleetApiBase,
    );
    row.tokens = {
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
      fleetApiBase: refreshed.fleetApiBase,
      scopes: refreshed.scopes,
      region: refreshed.region,
    };
    row.encryptedRefreshToken = encryptSecret(refreshed.refreshToken, config.encryptionKey);
    return refreshed;
  } catch {
    return null;
  }
}

export function updateLinkVehicles(linkId: string, vehicles: TeslaLinkRecord["vehicles"]): void {
  const row = links.get(linkId);
  if (!row) return;
  row.vehiclesJson = JSON.stringify(vehicles);
  if (vehicles.length === 1 && !row.selectedVin) {
    row.selectedVin = vehicles[0]!.vin;
  }
}

export function updateSelectedVin(linkId: string, vin: string | null): void {
  const row = links.get(linkId);
  if (!row) return;
  row.selectedVin = vin;
}

export function updateLinkRegion(linkId: string, fleetApiBase: string, region: string): void {
  const row = links.get(linkId);
  if (!row) return;
  row.tokens.fleetApiBase = fleetApiBase;
  row.tokens.region = region;
}

export function deleteLink(linkId: string): boolean {
  return links.delete(linkId);
}

export function resetTeslaLinkStoreForTests(): void {
  links.clear();
}
