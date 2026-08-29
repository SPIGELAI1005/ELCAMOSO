import { DYNAMIC_DRIVE_SESSION_CONFLICT_MESSAGE } from "@/lib/dynamic-drive-session/config";

export interface DynamicDriveSessionUiState {
  conflictMessage: string | null;
  dismissed: boolean;
}

let state: DynamicDriveSessionUiState = {
  conflictMessage: null,
  dismissed: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getDynamicDriveSessionUiState(): DynamicDriveSessionUiState {
  return state;
}

export function subscribeDynamicDriveSessionUi(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showDynamicDriveSessionConflict(message = DYNAMIC_DRIVE_SESSION_CONFLICT_MESSAGE) {
  state = { conflictMessage: message, dismissed: false };
  emit();
}

export function clearDynamicDriveSessionConflict() {
  state = { conflictMessage: null, dismissed: false };
  emit();
}

export function dismissDynamicDriveSessionConflict() {
  if (!state.conflictMessage) return;
  state = { ...state, dismissed: true };
  emit();
}

export function resetDynamicDriveSessionUiForTests() {
  state = { conflictMessage: null, dismissed: false };
  listeners.clear();
}
