/**
 * Drive relay configuration.
 *
 * Local / Vite: same-origin WebSocket via `driveRelayWsPlugin`.
 * Production (Vercel): long-lived WS is not available on the app origin -
 * set `VITE_DRIVE_RELAY_PUBLIC_ORIGIN` to the dedicated relay host
 * (see `docs/DRIVE_RELAY_DEPLOYMENT.md`).
 *
 * Never put join secrets or Stripe/Google/DB credentials in this module.
 */

/** Phase 2: stream normalized motion samples over the relay WebSocket. */
export const RELAY_MOTION_STREAM_ENABLED = true;

/** Max JSON message bytes accepted by the hub (oversized → reject). */
export const RELAY_MAX_MESSAGE_BYTES = 8_192;

function readPublicOriginEnv(): string {
  try {
    const env = import.meta.env as { VITE_DRIVE_RELAY_PUBLIC_ORIGIN?: string };
    return env.VITE_DRIVE_RELAY_PUBLIC_ORIGIN?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Public origin for the WebSocket relay (no path).
 * Empty / unset → use the page origin (local Vite / preview).
 *
 * Example production: `https://relay.elcamoso.com`
 */
export function getDriveRelayPublicOrigin(): string {
  const raw = readPublicOriginEnv();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.origin;
  } catch {
    return "";
  }
}

/** True when clients must dial a dedicated relay host (not same-origin). */
export function isDedicatedDriveRelayConfigured(): boolean {
  return getDriveRelayPublicOrigin().length > 0;
}

/**
 * Origin used to build `wss://…/api/drive-relay/ws`.
 * Falls back to `fallbackOrigin` (typically `window.location.origin`).
 */
export function resolveDriveRelayWsOrigin(fallbackOrigin: string): string {
  return getDriveRelayPublicOrigin() || fallbackOrigin;
}
