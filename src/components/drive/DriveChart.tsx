import { formatClock, type DriveChart as DriveChartModel } from "@/lib/journey/drive-chart";

const W = 360;
const SPEED_TOP = 22;
const SPEED_H = 96;
const ACC_MID = 160;
const ACC_H = 34;
const H = 214;

const KIND_COLOR: Record<string, string> = {
  launch: "#7ee2a8",
  braking: "#ff7a7a",
  "top-speed": "#ffd36e",
  cruise: "#8fb8ff",
  stop: "#c9c9c9",
};

/** Speed, acceleration and braking over the drive, with the moments that shaped the song. */
export function DriveChart({
  chart,
  className,
}: {
  chart: DriveChartModel;
  className?: string;
}) {
  const dur = Math.max(1, chart.durationSec);
  const x = (t: number) => (t / dur) * W;
  const vMax = Math.max(20, chart.maxSpeedKmh * 1.08);
  const aMax = Math.max(1.5, chart.maxAbsAccel);
  const ySpeed = (v: number) => SPEED_TOP + SPEED_H - (v / vMax) * SPEED_H;

  const line = chart.points
    .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${ySpeed(p.speedKmh).toFixed(1)}`)
    .join(" ");
  const area = chart.points.length
    ? `${line} L${x(chart.points[chart.points.length - 1]!.t).toFixed(1)},${SPEED_TOP + SPEED_H} L${x(chart.points[0]!.t).toFixed(1)},${SPEED_TOP + SPEED_H} Z`
    : "";
  const barW = Math.max(1, W / Math.max(1, chart.points.length) - 0.4);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Chart of the drive: speed, acceleration and braking"
      >
        {chart.bands.map((b, i) => (
          <g key={`b${i}`}>
            <rect
              x={x(b.startSec)}
              y={SPEED_TOP}
              width={Math.max(1, x(b.endSec) - x(b.startSec))}
              height={ACC_MID + ACC_H - SPEED_TOP}
              fill="rgba(255,255,255,0.045)"
            />
            <text
              x={x(b.startSec) + 2}
              y={SPEED_TOP + 8}
              fontSize="6"
              fill="rgba(255,255,255,0.45)"
              letterSpacing="0.6"
            >
              {b.chapter}
            </text>
          </g>
        ))}
        {chart.gaps.map((g, i) => (
          <rect
            key={`g${i}`}
            x={x(g.startSec)}
            y={SPEED_TOP}
            width={Math.max(1.5, x(g.endSec) - x(g.startSec))}
            height={ACC_MID + ACC_H - SPEED_TOP}
            fill="rgba(255,255,255,0.12)"
            stroke="rgba(255,255,255,0.3)"
            strokeDasharray="2 2"
            strokeWidth="0.5"
          />
        ))}
        <text x="0" y="10" fontSize="7" fill="rgba(255,255,255,0.6)" letterSpacing="1">
          SPEED · max {Math.round(chart.maxSpeedKmh)} km/h
        </text>
        <path d={area} fill="rgba(180,210,255,0.18)" />
        <path d={line} fill="none" stroke="rgba(180,210,255,0.95)" strokeWidth="1.3" />
        <text
          x="0"
          y={ACC_MID - ACC_H - 4}
          fontSize="7"
          fill="rgba(255,255,255,0.6)"
          letterSpacing="1"
        >
          ACCELERATION ▲ · BRAKING ▼
        </text>
        <line x1="0" x2={W} y1={ACC_MID} y2={ACC_MID} stroke="rgba(255,255,255,0.2)" />
        {chart.points.map((p, i) => {
          const h = (Math.min(aMax, Math.abs(p.accel)) / aMax) * ACC_H;
          if (h < 0.4) return null;
          return (
            <rect
              key={`a${i}`}
              x={x(p.t)}
              y={p.accel >= 0 ? ACC_MID - h : ACC_MID}
              width={barW}
              height={h}
              fill={p.accel >= 0 ? "rgba(126,226,168,0.85)" : "rgba(255,122,122,0.85)"}
            />
          );
        })}
        {chart.moments.map((m, i) => (
          <g key={`m${i}`}>
            <line
              x1={x(m.t)}
              x2={x(m.t)}
              y1={SPEED_TOP}
              y2={ACC_MID + ACC_H}
              stroke={KIND_COLOR[m.kind]}
              strokeWidth="0.7"
              strokeDasharray="1.5 1.5"
            />
            <circle cx={x(m.t)} cy={SPEED_TOP - 5} r="5" fill={KIND_COLOR[m.kind]} />
            <text
              x={x(m.t)}
              y={SPEED_TOP - 3}
              fontSize="6"
              textAnchor="middle"
              fill="#000"
              fontWeight="700"
            >
              {i + 1}
            </text>
          </g>
        ))}
        <text x="0" y={H - 2} fontSize="6.5" fill="rgba(255,255,255,0.5)">
          0:00
        </text>
        <text x={W} y={H - 2} fontSize="6.5" textAnchor="end" fill="rgba(255,255,255,0.5)">
          {formatClock(dur)}
        </text>
      </svg>
      {chart.moments.length ? (
        <ol className="mt-4 space-y-2 text-left">
          {chart.moments.map((m, i) => (
            <li key={`l${i}`} className="flex items-start gap-3 text-xs">
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-black"
                style={{ background: KIND_COLOR[m.kind] }}
              >
                {i + 1}
              </span>
              <span className="text-muted-foreground">
                <span className="text-foreground">{m.label}</span> at {formatClock(m.t)} of the
                drive → {m.effect}
                {m.songSec != null ? ` (song ${formatClock(m.songSec)})` : ""}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {chart.gaps.length ? (
        <p className="mt-3 text-left text-[11px] text-muted-foreground">
          Shaded dashed areas: no motion data was recorded there (screen or browser was paused).
          The song bridges these parts smoothly.
        </p>
      ) : null}
    </div>
  );
}
