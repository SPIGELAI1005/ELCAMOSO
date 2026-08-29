import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";

export interface DynamicDriveTrialUiState {
  snapshot: DynamicDriveTrialSnapshot | null;
  exhaustedPending: boolean;
  showComplete: boolean;
}

const initial: DynamicDriveTrialUiState = {
  snapshot: null,
  exhaustedPending: false,
  showComplete: false,
};

let state: DynamicDriveTrialUiState = { ...initial };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeDynamicDriveTrialUi(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDynamicDriveTrialUiState(): DynamicDriveTrialUiState {
  return state;
}

export function resetDynamicDriveTrialUiForTests(): void {
  state = { ...initial };
  listeners.clear();
}

export function setDynamicDriveTrialSnapshot(snapshot: DynamicDriveTrialSnapshot | null): void {
  state = { ...state, snapshot };
  emit();
}

export function markDynamicDriveTrialExhaustedPending(): void {
  if (state.exhaustedPending) return;
  state = { ...state, exhaustedPending: true };
  emit();
}

export function showDynamicDriveTrialComplete(): void {
  state = { ...state, showComplete: true, exhaustedPending: false };
  emit();
}

export function dismissDynamicDriveTrialComplete(): void {
  state = { ...state, showComplete: false };
  emit();
}
