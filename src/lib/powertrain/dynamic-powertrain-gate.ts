/**
 * Explicit PowertrainSimulator activation gate.
 * Prefer this over inline boolean chains so demo vs entitlement is obvious.
 *
 * Two tiers share the simulator:
 * - Virtual transmission (FREE, `virtual_transmission`): motion-matched gears and RPM
 *   for every virtual-transmission Sound Profile the user may drive.
 * - Dynamic Drive (Drive+, `dynamic_drive`): adds rev-match, overrun / turbo transients
 *   and shift-feel tuning on top. See `dynamicDriveExtrasActive`.
 */
export interface DynamicPowertrainGateInput {
  /** Sound profile uses virtual-transmission (not continuous). */
  supportsVirtualTransmission: boolean;
  /** Persisted user preference (Motion-matched gears). */
  settingsDynamicDrive: boolean;
  /** Drive+ / trial entitlement for dynamic_drive. */
  hasDynamicDriveEntitlement: boolean;
  /** FREE entitlement for virtual_transmission (gears without the premium extras). */
  hasVirtualTransmissionEntitlement?: boolean;
  /** Session kind from DriveSession. */
  sessionKind: "drive" | "demo" | "audition" | "ab" | "replay" | string;
}

/**
 * Whether production code should tick PowertrainSimulator for this profile/session.
 *
 * Demo may use the simulator for VT profiles even without entitlement (preview).
 * Continuous profiles never use it.
 * Live Drive runs it whenever the user holds `virtual_transmission` (FREE) or
 * has Dynamic Drive switched on with the matching entitlement.
 */
export function shouldUseDynamicPowertrain(input: DynamicPowertrainGateInput): boolean {
  if (!input.supportsVirtualTransmission) return false;

  const demoAllowsDynamic = input.sessionKind === "demo";
  if (demoAllowsDynamic) return true;

  if (input.hasVirtualTransmissionEntitlement) return true;
  return input.settingsDynamicDrive && input.hasDynamicDriveEntitlement;
}

/**
 * SessionBridge pre-ANDs setting ∧ entitlement into config.dynamicDrive and copies the
 * virtual_transmission entitlement into config.virtualTransmission.
 * DriveSession only sees those flags + demo bypass.
 */
export function shouldUseDynamicPowertrainFromSessionConfig(input: {
  supportsVirtualTransmission: boolean;
  /** Already entitlement-gated by SessionBridge when kind is drive. */
  configDynamicDrive: boolean;
  /** FREE virtual-transmission entitlement mirrored into session config. */
  configVirtualTransmission?: boolean;
  sessionKind: string;
}): boolean {
  return shouldUseDynamicPowertrain({
    supportsVirtualTransmission: input.supportsVirtualTransmission,
    settingsDynamicDrive: input.configDynamicDrive,
    // When config was pre-gated, treat config true as entitlement+setting satisfied.
    hasDynamicDriveEntitlement: input.configDynamicDrive,
    hasVirtualTransmissionEntitlement: input.configVirtualTransmission ?? false,
    sessionKind: input.sessionKind,
  });
}

/**
 * Whether the premium Dynamic Drive extras (rev-match, overrun / turbo / pop transients)
 * should render. Demo previews the full experience; live Drive needs Drive+.
 */
export function dynamicDriveExtrasActive(input: {
  configDynamicDrive: boolean;
  sessionKind: string;
}): boolean {
  if (input.sessionKind === "demo") return true;
  return input.configDynamicDrive;
}
