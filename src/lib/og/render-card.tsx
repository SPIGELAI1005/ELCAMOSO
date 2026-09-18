/** @jsxImportSource react */
/* eslint-disable react-refresh/only-export-components -- Satori layout helpers, not Fast Refresh UI */
import type { OgCardData, OgCardVariant } from "./types";
import { MARK_PATHS, OG_PALETTE, OG_SAFE, OG_SIZE } from "./palette";
import { generateMotionSignature } from "@/lib/motion-signature";
import { SOCIAL_CARD_TEMPLATES, stableSeed } from "./templates";

function MarkVisual({ accent, scale = 1 }: { accent: string; scale?: number }) {
  const w = 92 * scale;
  const h = 72 * scale;
  return (
    <svg width={w} height={h} viewBox="0 0 92 72" fill="none">
      <circle
        cx={MARK_PATHS.circle.cx}
        cy={MARK_PATHS.circle.cy}
        r={MARK_PATHS.circle.r}
        stroke={OG_PALETTE.fg}
        strokeWidth="3.4"
      />
      {MARK_PATHS.waves.map((d, i) => (
        <path
          key={d}
          d={d}
          stroke={i === 1 ? accent : OG_PALETTE.fg}
          strokeWidth={3.2 - i * 0.2}
          strokeOpacity={0.35 + i * 0.22}
          fill="none"
        />
      ))}
    </svg>
  );
}

function familyForVariant(
  variant: OgCardVariant,
): "brand" | "engine" | "symphony" | "world" | "fusion" | "drive-song" {
  if (variant === "journey" || variant === "pricing") return "brand";
  return variant;
}

/** Right-panel Motion Signature - shared family language; Drive Song uses denser ribbons. */
function MotionSignaturePanel({
  data,
  seed,
  accent,
}: {
  data: OgCardData;
  seed: number;
  accent: string;
}) {
  const isDriveSong = data.variant === "drive-song";
  const geo = generateMotionSignature({
    seed,
    ...(data.energySamples ? { energy: data.energySamples } : {}),
    ribbons: isDriveSong ? 4 : 3,
    width: 400,
    height: isDriveSong ? 500 : 460,
    family: familyForVariant(data.variant),
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
      }}
    >
      <svg width={geo.width} height={geo.height} viewBox={`0 0 ${geo.width} ${geo.height}`}>
        {geo.guides.map((g, i) => (
          <path
            key={`g-${i}`}
            d={g.d}
            stroke={OG_PALETTE.fg}
            strokeWidth={g.strokeWidth}
            strokeOpacity={g.opacity}
            fill="none"
          />
        ))}
        {geo.ribbons.map((r, i) => (
          <path
            key={`r-${i}`}
            d={r.d}
            stroke={r.accentWeight > 0.3 ? accent : OG_PALETTE.fg}
            strokeWidth={r.strokeWidth}
            strokeOpacity={r.opacity}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </svg>
      {isDriveSong ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            letterSpacing: 4,
            color: OG_PALETTE.faint,
            fontFamily: "Outfit",
          }}
        >
          MOTION SIGNATURE
        </div>
      ) : null}
      <div style={{ marginTop: isDriveSong ? 16 : 28, display: "flex" }}>
        <MarkVisual accent={accent} scale={isDriveSong ? 0.7 : 0.85} />
      </div>
    </div>
  );
}

/**
 * Six-card family layout - one composition language for brand → Drive Song.
 */
export function renderOgCardElement(data: OgCardData) {
  const tpl = SOCIAL_CARD_TEMPLATES[data.variant];
  const accent = data.accent || tpl.accent;
  const seed = stableSeed(data.variant, data.imageSeed);
  const titleLines = data.title.split("\n");
  const isDriveSong = data.variant === "drive-song";

  // Drive Song: song title as hero subtitle, archetype as footer
  const metaLine = data.subtitle;
  const footLine = data.footer || (data.variant === "brand" ? "" : data.experienceName) || "";

  return (
    <div
      style={{
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: "flex",
        background: OG_PALETTE.bg,
        color: OG_PALETTE.fg,
        fontFamily: "Outfit",
        position: "relative",
      }}
    >
      {/* subtle left edge hairline - family shell */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: accent,
          opacity: 0.35,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "58%",
          paddingLeft: OG_SAFE.padX,
          paddingTop: OG_SAFE.padY,
          paddingBottom: OG_SAFE.padY,
          paddingRight: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <MarkVisual accent={accent} scale={0.42} />
          <div
            style={{
              fontSize: 18,
              letterSpacing: 7,
              color: OG_PALETTE.muted,
              fontWeight: 400,
            }}
          >
            ELCAMOSO
          </div>
        </div>

        <div
          style={{
            fontSize: 17,
            letterSpacing: 5.5,
            color: accent,
            marginBottom: 20,
            fontWeight: 400,
          }}
        >
          {data.eyebrow}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {titleLines.map((line, idx) => (
            <div
              key={`${idx}-${line}`}
              style={{
                fontSize: titleLines.length > 2 ? 60 : isDriveSong ? 72 : 76,
                fontWeight: 300,
                lineHeight: 1.04,
                letterSpacing: -1.8,
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {metaLine ? (
          <div
            style={{
              marginTop: 26,
              fontSize: isDriveSong ? 32 : 26,
              fontWeight: 300,
              color: isDriveSong ? OG_PALETTE.fg : OG_PALETTE.muted,
              maxWidth: 520,
              lineHeight: 1.25,
              letterSpacing: isDriveSong ? 1 : 0,
            }}
          >
            {metaLine}
          </div>
        ) : null}

        {isDriveSong && data.archetype ? (
          <div
            style={{
              marginTop: 14,
              fontSize: 22,
              fontWeight: 300,
              color: OG_PALETTE.muted,
              letterSpacing: 1,
            }}
          >
            {data.archetype}
          </div>
        ) : null}

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: 3.5,
              color: OG_PALETTE.muted,
              maxWidth: 420,
            }}
          >
            {footLine || "elcamoso.com"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: "42%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          paddingRight: OG_SAFE.padX - 10,
          paddingTop: OG_SAFE.padY,
          paddingBottom: OG_SAFE.padY,
          borderLeft: `1px solid ${OG_PALETTE.faint}`,
        }}
      >
        <MotionSignaturePanel data={data} seed={seed} accent={accent} />
      </div>
    </div>
  );
}
