import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useAudition } from "@/lib/drive/useAudition";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { useSettings } from "@/lib/drive/useSettings";
import {
  DEFAULT_TUNING,
  getProfileGain,
  getTuning,
  type ProfileTuning,
} from "@/lib/drive/settings";
import { getProfile } from "@/lib/sound/profiles";
import { HeadroomMeter } from "@/components/HeadroomMeter";

/**
 * Audition mode - preview the selected profile with simulated motion and
 * fine-tune how it reacts, before any real drive starts.
 */
export function AuditionPanel({ profileId }: { profileId: string }) {
  const { settings, update } = useSettings();
  const reducedMotion = useReducedMotion();
  const profile = getProfile(profileId);
  const tuning = getTuning(settings, profileId);
  const profileGain = getProfileGain(settings, profileId);
  const { active, state, start, stop, targetKmh, setTarget, meter } = useAudition({
    profileId,
    volume: settings.volume,
    tuning,
    profileGain,
  });

  const setGain = (value: number) => {
    update({ profileGain: { ...settings.profileGain, [profileId]: value } });
  };

  const setTuning = (next: Partial<ProfileTuning>) => {
    update({
      tuning: { ...settings.tuning, [profileId]: { ...tuning, ...next } },
    });
  };

  const continuous = profile.drivetrainMode === "continuous";
  const headroom = (
    <HeadroomMeter
      className="mt-10 border-t border-border pt-6"
      meter={meter}
      profile={profile}
      volume={settings.volume}
      profileGain={profileGain}
    />
  );

  return (
    <section className="mt-16 border border-border p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <ElcamosoMark
            intensity={active ? state.load : 0.34}
            throttle={active ? state.throttle : 0}
            regen={active ? state.regen : 0}
            waveResponse={profile.voice.waveResponse}
            reducedMotion={reducedMotion}
            className="h-8 w-auto"
          />
          <div>
            <h2 className="text-lg font-light">Audition: {profile.name}</h2>
            <p className="mt-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Simulated motion · no sensors
            </p>
          </div>
        </div>
        <button
          onClick={() => (active ? stop() : void start())}
          className="h-12 rounded-full border border-border px-8 text-xs tracking-[0.24em] uppercase transition-colors hover:bg-secondary"
          aria-pressed={active}
        >
          {active ? "Stop preview" : "Preview sound"}
        </button>
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="audition-speed" className="text-sm">
              Simulated speed
            </label>
            <span className="text-sm text-muted-foreground tabular-nums">
              {targetKmh} km/h
            </span>
          </div>
          <input
            id="audition-speed"
            type="range"
            min={0}
            max={180}
            step={1}
            value={targetKmh}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="mt-5 h-px w-full appearance-none bg-border accent-foreground"
          />
          <div className="mt-5 flex gap-3">
            {[0, 30, 60, 110, 160].map((v) => (
              <button
                key={v}
                onClick={() => setTarget(v)}
                className="h-9 min-w-11 rounded-full border border-border px-3 text-[11px] tracking-[0.16em] text-muted-foreground uppercase hover:text-foreground"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-4 self-start text-center">
          <Readout label="km/h" value={Math.round(state.speed * 3.6)} />
          <Readout
            label={continuous ? "Intensity" : "RPM"}
            value={continuous ? Math.round(state.load * 100) : Math.round(state.rpm)}
          />
          <Readout
            label={continuous ? "Mode" : "Gear"}
            value={continuous ? " - " : state.gear ? `D${state.gear}` : " - "}
          />
        </dl>
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <div className="flex items-baseline justify-between">
          <label htmlFor="profile-gain" className="text-sm">
            Profile balance
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {profileGain.toFixed(2)}x
          </span>
        </div>
        <input
          id="profile-gain"
          type="range"
          min={0.4}
          max={1.6}
          step={0.05}
          value={profileGain}
          onChange={(e) => setGain(Number(e.target.value))}
          className="mt-4 h-px w-full appearance-none bg-border accent-foreground"
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Level this profile against the others. Master volume and the safety limiter stay
          in control, so dynamics are preserved.
        </p>
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm">Motion response</h3>
          <button
            onClick={() => setTuning(DEFAULT_TUNING)}
            className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
          >
            Reset
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Saved for {profile.name} and used on your next drive.
        </p>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          <Tuner
            id="tune-throttle"
            label="Throttle"
            hint="How eagerly acceleration lifts the sound"
            value={tuning.throttle}
            onChange={(v) => setTuning({ throttle: v })}
          />
          <Tuner
            id="tune-response"
            label="Intensity"
            hint="How strongly speed fills the sound out"
            value={tuning.response}
            onChange={(v) => setTuning({ response: v })}
          />
          <Tuner
            id="tune-regen"
            label="Regen"
            hint="How audible slowing down becomes"
            value={tuning.regen}
            min={0}
            onChange={(v) => setTuning({ regen: v })}
          />
        </div>
      </div>
      {headroom}
    </section>
  );
}

function Readout({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dd className="text-2xl font-extralight tabular-nums">{value}</dd>
      <dt className="mt-2 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        {label}
      </dt>
    </div>
  );
}

function Tuner({
  id,
  label,
  hint,
  value,
  onChange,
  min = 0.2,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value.toFixed(2)}×
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={2}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 h-px w-full appearance-none bg-border accent-foreground"
      />
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
