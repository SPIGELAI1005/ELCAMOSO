/**
 * Node VM diagnostic for public/audio/combustion-processor.js.
 * Stubs AudioWorkletProcessor.port (required after the seed onmessage handler).
 * Not a browser, device, performance, or listening test.
 *
 * Usage: node scripts/diagnose-combustion-worklet-controls.mjs [path]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(__dirname, "../public/audio/combustion-processor.js");
const sourcePath = path.resolve(process.argv[2] ?? defaultPath);
const code = fs.readFileSync(sourcePath, "utf8");

function render(overrides = {}) {
  let Processor;
  const scope = {
    AudioWorkletProcessor: class {
      constructor() {
        this.port = { onmessage: null, postMessage() {} };
      }
    },
    sampleRate: 48000,
    registerProcessor: (_name, ctor) => {
      Processor = ctor;
    },
  };
  vm.runInNewContext(code, scope, { filename: sourcePath });
  const processor = new Processor();
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
  const result = [];
  for (let b = 0; b < 375; b += 1) {
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    processor.process([], [[left, right]], params);
    for (const x of left) {
      if (!Number.isFinite(x)) throw new Error("Non-finite output");
      result.push(x);
    }
  }
  return result;
}

function rms(samples) {
  return Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length);
}

function maxAbsDiff(a, b) {
  return a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
}

const zeroCases = ["firingHz", "intensity", "load", "sharpness"].map((parameter) => {
  const zero = render({ [parameter]: 0 });
  const baseline = render({});
  return {
    parameter,
    zeroEqualsNonZeroBaseline: maxAbsDiff(zero, baseline) < 1e-7,
    maxAbsDiffVsBaseline: maxAbsDiff(zero, baseline),
    rmsAtZero: rms(zero),
    samples: zero.length,
  };
});

const nanCase = (() => {
  const nan = render({ intensity: Number.NaN });
  const fallback = render({ intensity: 0.4 });
  return {
    parameter: "intensity",
    nanEqualsFallbackWithin1eMinus7: maxAbsDiff(nan, fallback) < 1e-7,
    maxAbsoluteDifference: maxAbsDiff(nan, fallback),
  };
});

const oorCase = (() => {
  const high = render({ firingHz: 9999 });
  const clamped = render({ firingHz: 800 });
  return {
    parameter: "firingHz",
    overMaxEqualsClampWithin1eMinus7: maxAbsDiff(high, clamped) < 1e-7,
    maxAbsoluteDifference: maxAbsDiff(high, clamped),
  };
});

const firingZeroSilentNewFires = (() => {
  const samples = render({ firingHz: 0, intensity: 1, load: 1, sharpness: 1 });
  // After DC block settles, zero firing should decay toward silence (no new punches).
  const tail = samples.slice(-4800);
  return {
    parameter: "firingHz",
    tailRms: rms(tail),
    tailQuieterThanFull: rms(tail) < rms(render({ firingHz: 100 })) * 0.5,
  };
});

const report = {
  sampleRate: 48000,
  seconds: 1,
  scope: "current processor; port stubbed for Node VM",
  processorPath: sourcePath,
  zeroMustNotMatchNonZeroBaseline: zeroCases,
  nanUsesDescriptorFallback: nanCase,
  outOfRangeClamped: oorCase,
  zeroFiringHz: firingZeroSilentNewFires,
};

console.log(JSON.stringify(report, null, 2));
