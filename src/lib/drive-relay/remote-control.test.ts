import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/drive/settings";
import { IDLE_STATE } from "@/lib/drive/model";
import type { SessionSnapshot } from "@/lib/drive/session";
import {
  buildDriveRemoteState,
  parseDriveRemoteState,
  patchFromPhoneRemoteAction,
  RELAY_CONTROL_KINDS,
  remoteProfileOptions,
} from "@/lib/drive-relay/remote-control";

const idleSnap = (): SessionSnapshot =>
  ({
    kind: "idle",
    status: "idle",
    profileId: "gt-v8",
    state: IDLE_STATE,
  }) as SessionSnapshot;

describe("remote-control", () => {
  it("builds and parses drive state sync payload", () => {
    const state = buildDriveRemoteState(DEFAULT_SETTINGS, idleSnap());
    const parsed = parseDriveRemoteState(state);
    expect(parsed?.profileId).toBe(DEFAULT_SETTINGS.profileId);
    expect(parsed?.volume).toBe(DEFAULT_SETTINGS.volume);
    expect(parsed?.dynamicDrive).toBe(true);
  });

  it("maps phone profile change to settings patch", () => {
    const patch = patchFromPhoneRemoteAction(
      RELAY_CONTROL_KINDS.SET_PROFILE,
      { profileId: "rally-car" },
      DEFAULT_SETTINGS,
    );
    expect(patch?.profileId).toBe("rally-car");
  });

  it("maps sound intensity to tuning.response for a specific profile", () => {
    const patch = patchFromPhoneRemoteAction(
      RELAY_CONTROL_KINDS.SET_SOUND_INTENSITY,
      { response: 1.35, profileId: "rally-car" },
      DEFAULT_SETTINGS,
    );
    expect(patch?.tuning?.["rally-car"]?.response).toBe(1.35);
  });

  it("maps transient intensity to shiftFeel.revMatch", () => {
    const patch = patchFromPhoneRemoteAction(
      RELAY_CONTROL_KINDS.SET_TRANSIENT,
      { revMatch: 0.72 },
      DEFAULT_SETTINGS,
    );
    expect(patch?.shiftFeel?.revMatch).toBe(0.72);
  });

  it("lists favourites and defaults for remote picker", () => {
    const options = remoteProfileOptions({
      ...DEFAULT_SETTINGS,
      favourites: ["rally-car"],
    });
    expect(options.some((p) => p.id === "rally-car")).toBe(true);
    expect(options.some((p) => p.id === DEFAULT_SETTINGS.profileId)).toBe(true);
  });
});
