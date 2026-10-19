import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  FLAT_PLANE_V8_TOPOLOGY,
  MUSCLE_V8_TOPOLOGY,
  TOPOLOGY_PILOT_PROFILE_IDS,
  V10_TOPOLOGY,
  combustionTopologyForProfile,
  firesPerCycle,
  validateCombustionTopology,
} from "@/lib/sound/realism/v2/combustion-topology";

function loadProcessor() {
  const sourcePath = resolve(process.cwd(), "public/audio/combustion-processor.js");
  const code = readFileSync(sourcePath, "utf8");
  let Processor: new () => {
    process: (
      inputs: unknown[],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>,
    ) => boolean;
    port: { onmessage: ((e: { data: unknown }) => void) | null };
    fireIndex: number;
    topology: unknown;
    installTopology: (t: unknown) => void;
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

describe("combustion topology presets", () => {
  it("validates muscle and flat-plane pilots", () => {
    expect(validateCombustionTopology(MUSCLE_V8_TOPOLOGY).ok).toBe(true);
    expect(validateCombustionTopology(FLAT_PLANE_V8_TOPOLOGY).ok).toBe(true);
    expect(firesPerCycle(MUSCLE_V8_TOPOLOGY)).toBe(8);
    expect(firesPerCycle(FLAT_PLANE_V8_TOPOLOGY)).toBe(8);
  });

  it("maps pilot profiles and rejects others", () => {
    // All 9 combustion profiles now have topology definitions
    expect(combustionTopologyForProfile("american-muscle-v8")?.cylinderCount).toBe(8);
    // Load-gated broadband floor (less hiss at idle / cruise / coast) on the V8 and the V10.
    expect(combustionTopologyForProfile("american-muscle-v8")?.noiseScale).toBe(0.25);
    expect(combustionTopologyForProfile("racing-v10")?.noiseScale).toBe(0.25);
    for (const [id, ns] of [
      ["race-car", 0.3],
      ["flat-six-sport", 0.3],
      ["turbo-inline-6", 0.35],
      ["rally-car", 0.4],
      ["motorcycle-superbike", 0.35],
    ] as const) {
      expect(combustionTopologyForProfile(id)?.noiseScale).toBe(ns);
    }
    // Recorded GT V8 and the Big Twin keep their full excitation noise (character / rasp).
    expect(combustionTopologyForProfile("gt-v8")?.noiseScale).toBeUndefined();
    expect(combustionTopologyForProfile("big-twin")?.noiseScale).toBeUndefined();
    expect(combustionTopologyForProfile("race-car")?.cylinderCount).toBe(8);
    expect(combustionTopologyForProfile("gt-v8")?.cylinderCount).toBe(8);
    expect(combustionTopologyForProfile("flat-six-sport")?.cylinderCount).toBe(6);
    expect(combustionTopologyForProfile("turbo-inline-6")?.cylinderCount).toBe(6);
    expect(combustionTopologyForProfile("racing-v10")?.cylinderCount).toBe(10);
    expect(combustionTopologyForProfile("rally-car")?.cylinderCount).toBe(3);
    expect(combustionTopologyForProfile("motorcycle-superbike")?.cylinderCount).toBe(4);
    expect(combustionTopologyForProfile("big-twin")?.cylinderCount).toBe(2);
    // Non-combustion profiles return null
    expect(combustionTopologyForProfile("cyber-pulse")).toBeNull();
    expect(combustionTopologyForProfile("space-ship")).toBeNull();
  });

  it("gives muscle cross-plane bank routing distinct from flat-plane alternating collectors", () => {
    const muscle = combustionTopologyForProfile("american-muscle-v8")!;
    const flat = combustionTopologyForProfile("race-car")!;
    const muscleBankPattern = muscle.cylinders
      .slice()
      .sort((a, b) => a.firingAngleDegrees - b.firingAngleDegrees)
      .map((c) => c.collectorId)
      .join("");
    const flatBankPattern = flat.cylinders
      .slice()
      .sort((a, b) => a.firingAngleDegrees - b.firingAngleDegrees)
      .map((c) => c.collectorId)
      .join("");
    expect(muscleBankPattern).toBe("01011010");
    expect(flatBankPattern).toBe("01010101");
    expect(muscleBankPattern).not.toBe(flatBankPattern);
  });

  it("rejects invalid topologies", () => {
    const bad = validateCombustionTopology({
      ...MUSCLE_V8_TOPOLOGY,
      cylinders: MUSCLE_V8_TOPOLOGY.cylinders.map((c, i) =>
        i === 0 ? { ...c, collectorId: 99 } : c,
      ),
    });
    expect(bad.ok).toBe(false);
    expect(bad.issues.some((x) => x.path.includes("collectorId"))).toBe(true);
  });
});

describe("combustion topology worklet scheduling", () => {
  it("fires eight events per 720° cycle at steady RPM", () => {
    const processor = loadProcessor();
    processor.port.onmessage?.({ data: { type: "topology", topology: MUSCLE_V8_TOPOLOGY } });
    expect(processor.topology).toBeTruthy();

    // rpm = 3000 → firingHz = 3000 * 8 / 120 = 200
    // degrees/sample = rpm * 6 / sampleRate = 3000 * 6 / 48000 = 0.375
    // samples per 720° cycle = 720 / 0.375 = 1920
    const firingHz = 200;
    const params = {
      firingHz: new Float32Array([firingHz]),
      intensity: new Float32Array([0.4]),
      irregularity: new Float32Array([0]),
      load: new Float32Array([0.3]),
      sharpness: new Float32Array([0.45]),
      architecture: new Float32Array([1]),
    };
    const start = processor.fireIndex;
    const samplesNeeded = 1920;
    const blocks = Math.ceil(samplesNeeded / 128);
    for (let b = 0; b < blocks; b += 1) {
      const left = new Float32Array(128);
      const right = new Float32Array(128);
      processor.process([], [[left, right]], params);
    }
    const fires = (processor.fireIndex - start + 0x10000) % 0x10000;
    expect(fires).toBe(8);
  });

  it("does not duplicate fires when phase wraps", () => {
    const processor = loadProcessor();
    // Exact fire counting: without the organic crank jitter (it moves fires by design).
    const steady = { ...FLAT_PLANE_V8_TOPOLOGY, organic: undefined };
    processor.port.onmessage?.({ data: { type: "topology", topology: steady } });
    const firingHz = 200;
    const params = {
      firingHz: new Float32Array([firingHz]),
      intensity: new Float32Array([0.5]),
      irregularity: new Float32Array([0]),
      load: new Float32Array([0.4]),
      sharpness: new Float32Array([0.5]),
      architecture: new Float32Array([6]),
    };
    const start = processor.fireIndex;
    // Two full cycles
    for (let b = 0; b < Math.ceil(3840 / 128); b += 1) {
      processor.process([], [[new Float32Array(128), new Float32Array(128)]], params);
    }
    const fires = (processor.fireIndex - start + 0x10000) % 0x10000;
    expect(fires).toBe(16);
  });

  it("schedules no new fires at firingHz 0 with topology installed", () => {
    const processor = loadProcessor();
    processor.port.onmessage?.({ data: { type: "topology", topology: MUSCLE_V8_TOPOLOGY } });
    const params = {
      firingHz: new Float32Array([0]),
      intensity: new Float32Array([1]),
      irregularity: new Float32Array([0]),
      load: new Float32Array([1]),
      sharpness: new Float32Array([1]),
      architecture: new Float32Array([1]),
    };
    const start = processor.fireIndex;
    for (let b = 0; b < 40; b += 1) {
      processor.process([], [[new Float32Array(128), new Float32Array(128)]], params);
    }
    expect(processor.fireIndex).toBe(start);
  });
});

describe("V10 bank asymmetry + rasp (Racing V10 voicing)", () => {
  it("keeps rasp only on the V10s and validates it", () => {
    const v10 = combustionTopologyForProfile("racing-v10");
    expect(v10?.rasp).toMatchObject({ startRpm: 5000, fullRpm: 8500, lowHz: 1000, highHz: 3000 });
    expect(combustionTopologyForProfile("f1-v10")?.rasp?.startRpm).toBeGreaterThan(10000);
    expect(combustionTopologyForProfile("f1-v10")?.pulseTauScale).toBeLessThan(0.5);
    for (const id of TOPOLOGY_PILOT_PROFILE_IDS) {
      if (id === "racing-v10" || id === "f1-v10") continue;
      expect(combustionTopologyForProfile(id)?.pulseTauScale).toBeUndefined();
      expect(combustionTopologyForProfile(id)?.rasp).toBeUndefined();
    }
    const bad = validateCombustionTopology({
      ...V10_TOPOLOGY,
      rasp: { level: 1, startRpm: 5, fullRpm: 1, lowHz: 1, highHz: 2 },
    });
    expect(bad.ok).toBe(true);
    expect(bad.topology?.rasp).toBeUndefined();
  });

  it("gives the two V10 banks different pulse weight and primary length", () => {
    const banks = new Set(V10_TOPOLOGY.cylinders.map((c) => `${c.collectorId}:${c.primaryLengthMetres}`));
    expect(banks.size).toBe(2);
    const mean = (id: number) => {
      const ws = V10_TOPOLOGY.cylinders.filter((c) => c.collectorId === id).map((c) => c.pulseWeight);
      return ws.reduce((a, b) => a + b, 0) / ws.length;
    };
    expect(mean(0)).toBeGreaterThan(mean(1));
    // Small cylinder-to-cylinder spread (±5%) - no two cylinders burn identically.
    expect(new Set(V10_TOPOLOGY.cylinders.map((c) => c.pulseWeight)).size).toBeGreaterThan(5);
  });
});

describe("V10 organic layer (alive idle, less synthetic F1)", () => {
  it("is only on the V10s, petrol cars and superbike and survives validation", () => {
    const withOrganic = ["racing-v10", "f1-v10", "race-car", "flat-six-sport", "turbo-inline-6", "rally-car", "motorcycle-superbike"];
    for (const id of TOPOLOGY_PILOT_PROFILE_IDS) {
      const t = combustionTopologyForProfile(id);
      if (withOrganic.includes(id)) {
        expect(t?.organic?.crankJitter).toBeGreaterThan(0);
        // No valvetrain ticks: their sparse 3 kHz clicks read as stones/crackle at idle.
        expect(t?.organic?.valvetrain).toBeUndefined();
        expect(t?.cycleLope).toBeGreaterThan(0);
      } else {
        expect(t?.organic).toBeUndefined();
      }
    }
    expect(combustionTopologyForProfile("f1-v10")?.organic?.bankAm).toBeGreaterThan(0);
    // Bank modulation is high-rpm only (at idle it pulsed the noise into a crackle).
    expect(combustionTopologyForProfile("f1-v10")?.organic?.bankAmStartRpm).toBeGreaterThan(4500);
    expect(combustionTopologyForProfile("f1-v10")?.organic?.intakeRoar?.level).toBeGreaterThan(0);
    expect(validateCombustionTopology(V10_TOPOLOGY).topology?.organic).toEqual(V10_TOPOLOGY.organic);
  });
});
