/** Settings fields required to resolve Drive debug mode. */
export interface DriveDebugSettings {
  devPanel: boolean;
  debugDriveDiagnostics: boolean;
}

/**
 * Developer-only Drive diagnostics are gated behind the diagnostics panel
 * plus an explicit debug toggle or `?debug=1` on `/drive`.
 */
export function isDriveDebugModeActive(settings: DriveDebugSettings, searchDebug = false): boolean {
  return settings.devPanel && (settings.debugDriveDiagnostics || searchDebug);
}
