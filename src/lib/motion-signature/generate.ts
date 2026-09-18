import type {
  MotionSignatureGeometry,
  MotionSignatureInput,
  MotionSignaturePoint,
  MotionSignatureRibbon,
} from "./types";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unit(seed: number, salt: number): number {
  const x = Math.sin(seed * 0.00013 + salt * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Downsample / normalize energy into a fixed series of control values. */
export function normalizeEnergySeries(
  energy: MotionSignatureInput["energy"],
  count: number,
  seed: number,
): number[] {
  if (!energy || (Array.isArray(energy) && energy.length === 0)) {
    // Synthetic signature from seed alone - still unique per drive seed.
    return Array.from({ length: count }, (_, i) => {
      const a = unit(seed, i + 1);
      const b = unit(seed, i + 17);
      const wave = 0.35 + 0.45 * Math.sin(i * 0.55 + a * Math.PI * 2);
      return Math.max(0.08, Math.min(1, wave * 0.7 + b * 0.35));
    });
  }

  const values: number[] = energy.map((p) => {
    if (typeof p === "number") return Math.max(0, Math.min(1, p));
    return Math.max(0, Math.min(1, (p as MotionSignaturePoint).energy));
  });

  if (values.length === count) return values;
  if (values.length === 1) return Array.from({ length: count }, () => values[0]!);

  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const pos = t * (values.length - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(values.length - 1, i0 + 1);
    const f = pos - i0;
    out.push(values[i0]! * (1 - f) + values[i1]! * f);
  }
  return out;
}

function familyBias(family: MotionSignatureInput["family"], i: number, seed: number): number {
  switch (family) {
    case "engine":
      return 0.15 * Math.sin(i * 1.2 + unit(seed, 3) * 2); // tighter, more periodic
    case "symphony":
      return 0.2 * Math.sin(i * 0.4 + unit(seed, 5)); // longer musical arcs
    case "world":
      return 0.25 * (unit(seed, i + 9) - 0.5); // more orbital wander
    case "fusion":
      return i % 2 === 0 ? 0.12 : -0.12;
    case "brand":
      return 0.08 * Math.sin(i * 0.7);
    default:
      return 0;
  }
}

/**
 * Build Motion Signature SVG path geometry.
 * Curves flow left→right with energy peaks as vertical lifts - like stacked calligraphic strokes.
 */
export function generateMotionSignature(input: MotionSignatureInput): MotionSignatureGeometry {
  const width = input.width ?? 420;
  const height = input.height ?? 520;
  const ribbonCount = Math.max(2, Math.min(5, input.ribbons ?? 3));
  const seed =
    typeof input.seed === "number" ? input.seed >>> 0 : hashSeed(String(input.seed || "elcamoso"));

  const samples = 14;
  const series = normalizeEnergySeries(input.energy, samples, seed);
  const padX = width * 0.06;
  const midY = height * 0.5;
  const amp = height * 0.28;

  const ribbons: MotionSignatureRibbon[] = [];
  const guides: MotionSignatureRibbon[] = [];

  for (let r = 0; r < ribbonCount; r++) {
    const lane = (r - (ribbonCount - 1) / 2) * (height * 0.07);
    const phase = unit(seed, r + 2) * Math.PI * 2;
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const e = series[i]!;
      const bias = familyBias(input.family, i, seed);
      const lift =
        (e - 0.45) * amp * (0.85 + unit(seed, r * 11 + i) * 0.3) +
        Math.sin(t * Math.PI * 2 + phase) * (amp * 0.12) +
        bias * amp;
      const x = padX + t * (width - padX * 2);
      const y = midY + lane - lift;
      points.push({ x, y });
    }

    // Smooth cubic path through points
    let d = `M${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const p3 = points[Math.min(points.length - 1, i + 2)]!;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    ribbons.push({
      d,
      opacity: 0.28 + r * 0.18,
      strokeWidth: 2.2 + (ribbonCount - r) * 0.55,
      accentWeight: r === Math.floor(ribbonCount / 2) ? 1 : r === ribbonCount - 1 ? 0.45 : 0,
    });
  }

  // Soft horizon guides - family shell, not content
  for (let g = 0; g < 2; g++) {
    const y = midY + (g === 0 ? -amp * 0.85 : amp * 0.75);
    const wobble = 8 + unit(seed, 40 + g) * 18;
    guides.push({
      d: `M${padX} ${y} C ${width * 0.35} ${y - wobble}, ${width * 0.65} ${y + wobble}, ${width - padX} ${y}`,
      opacity: 0.08 + g * 0.04,
      strokeWidth: 1.2,
      accentWeight: 0,
    });
  }

  return { width, height, seed, ribbons, guides };
}

/** Privacy-safe downsample of journey energy timeline for OG / Motion Signature. */
export function energySamplesFromTimeline(
  timeline: { t: number; energy: number }[] | undefined,
  maxPoints = 24,
): number[] {
  if (!timeline?.length) return [];
  const values = timeline.map((p) => Math.max(0, Math.min(1, p.energy)));
  if (values.length <= maxPoints) return values;
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * (values.length - 1));
    out.push(values[idx]!);
  }
  return out;
}
