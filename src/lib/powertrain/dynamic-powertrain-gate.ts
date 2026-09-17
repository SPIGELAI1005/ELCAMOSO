/**
 * Explicit Dynamic Drive / PowertrainSimulator activation gate.
 * Prefer this over inline boolean chains so demo vs entitlement is obvious.
 */
export interface DynamicPowertrainGateInput {
  /** Sound profile uses virtual-transmission (not continuous). */
  supportsVirtualTransmission: boolean;
  /** Persisted user preference (Motion-matched gears). */
  settingsDynamicDrive: boolean;
  /** Drive+ / trial entitlement for dynamic_drive. */
  hasDynamicDriveEntitlement: boolean;
  /** Session kind from DriveSession. */
  sessionKind: "drive" | "demo" | "audition" | "ab" | "replay" | string;
}

/**
 * Whether production code should tick PowertrainSimulator for this profile/session.
 *
 * Demo may use the simulator for VT profiles even without entitlement (preview).
 * Continuous profiles never use it.
 * Live Drive requires both the setting and entitlement.
 */
export function shouldUseDynamicPowertrain(input: DynamicPowertrainGateInput): boolean {
  if (!input.supportsVirtualTransmission) return false;

  const demoAllowsDynamic = input.sessionKind === "demo";
  if (demoAllowsDynamic) return true;

  return input.settingsDynamicDrive && input.hasDynamicDriveEntitlement;
}

/**
 * SessionBridge pre-ANDs setting ∧ entitlement into config.dynamicDrive.
 * DriveSession only sees that combined flag + demo bypass.
 */
export function shouldUseDynamicPowertrainFromSessionConfig(input: {
  supportsVirtualTransmission: boolean;
  /** Already entitlement-gated by SessionBridge when kind is drive. */
  configDynamicDrive: boolean;
  sessionKind: string;
}): boolean {
  return shouldUseDynamicPowertrain({
    supportsVirtualTransmission: input.supportsVirtualTransmission,
    settingsDynamicDrive: input.configDynamicDrive,
    // When config was pre-gated, treat config true as entitlement+setting satisfied.
    hasDynamicDriveEntitlement: input.configDynamicDrive,
    sessionKind: input.sessionKind,
  });
}
