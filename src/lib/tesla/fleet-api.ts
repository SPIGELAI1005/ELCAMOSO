import {
  fleetApiBaseForRegion,
  readTeslaOAuthConfig,
  type TeslaFleetRegion,
} from "@/lib/tesla/config";
import { getValidAccessToken, updateLinkRegion, updateLinkVehicles } from "@/lib/tesla/link-store";
import { mapVehicleDataToTelemetryRecord } from "@/lib/tesla/map-vehicle-data";
import type { TeslaVehicleSummary } from "@/lib/tesla/types";
import type { TeslaFleetTelemetryRecord } from "@/lib/motion/vehicle-telemetry/types";

interface FleetVehicleRow {
  vin?: string;
  display_name?: string;
  vehicle_id?: number;
}

async function fleetFetch(linkId: string, path: string, init?: RequestInit): Promise<Response> {
  const tokens = await getValidAccessToken(linkId);
  if (!tokens) throw new Error("Tesla session expired. Connect again.");
  return fetch(`${tokens.fleetApiBase}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function fetchUserRegion(accessToken: string, fleetApiBase: string): Promise<Response> {
  return fetch(`${fleetApiBase}/api/1/users/region`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
  });
}

const REGION_FALLBACK_ORDER: TeslaFleetRegion[] = ["NA", "EU", "CN"];

export async function resolveUserFleetRegion(
  linkId: string,
): Promise<{ fleetApiBase: string; region: string } | null> {
  const tokens = await getValidAccessToken(linkId);
  if (!tokens) return null;

  const basesToTry = [
    tokens.fleetApiBase,
    ...REGION_FALLBACK_ORDER.map((r) => fleetApiBaseForRegion(r, tokens.fleetApiBase)).filter(
      (base) => base !== tokens.fleetApiBase,
    ),
  ];

  for (const base of basesToTry) {
    const res = await fetchUserRegion(tokens.accessToken, base);
    if (res.status === 421) continue;
    if (!res.ok) return null;
    const json = (await res.json()) as {
      response?: { region?: string; fleet_api_base_url?: string };
    };
    const region = json.response?.region ?? "NA";
    const fleetApiBase = json.response?.fleet_api_base_url ?? fleetApiBaseForRegion(region, base);
    updateLinkRegion(linkId, fleetApiBase, region);
    return { fleetApiBase, region };
  }

  return null;
}

export async function listVehicles(linkId: string): Promise<TeslaVehicleSummary[]> {
  const res = await fleetFetch(linkId, "/api/1/vehicles");
  if (!res.ok) {
    throw new Error(`Could not list vehicles (${res.status}).`);
  }
  const json = (await res.json()) as { response?: FleetVehicleRow[] };
  const rows = Array.isArray(json.response) ? json.response : [];
  const vehicles = rows
    .filter((row) => typeof row.vin === "string" && row.vin.length >= 11)
    .map((row) => ({
      vin: row.vin!,
      displayName: row.display_name?.trim() || row.vin!,
    }));
  updateLinkVehicles(linkId, vehicles);
  return vehicles;
}

/** Read-only Fleet API usage — no commands or wake calls. */
export async function refreshVehicleList(linkId: string): Promise<TeslaVehicleSummary[]> {
  await resolveUserFleetRegion(linkId);
  return listVehicles(linkId);
}

/**
 * Poll cached vehicle_data for motion fields (Data pricing category).
 * Use sparingly — prefer Fleet Telemetry streaming when available.
 */
export async function fetchVehicleDataFields(
  linkId: string,
  vin: string,
): Promise<TeslaFleetTelemetryRecord | null> {
  const res = await fleetFetch(linkId, `/api/1/vehicles/${encodeURIComponent(vin)}/vehicle_data`);
  if (res.status === 408) return null;
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return mapVehicleDataToTelemetryRecord({ vin, response: json, receivedAt: Date.now() });
}
