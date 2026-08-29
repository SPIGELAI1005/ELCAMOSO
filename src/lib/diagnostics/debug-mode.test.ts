import { describe, expect, it } from "vitest";
import { isDriveDebugModeActive } from "@/lib/diagnostics/debug-mode";

describe("isDriveDebugModeActive", () => {
  it("requires dev panel and an explicit debug toggle", () => {
    expect(isDriveDebugModeActive({ devPanel: false, debugDriveDiagnostics: true }, false)).toBe(
      false,
    );
    expect(isDriveDebugModeActive({ devPanel: true, debugDriveDiagnostics: false }, false)).toBe(
      false,
    );
    expect(isDriveDebugModeActive({ devPanel: true, debugDriveDiagnostics: true }, false)).toBe(
      true,
    );
  });

  it("accepts ?debug=1 when dev panel is enabled", () => {
    expect(isDriveDebugModeActive({ devPanel: true, debugDriveDiagnostics: false }, true)).toBe(
      true,
    );
  });
});
