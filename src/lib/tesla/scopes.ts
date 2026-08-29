/** Minimum OAuth scopes for Connect Vehicle (official Tesla scope names). */
export const TESLA_MINIMUM_SCOPES = ["openid", "offline_access", "vehicle_device_data"] as const;

export const TESLA_SCOPE_STRING = TESLA_MINIMUM_SCOPES.join(" ");

export function scopeSummaryForUi(): string[] {
  return [
    "Sign in with your Tesla account",
    "Keep the connection active without signing in every drive (refresh token)",
    "Read vehicle device data for motion-linked sound (no commands)",
  ];
}
