import {
  DYNAMIC_DRIVE_SESSION_CONFLICT_MESSAGE,
} from "@/lib/dynamic-drive-session/config";
import type { DynamicDriveSessionSnapshot } from "@/lib/dynamic-drive-session/types";

export class DynamicDriveSessionConflictError extends Error {
  readonly snapshot: DynamicDriveSessionSnapshot;

  constructor(snapshot: DynamicDriveSessionSnapshot) {
    super(DYNAMIC_DRIVE_SESSION_CONFLICT_MESSAGE);
    this.name = "DynamicDriveSessionConflictError";
    this.snapshot = snapshot;
  }
}

export function isDynamicDriveSessionConflictError(
  error: unknown,
): error is DynamicDriveSessionConflictError {
  return error instanceof DynamicDriveSessionConflictError;
}
