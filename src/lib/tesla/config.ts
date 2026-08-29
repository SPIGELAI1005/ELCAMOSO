export type ElcamosoDeployEnv = "development" | "staging" | "production";

export type TeslaFleetRegion = "NA" | "EU" | "CN";

const FLEET_API_BASE: Record<TeslaFleetRegion, string> = {
  NA: "https://fleet-api.prd.na.vn.cloud.tesla.com",
  EU: "https://fleet-api.prd.eu.vn.cloud.tesla.com",
  CN: "https://fleet-api.prd.cn.vn.cloud.tesla.cn",
};

const DEFAULT_AUTH_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
const DEFAULT_AUTHORIZE_URL = "https://auth.tesla.com/oauth2/v3/authorize";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolveDeployEnv(): ElcamosoDeployEnv {
  const raw = readEnv("ELCAMOSO_ENV") ?? readEnv("VERCEL_ENV") ?? "development";
  if (raw === "production" || raw === "preview")
    return raw === "production" ? "production" : "staging";
  if (raw === "staging") return "staging";
  return "development";
}

function envSuffix(deploy: ElcamosoDeployEnv): string {
  if (deploy === "production") return "_PRODUCTION";
  if (deploy === "staging") return "_STAGING";
  return "";
}

export function readTeslaOAuthConfig() {
  const deploy = resolveDeployEnv();
  const suffix = envSuffix(deploy);
  const clientId = readEnv(`TESLA_CLIENT_ID${suffix}`) ?? readEnv("TESLA_CLIENT_ID");
  const clientSecret = readEnv(`TESLA_CLIENT_SECRET${suffix}`) ?? readEnv("TESLA_CLIENT_SECRET");
  const redirectUri = readEnv(`TESLA_REDIRECT_URI${suffix}`) ?? readEnv("TESLA_REDIRECT_URI");
  const encryptionKey = readEnv("TESLA_TOKEN_ENCRYPTION_KEY");
  const developerDomain = readEnv("TESLA_DEVELOPER_DOMAIN");
  const regionRaw = (readEnv("TESLA_FLEET_REGION") ?? "NA").toUpperCase();
  const fleetRegion: TeslaFleetRegion = regionRaw === "EU" || regionRaw === "CN" ? regionRaw : "NA";

  return {
    deploy,
    configured: Boolean(clientId && clientSecret && redirectUri && encryptionKey),
    clientId: clientId ?? "",
    clientSecret: clientSecret ?? "",
    redirectUri: redirectUri ?? "",
    encryptionKey: encryptionKey ?? "",
    developerDomain: developerDomain ?? "",
    fleetApiBase: FLEET_API_BASE[fleetRegion],
    authTokenUrl: readEnv("TESLA_AUTH_TOKEN_URL") ?? DEFAULT_AUTH_TOKEN_URL,
    authorizeUrl: DEFAULT_AUTHORIZE_URL,
  };
}

export function fleetApiBaseForRegion(region: string | undefined, fallback: string): string {
  const key = (region ?? "").toUpperCase();
  if (key === "EU") return FLEET_API_BASE.EU;
  if (key === "CN") return FLEET_API_BASE.CN;
  if (key === "NA") return FLEET_API_BASE.NA;
  return fallback;
}
