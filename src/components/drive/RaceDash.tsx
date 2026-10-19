import { memo } from "react";

export interface RaceDashReadout {
  gear: string;
  speed: string;
  unit: string;
  rpmText: string | null;
}

const LEDS = 15;
const BARS = 32;
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const RED = "#ef4444";

function ledColor(i: number) {
  return i < 5 ? GREEN : i < 10 ? AMBER : RED;
}

/**
 * Race shift mode: motorsport race-dash (shift-light strip, segmented rpm bar
 * graph, big gear). Pure SVG inside the fixed tach box; `v` is the smoothed
 * 0..1 rev fraction (the intro sweep drives it to redline and back).
 */
export const RaceDash = memo(function RaceDash({
  v,
  zoneStart,
  redlineRpm,
  readout,
  intro,
  reducedMotion,
}: {
  v: number;
  zoneStart: number;
  redlineRpm: number | null;
  readout: RaceDashReadout | null;
  intro: boolean;
  reducedMotion: boolean;
}) {
  // Shift lights: first LED at 55% revs, all lit at 96%, flash at the limiter.
  const ledFrac = Math.min(1, Math.max(0, (v - 0.55) / 0.41));
  const lit = Math.round(ledFrac * LEDS);
  const limiter = v >= 0.965;
  const flash = limiter && !reducedMotion && !intro;
  const x0 = 34;
  const x1 = 266;
  const barW = (x1 - x0) / BARS;
  const thousands = redlineRpm ? Math.ceil(redlineRpm / 1000) : 0;
  return (
    <svg
      viewBox="0 0 300 300"
      className="mode-tach race-dash pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
      data-tach-theme="race"
      data-intro={intro ? "1" : "0"}
      aria-hidden="true"
      overflow="hidden"
    >
      <defs>
        <linearGradient id="rd-bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a2e" />
          <stop offset="100%" stopColor="#0d0d10" />
        </linearGradient>
        <filter id="rd-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {/* Bezel + screen */}
      <rect x="6" y="40" width="288" height="220" rx="24" fill="url(#rd-bezel)" stroke="rgba(255,255,255,0.12)" />
      <rect x="20" y="76" width="260" height="172" rx="12" fill="#050507" stroke="rgba(255,255,255,0.06)" />

      {/* Shift-light strip */}
      {Array.from({ length: LEDS }, (_, i) => {
        const cx = 38 + (i * (262 - 38)) / (LEDS - 1);
        const on = limiter || i < lit;
        const c = limiter ? RED : ledColor(i);
        return (
          <g key={i} className={on && flash ? "mode-tach__flash" : undefined}>
            {on ? <circle cx={cx} cy={58} r={6} fill={c} opacity={0.55} filter="url(#rd-glow)" /> : null}
            <circle cx={cx} cy={58} r={4.2} fill={on ? c : "#1c1c20"} stroke="rgba(0,0,0,0.6)" strokeWidth={0.8} />
          </g>
        );
      })}

      {/* Segmented rising rpm bar graph */}
      {Array.from({ length: BARS }, (_, i) => {
        const f = (i + 1) / BARS;
        const h = 8 + 30 * Math.min(1, f / 0.5);
        const on = f <= v + 1e-6;
        const c = f >= zoneStart ? RED : f >= zoneStart - 0.18 ? AMBER : GREEN;
        return (
          <rect
            key={i}
            x={x0 + i * barW + 0.8}
            y={128 - h}
            width={barW - 1.6}
            height={h}
            rx={0.8}
            fill={on ? c : f >= zoneStart ? "rgba(239,68,68,0.16)" : "#16161a"}
          />
        );
      })}
      <line x1={x0 + (x1 - x0) * zoneStart} y1={86} x2={x0 + (x1 - x0) * zoneStart} y2={132} stroke={RED} strokeWidth={1} opacity={0.7} />
      {thousands > 0
        ? Array.from({ length: thousands + 1 }, (_, k) => (
            <text
              key={k}
              x={x0 + ((x1 - x0) * k * 1000) / (thousands * 1000)}
              y={143}
              fontSize={9}
              textAnchor="middle"
              fill={k * 1000 >= (redlineRpm ?? 0) * zoneStart ? RED : "rgba(255,255,255,0.5)"}
              className="tabular-nums"
            >
              {k}
            </text>
          ))
        : null}

      {readout ? (
        <>
          <text x={150} y={222} fontSize={78} fontWeight={300} textAnchor="middle" fill={limiter ? RED : "#fff"} className="tabular-nums">
            {readout.gear}
          </text>
          <text x={34} y={176} fontSize={8} letterSpacing={2} fill="rgba(255,255,255,0.45)">RPM</text>
          <text x={34} y={196} fontSize={17} fontWeight={300} fill={limiter ? RED : "rgba(255,255,255,0.85)"} className="tabular-nums">
            {readout.rpmText ?? "—"}
          </text>
          <text x={266} y={176} fontSize={8} letterSpacing={2} textAnchor="end" fill="rgba(255,255,255,0.45)">
            {readout.unit.toUpperCase()}
          </text>
          <text x={266} y={196} fontSize={17} fontWeight={300} textAnchor="end" fill="rgba(255,255,255,0.85)" className="tabular-nums">
            {readout.speed}
          </text>
          <text x={150} y={240} fontSize={7} letterSpacing={3} textAnchor="middle" fill="rgba(255,255,255,0.35)">GEAR</text>
        </>
      ) : null}
    </svg>
  );
});
