/** Pocket-mode unlock is a deliberate hold, not a tap. */
export const POCKET_UNLOCK_HOLD_MS = 1500;

export function pocketUnlockProgress(heldMs: number, requiredMs = POCKET_UNLOCK_HOLD_MS): number {
  if (!Number.isFinite(heldMs) || heldMs <= 0 || requiredMs <= 0) return 0;
  return Math.min(1, heldMs / requiredMs);
}

export function pocketUnlockReady(heldMs: number, requiredMs = POCKET_UNLOCK_HOLD_MS): boolean {
  return pocketUnlockProgress(heldMs, requiredMs) >= 1;
}
