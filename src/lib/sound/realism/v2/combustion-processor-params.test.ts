import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

function loadProcessor() {
  const sourcePath = resolve(process.cwd(), "public/audio/combustion-processor.js");
  const code = readFileSync(sourcePath, "utf8");
  let Processor: new () => {
    process: (
      inputs: unknown[],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>,
    ) => boolean;
    phase: number;
    env: number;
    fireIndex: number;
  };
  const scope = {
    AudioWorkletProcessor: class {
      port = { onmessage: null as ((e: unknown) => void) | null, postMessage() {} };
    },
    sampleRate: 48000,
    registerProcessor: (_name: string, ctor: typeof Processor) => {
      Processor = ctor;
    },
  };
  vm.runInNewContext(code, scope, { filename: sourcePath });
  return new Processor();
}

function render(
  processor: ReturnType<typeof loadProcessor>,
  overrides: Record<string, number>,
  blocks = 40,
) {
  const values = {
    firingHz: 100,
    intensity: 0.4,
    irregularity: 0.1,
    load: 0.3,
    sharpness: 0.45,
    architecture: 0,
    ...overrides,
  };
  const params = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, new Float32Array([v])]),
  );
  const out: number[] = [];
  for (let b = 0; b < blocks; b += 1) {
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    processor.process([], [[left, right]], params);
    for (const x of left) out.push(x);
  }
  return out;
}

function rms(samples: number[]) {
  return Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length);
}

describe("combustion-processor parameter contract", () => {
  it("does not treat zero as the descriptor default for intensity/load/sharpness/firingHz", () => {
    const zeroIntensity = render(loadProcessor(), { intensity: 0 });
    const defaultIntensity = render(loadProcessor(), { intensity: 0.4 });
    const intensityDiff = zeroIntensity.reduce(
      (m, v, i) => Math.max(m, Math.abs(v - defaultIntensity[i]!)),
      0,
    );
    expect(intensityDiff).toBeGreaterThan(1e-4);

    const zeroLoad = render(loadProcessor(), { load: 0 });
    const defaultLoad = render(loadProcessor(), { load: 0.3 });
    const loadDiff = zeroLoad.reduce(
      (m, v, i) => Math.max(m, Math.abs(v - defaultLoad[i]!)),
      0,
    );
    expect(loadDiff).toBeGreaterThan(1e-4);

    const zeroSharp = render(loadProcessor(), { sharpness: 0 });
    const defaultSharp = render(loadProcessor(), { sharpness: 0.45 });
    const sharpDiff = zeroSharp.reduce(
      (m, v, i) => Math.max(m, Math.abs(v - defaultSharp[i]!)),
      0,
    );
    expect(sharpDiff).toBeGreaterThan(1e-4);
  });

  it("schedules no new fires at firingHz 0 while remaining finite", () => {
    const processor = loadProcessor();
    // Prime with activity, then stop firing.
    render(processor, { firingHz: 80, intensity: 1, load: 1 }, 20);
    const fireIndexAfterPrime = processor.fireIndex;
    const envAfterPrime = processor.env;
    expect(envAfterPrime).toBeGreaterThan(0);

    render(processor, { firingHz: 0, intensity: 1, load: 1 }, 80);
    expect(processor.fireIndex).toBe(fireIndexAfterPrime);
    expect(processor.env).toBeLessThan(envAfterPrime);
    const tail = render(loadProcessor(), { firingHz: 0 }, 375);
    expect(tail.every((x) => Number.isFinite(x))).toBe(true);
    expect(rms(tail.slice(-4800))).toBeLessThan(0.02);
  });

  it("falls back for NaN and clamps out-of-range firingHz", () => {
    const a = loadProcessor();
    const b = loadProcessor();
    const nan = render(a, { intensity: Number.NaN });
    const fallback = render(b, { intensity: 0.4 });
    const nanDiff = nan.reduce((m, v, i) => Math.max(m, Math.abs(v - fallback[i]!)), 0);
    expect(nanDiff).toBeLessThan(1e-7);

    const c = loadProcessor();
    const d = loadProcessor();
    const over = render(c, { firingHz: 5000 });
    const clamped = render(d, { firingHz: 2000 });
    const oorDiff = over.reduce((m, v, i) => Math.max(m, Math.abs(v - clamped[i]!)), 0);
    expect(oorDiff).toBeLessThan(1e-7);
  });

  it("accepts architecture code 6 (flat-plane-v8)", () => {
    const processor = loadProcessor();
    const samples = render(processor, { architecture: 6, firingHz: 120 }, 30);
    expect(samples.every((x) => Number.isFinite(x))).toBe(true);
    expect(rms(samples)).toBeGreaterThan(0.01);
  });
});
