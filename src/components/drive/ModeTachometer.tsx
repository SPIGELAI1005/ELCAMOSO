import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  introNeedle,
  tachScaleLabels,
  TACH_THEMES,
  type TachThemeId,
} from "@/lib/drive/tach-theme";
import { cn } from "@/lib/utils";
import { RaceDash, type RaceDashReadout } from "@/components/drive/RaceDash";

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  if (a1 - a0 >= 359.9) {
    // Full circle: two half arcs.
    const p = polar(cx, cy, r, a0);
    const q = polar(cx, cy, r, a0 + 180);
    return `M ${p.x} ${p.y} A ${r} ${r} 0 1 1 ${q.x} ${q.y} A ${r} ${r} 0 1 1 ${p.x} ${p.y}`;
  }
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${a1 - a0 <= 180 ? 0 : 1} 1 ${e.x} ${e.y}`;
}

export interface ModeTachometerProps {
  themeId: TachThemeId;
  /** Changing this replays the intro (mode switch). */
  introKey: string;
  progress: number;
  reducedMotion: boolean;
  /** Redline rpm, labels the dial in thousands when the theme uses rpm. */
  redlineRpm?: number | null;
  showZone?: boolean;
  size?: number;
  className?: string;
  /** Race theme only: readouts drawn inside the race dash. */
  raceReadout?: RaceDashReadout | null;
}

/** Themed SVG tachometer with an intro sweep (needle to redline and back). */
export const ModeTachometer = memo(function ModeTachometer({
  themeId,
  introKey,
  progress,
  reducedMotion,
  redlineRpm = null,
  showZone = true,
  size = 300,
  className,
  raceReadout = null,
}: ModeTachometerProps) {
  const theme = TACH_THEMES[themeId];
  const pad = 30;
  const vb = size + pad * 2;
  const cx = vb / 2;
  const cy = vb / 2;
  const r = size / 2 - 2;
  const target = Math.min(1, Math.max(0, progress));
  const [visual, setVisual] = useState(reducedMotion ? target : 0);
  const [intro, setIntro] = useState(!reducedMotion);
  const targetRef = useRef(target);
  targetRef.current = target;
  const raf = useRef(0);

  // Intro: sweep to redline and back, then hand over to live smoothing.
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (reducedMotion) {
      setIntro(false);
      setVisual(targetRef.current);
      return;
    }
    setIntro(true);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = (now - t0) / theme.introMs;
      if (t >= 1) {
        setVisual(targetRef.current);
        setIntro(false);
        return;
      }
      setVisual(introNeedle(t, targetRef.current));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [introKey, themeId, reducedMotion, theme.introMs]);

  // Live smoothing after the intro.
  useEffect(() => {
    if (intro) return;
    if (reducedMotion) {
      setVisual(target);
      return;
    }
    const tick = () => {
      setVisual((prev) => {
        const next = prev + (target - prev) * 0.12;
        if (Math.abs(next - target) < 0.002) return target;
        raf.current = requestAnimationFrame(tick);
        return next;
      });
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, intro, reducedMotion]);

  const v = Math.min(1, Math.max(0, visual));
  const { start, sweep } = theme;
  const end = start + sweep;
  const angle = start + sweep * v;
  const zoneOn = showZone && theme.zoneStart != null;
  const zoneDeg = start + sweep * (theme.zoneStart ?? 1);
  const inZone = zoneOn && v >= (theme.zoneStart ?? 2);
  const gid = `tg-${themeId}`;
  const labels = useMemo(() => tachScaleLabels(theme, redlineRpm), [theme, redlineRpm]);

  const ticks = useMemo(() => {
    if (theme.ticks === "none") return null;
    const n = theme.majorTicks * theme.minorPerMajor;
    const out: { a: number; major: boolean; f: number }[] = [];
    const closed = sweep >= 359.9;
    for (let i = 0; i <= (closed ? n - 1 : n); i++) {
      const f = i / n;
      out.push({ a: start + sweep * f, major: i % theme.minorPerMajor === 0, f });
    }
    return out;
  }, [theme, start, sweep]);

  const needleTip = polar(cx, cy, r + 8, angle);
  const needleBase = polar(cx, cy, r - (theme.decor === "airspeed" ? 60 : 26), angle);
  const fillColor = inZone ? theme.zoneColor : `url(#${gid})`;

  if (themeId === "race") {
    return (
      <RaceDash
        v={v}
        zoneStart={theme.zoneStart ?? 0.78}
        redlineRpm={redlineRpm}
        readout={raceReadout}
        intro={intro}
        reducedMotion={reducedMotion}
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      className={cn(
        "mode-tach pointer-events-none absolute inset-[-12%] h-[124%] w-[124%] overflow-hidden",
        intro && "mode-tach--intro",
        className,
      )}
      data-tach-theme={themeId}
      data-intro={intro ? "1" : "0"}
      aria-hidden="true"
      overflow="hidden"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={theme.accent2} />
          <stop offset="100%" stopColor={theme.accent} />
        </linearGradient>
        <radialGradient id={`${gid}-bg`}>
          <stop offset="60%" stopColor={theme.accent} stopOpacity="0" />
          <stop offset="100%" stopColor={theme.accent} stopOpacity={0.08 * theme.glow} />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={r + 14} fill={`url(#${gid}-bg)`} className="mode-tach__fade" />

      {theme.decor === "bezel" ? (
        <g className="mode-tach__fade">
          <circle
            cx={cx}
            cy={cy}
            r={r + 16}
            fill="none"
            stroke={theme.accent2}
            strokeOpacity={0.35}
            strokeWidth={1}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r + 19}
            fill="none"
            stroke={theme.accent2}
            strokeOpacity={0.12}
            strokeWidth={3}
          />
        </g>
      ) : null}

      {theme.decor === "compass" ? (
        <g className="mode-tach__fade">
          <circle
            cx={cx}
            cy={cy}
            r={r + 16}
            fill="none"
            stroke={theme.accent2}
            strokeOpacity={0.4}
            strokeWidth={1}
            strokeDasharray="2 6"
          />
          {[0, 90, 180, 270].map((a) => {
            const p1 = polar(cx, cy, r - 30, a - 90);
            const p2 = polar(cx, cy, r - 14, a - 90 - 6);
            const p3 = polar(cx, cy, r - 14, a - 90 + 6);
            return (
              <path
                key={a}
                d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z`}
                fill={theme.accent2}
                fillOpacity={a === 0 ? 0.9 : 0.35}
              />
            );
          })}
          {labels.map((l, i) => {
            const p = polar(cx, cy, r + 24, i * 90 - 90);
            return (
              <text
                key={l}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                letterSpacing={2}
                fill={i === 0 ? theme.accent2 : "oklch(1 0 0 / 55%)"}
              >
                {l}
              </text>
            );
          })}
        </g>
      ) : null}

      {theme.decor === "airspeed" ? (
        <g className="mode-tach__fade">
          {/* White (flap), green (normal), yellow (caution) bands like an ASI. */}
          <path
            d={arcPath(cx, cy, r - 8, start + sweep * 0.08, start + sweep * 0.45)}
            fill="none"
            stroke="#f8fafc"
            strokeOpacity={0.5}
            strokeWidth={4}
          />
          <path
            d={arcPath(cx, cy, r - 3, start + sweep * 0.15, start + sweep * 0.72)}
            fill="none"
            stroke="#22c55e"
            strokeOpacity={0.7}
            strokeWidth={4}
          />
          <path
            d={arcPath(cx, cy, r - 3, start + sweep * 0.72, start + sweep * 0.88)}
            fill="none"
            stroke="#facc15"
            strokeOpacity={0.7}
            strokeWidth={4}
          />
          <text
            x={cx}
            y={cy - r * 0.55}
            textAnchor="middle"
            fontSize={10}
            letterSpacing={3}
            fill="oklch(1 0 0 / 50%)"
          >
            AIRSPEED · KT
          </text>
        </g>
      ) : null}

      {theme.decor === "rail" ? (
        <g className="mode-tach__fade">
          <circle
            cx={cx}
            cy={cy}
            r={r + 16}
            fill="none"
            stroke={theme.accent2}
            strokeOpacity={0.55}
            strokeWidth={2}
          />
          {Array.from({ length: 12 }, (_, i) => {
            const p = polar(cx, cy, r + 16, i * 30 + 15);
            return (
              <circle key={i} cx={p.x} cy={p.y} r={2.2} fill={theme.accent2} fillOpacity={0.8} />
            );
          })}
          <text
            x={cx}
            y={cy + r * 0.62}
            textAnchor="middle"
            fontSize={9}
            letterSpacing={3}
            fill={theme.accent2}
            fillOpacity={0.8}
          >
            STEAM · PSI
          </text>
        </g>
      ) : null}

      {theme.decor === "hud" ? (
        <g className="mode-tach__fade mode-tach__spin">
          <circle
            cx={cx}
            cy={cy}
            r={r + 12}
            fill="none"
            stroke={theme.accent2}
            strokeOpacity={0.35}
            strokeWidth={1}
            strokeDasharray="1 9"
          />
          <path
            d={arcPath(cx, cy, r + 18, 200, 250)}
            fill="none"
            stroke={theme.accent2}
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
          <path
            d={arcPath(cx, cy, r + 18, 20, 70)}
            fill="none"
            stroke={theme.accent}
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
        </g>
      ) : null}

      {theme.decor === "flame" ? (
        <g className="mode-tach__fade">
          {Array.from({ length: 7 }, (_, i) => {
            const a = start + sweep * (0.85 + i * 0.022);
            const p1 = polar(cx, cy, r + 10, a);
            const p2 = polar(cx, cy, Math.min(r + 27, r + 16 + v * 10 * ((i % 3) + 1) * 0.5), a);
            return (
              <line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={i % 2 ? theme.accent2 : theme.zoneColor}
                strokeOpacity={0.35 + v * 0.6}
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ) : null}

      {/* Track */}
      <path
        d={arcPath(cx, cy, r, start, end)}
        fill="none"
        stroke={theme.track}
        strokeWidth={theme.ticks === "segments" ? 10 : 2.5}
        strokeLinecap={sweep >= 359.9 ? "butt" : "round"}
        className="mode-tach__draw"
        pathLength={1}
      />
      {zoneOn ? (
        <path
          d={arcPath(cx, cy, r, zoneDeg, end)}
          fill="none"
          stroke={theme.zoneColor}
          strokeOpacity={0.3}
          strokeWidth={theme.ticks === "segments" ? 10 : 2.5}
          className="mode-tach__draw"
          pathLength={1}
        />
      ) : null}

      {/* Ticks / segments */}
      {ticks ? (
        <g>
          {ticks.map(({ a, major, f }, i) => {
            const lit = f <= v + 1e-6;
            const zone = zoneOn && f >= (theme.zoneStart ?? 2);
            if (theme.ticks === "segments") {
              const span = (sweep / ticks.length) * 0.62;
              return (
                <path
                  key={i}
                  d={arcPath(cx, cy, r, a - span / 2, a + span / 2)}
                  fill="none"
                  stroke={zone ? theme.zoneColor : lit ? theme.accent : "oklch(1 0 0 / 10%)"}
                  strokeOpacity={lit ? 1 : zone ? 0.35 : 1}
                  strokeWidth={10}
                />
              );
            }
            if (theme.ticks === "dots") {
              const p = polar(cx, cy, r - 12, a);
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={lit ? 2.4 : 1.4}
                  fill={zone ? theme.zoneColor : lit ? theme.accent : "oklch(1 0 0 / 22%)"}
                />
              );
            }
            const p1 = polar(cx, cy, r - (major ? 14 : 8), a);
            const p2 = polar(cx, cy, r - 4, a);
            return (
              <line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={zone ? theme.zoneColor : "oklch(1 0 0 / 70%)"}
                strokeOpacity={major ? 0.85 : 0.35}
                strokeWidth={major ? 1.6 : 1}
              />
            );
          })}
        </g>
      ) : null}

      {/* Rpm numerals (thousands) for gearbox themes. */}
      {labels.length > 1 &&
      theme.decor !== "compass" &&
      theme.decor !== "hud" &&
      (themeId === "classic" ||
        themeId === "touring" ||
        themeId === "sport" ||
        themeId === "city") ? (
        <g className="mode-tach__fade">
          {labels.map((l, i) => {
            const p = polar(cx, cy, r - 28, start + (sweep * i) / (labels.length - 1));
            return (
              <text
                key={i}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill="oklch(1 0 0 / 55%)"
                className="tabular-nums"
              >
                {l}
              </text>
            );
          })}
        </g>
      ) : null}
      {theme.decor === "hud" ? (
        <g className="mode-tach__fade">
          {labels.map((l, i) => {
            const p = polar(cx, cy, r + 25, start + (sweep * i) / (labels.length - 1));
            return (
              <text
                key={l}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                letterSpacing={1}
                fill={theme.accent2}
                fillOpacity={0.75}
              >
                {l}
              </text>
            );
          })}
        </g>
      ) : null}

      {/* Value fill: glow underlay + crisp line (no SVG filters: cheap on Tesla). */}
      {theme.ticks !== "segments" && v > 0.002 ? (
        <>
          <path
            d={arcPath(cx, cy, r, start, angle)}
            fill="none"
            stroke={fillColor}
            strokeOpacity={0.18 * theme.glow + 0.05}
            strokeWidth={12}
            strokeLinecap="round"
          />
          <path
            d={arcPath(cx, cy, r, start, angle)}
            fill="none"
            stroke={fillColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </>
      ) : null}

      {/* Needle tip */}
      <line
        x1={needleBase.x}
        y1={needleBase.y}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke={inZone ? theme.zoneColor : theme.accent}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle
        cx={needleTip.x}
        cy={needleTip.y}
        r={4 + theme.glow * 4}
        fill={inZone ? theme.zoneColor : theme.accent}
        fillOpacity={0.25}
      />

      {/* Shift lights (Sport / Race) */}
      {theme.shiftLights ? (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const thresh = 0.6 + i * 0.045;
            const on = v >= thresh;
            const col = i < 3 ? "#22c55e" : i < 6 ? theme.accent2 : theme.zoneColor;
            const flash = v >= 0.98;
            return (
              <circle
                key={i}
                cx={cx - 56 + i * 14}
                cy={11}
                r={3.8}
                fill={on ? col : "oklch(1 0 0 / 10%)"}
                className={flash && !reducedMotion ? "mode-tach__flash" : undefined}
              />
            );
          })}
        </g>
      ) : null}
    </svg>
  );
});
