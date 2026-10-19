import { createFileRoute, redirect } from "@tanstack/react-router";
import { DriveCockpit } from "@/components/drive/DriveCockpit";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { getProfile } from "@/lib/sound/profiles";
import { TACH_THEMES, type TachThemeId } from "@/lib/drive/tach-theme";

/** Dev-only: real DriveCockpit in a mocked active drive, for layout checks. */
export const Route = createFileRoute("/debug_/cockpit")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Cockpit · Debug · ELCAMOSO" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CockpitPreview,
});

const PROFILE_FOR: Record<TachThemeId, string> = {
  classic: "racing-v10",
  city: "racing-v10",
  touring: "racing-v10",
  sport: "racing-v10",
  race: "racing-v10",
  nautical: "speed-boat",
  aviation: "private-jet",
  rail: "steam-train",
  warp: "space-ship",
  rocket: "rocket-car",
  stage: "kazoo-kart",
};

const UNIT_FOR: Partial<Record<TachThemeId, string>> = {
  nautical: "kn",
  aviation: "kn",
  warp: "c",
};

function CockpitPreview() {
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const raw = q.get("theme") as TachThemeId | null;
  const theme: TachThemeId = raw && TACH_THEMES[raw] ? raw : "classic";
  const tesla = q.get("tesla") === "1";
  const profile = getProfile(PROFILE_FOR[theme]);
  const speedMps = 25;
  const state: DriveState = {
    ...IDLE_STATE,
    speed: speedMps,
    throttle: 0.6,
    load: 0.6,
    rpm: 6200,
    gear: 3,
    timestamp: 1,
    speedNormalized: 0.55,
  };
  const unit = UNIT_FOR[theme] ?? "km/h";
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <div className="relative z-[1] flex flex-1 flex-col">
        <DriveCockpit
          profile={profile}
          driveState={state}
          productStatus="sound-active"
          sessionKind="simulated"
          displaySpeed={unit === "c" ? "8.3 × 10⁻⁸" : unit === "kn" ? 49 : 90}
          speedUnit={unit}
          speedMps={speedMps}
          onStop={() => {}}
          className={tesla ? "drive-tesla-cockpit" : undefined}
          tachThemeOverride={theme}
        />
      </div>
    </div>
  );
}
