import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import {
  DEFAULT_TWEAKS,
  materializeCustom,
  type CustomSound,
  type StudioTweaks,
} from "@/lib/drive/settings";
import { getProfile } from "@/lib/sound/profiles";
import {
  fingerprintPcm,
  renderCorePcm,
  type AudioFingerprint,
} from "@/lib/sound/regression/fingerprint";

export interface RegressionScenario {
  id: string;
  label: string;
  profileId: string;
  tweaks?: StudioTweaks;
  state: DriveState;
}

function hold(profileId: string, speed: number, acceleration: number, steps = 24): DriveState {
  const profile = getProfile(profileId);
  let previous = IDLE_STATE;
  for (let i = 0; i < steps; i += 1) {
    previous = computeDriveState({
      speed,
      acceleration,
      previous,
      profile,
      dt: 1 / 60,
    });
  }
  return previous;
}

export const REGRESSION_SCENARIOS: RegressionScenario[] = [
  { id: "gt-v8-idle", label: "GT V8 idle", profileId: "gt-v8", state: hold("gt-v8", 0, 0) },
  {
    id: "gt-v8-cruise",
    label: "GT V8 cruise",
    profileId: "gt-v8",
    state: hold("gt-v8", 22, 0.15),
  },
  {
    id: "gt-v8-throttle",
    label: "GT V8 throttle",
    profileId: "gt-v8",
    state: hold("gt-v8", 18, 2.4),
  },
  {
    id: "gt-v8-regen",
    label: "GT V8 regen",
    profileId: "gt-v8",
    state: hold("gt-v8", 16, -2.2),
  },
  {
    id: "cyber-pulse-cruise",
    label: "Cyber Pulse cruise",
    profileId: "cyber-pulse",
    state: hold("cyber-pulse", 20, 0.4),
  },
  {
    id: "studio-pitch-up",
    label: "Studio pitch up",
    profileId: "gt-v8",
    tweaks: { ...DEFAULT_TWEAKS, pitch: 1.45 },
    state: hold("gt-v8", 20, 0.8),
  },
  {
    id: "studio-grit",
    label: "Studio grit",
    profileId: "gt-v8",
    tweaks: { ...DEFAULT_TWEAKS, grit: 1.8, texture: 1.4 },
    state: hold("gt-v8", 18, 1.1),
  },
  {
    id: "studio-dark",
    label: "Studio darker",
    profileId: "cyber-pulse",
    tweaks: { ...DEFAULT_TWEAKS, brightness: 0.55, pitch: 0.82 },
    state: hold("cyber-pulse", 14, 0.2),
  },
];

export function scenarioProfile(scenario: RegressionScenario) {
  if (!scenario.tweaks) return getProfile(scenario.profileId);
  const sound: CustomSound = {
    id: `regression-${scenario.id}`,
    name: scenario.label,
    baseId: scenario.profileId,
    createdAt: 0,
    tweaks: scenario.tweaks,
  };
  return materializeCustom(sound);
}

export function fingerprintScenario(scenario: RegressionScenario): AudioFingerprint {
  const profile = scenarioProfile(scenario);
  const pcm = renderCorePcm(profile, scenario.state, {
    seed: 1,
    duration: 0.45,
    sampleRate: 22050,
  });
  return fingerprintPcm(pcm, 22050);
}
