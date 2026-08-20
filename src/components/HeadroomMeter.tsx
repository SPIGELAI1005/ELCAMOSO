import { intensityBand, type SoundProfile } from "@/lib/sound/profiles";

export interface MeterReading {
  peak: number;
  rms: number;
  headroom: number;
  reduction: number;
}

/**
 * Loudness headroom readout. Shows how much room is left before the limiter
 * starts holding the sound back, so a profile that will feel too intense can be
 * spotted before switching into it.
 */
export function HeadroomMeter({
  meter,
  profile,
  volume,
  profileGain,
  className = "",
}: {
  meter: MeterReading | null;
  profile: SoundProfile;
  volume: number;
  profileGain: number;
  className?: string;
}) {
  const band = intensityBand(profile);
  const level = meter ? Math.min(1, meter.peak / 0.85) : 0;
  const headroomPct = meter ? Math.round(meter.headroom * 100) : null;
  const limiting = (meter?.reduction ?? 0) > 1.5;

  const warning = limiting
    ? "Peaks are being held back. Lower the master volume or this sound's balance for cleaner dynamics."
    : headroomPct !== null && headroomPct < 12
      ? "Very little headroom left. This will feel loud on the move."
      : band === "intense" && volume * profileGain > 0.8
        ? "This is one of the fuller sounds. Consider easing the balance before you drive."
        : null;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
          Loudness headroom
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {headroomPct !== null ? `${headroomPct}%` : "idle"}
        </p>
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden bg-secondary"
        role="meter"
        aria-label="Loudness headroom"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={headroomPct ?? 100}
      >
        <div
          className={`h-full transition-[width] duration-150 ${
            limiting || level > 0.92
              ? "bg-destructive"
              : level > 0.75
                ? "bg-muted-foreground"
                : "bg-foreground"
          }`}
          style={{ width: `${Math.max(2, level * 100)}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <span className="tracking-[0.18em] uppercase">
          {band === "gentle" ? "Gentle" : band === "balanced" ? "Balanced" : "Intense"} profile
        </span>
        {limiting ? <span>Limiter active</span> : null}
      </div>

      {warning ? (
        <p className="mt-3 text-xs text-muted-foreground">{warning}</p>
      ) : null}
    </div>
  );
}
