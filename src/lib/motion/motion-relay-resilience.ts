/** Grace before treating phone relay peer drop as a sustained loss (reconnect, network switch, lock). */
export const RELAY_PHONE_LOST_GRACE_MS = 2500;

/** Brief packet-loss gap before fusion leaves the active tier (hold bridges to next source). */
export const PACKET_LOSS_HOLD_MS = 2200;

export interface RelayGraceState {
  phoneLostTimer: ReturnType<typeof setTimeout> | null;
}

export function createRelayGraceState(): RelayGraceState {
  return { phoneLostTimer: null };
}

export function cancelPhoneRelayGrace(state: RelayGraceState): void {
  if (state.phoneLostTimer !== null) {
    clearTimeout(state.phoneLostTimer);
    state.phoneLostTimer = null;
  }
}

export function schedulePhoneRelayGrace(
  state: RelayGraceState,
  onExpired: () => void,
  graceMs = RELAY_PHONE_LOST_GRACE_MS,
): void {
  if (state.phoneLostTimer !== null) return;
  state.phoneLostTimer = setTimeout(() => {
    state.phoneLostTimer = null;
    onExpired();
  }, graceMs);
}
