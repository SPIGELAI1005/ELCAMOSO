import { useSyncExternalStore } from "react";

import {
  getDynamicDriveTrialUiState,
  subscribeDynamicDriveTrialUi,
  type DynamicDriveTrialUiState,
} from "@/lib/dynamic-drive-trial/trial-ui-store";

let serverTrialUiSnapshot: DynamicDriveTrialUiState | undefined;

function getServerTrialUiSnapshot(): DynamicDriveTrialUiState {
  if (!serverTrialUiSnapshot) {
    serverTrialUiSnapshot = getDynamicDriveTrialUiState();
  }
  return serverTrialUiSnapshot;
}

export function useDynamicDriveTrialUi() {
  return useSyncExternalStore(
    subscribeDynamicDriveTrialUi,
    getDynamicDriveTrialUiState,
    getServerTrialUiSnapshot,
  );
}
