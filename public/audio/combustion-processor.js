/**
 * AudioWorkletProcessor: continuous four-stroke combustion excitation.
 * Served from /audio/combustion-processor.js — do not create per-fire OscillatorNodes.
 */
class CombustionExcitationProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.env = 0;
    this.noise = 0;
    this.seed = 1;
  }

  rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return (this.seed & 0xffff) / 0x10000;
  }

  static get parameterDescriptors() {
    return [
      { name: "firingHz", defaultValue: 40, minValue: 0, maxValue: 800, automationRate: "k-rate" },
      { name: "intensity", defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      {
        name: "irregularity",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      { name: "load", defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  process(_inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const ch0 = output[0];
    const ch1 = output[1] || null;
    const firingHz = parameters.firingHz[0] || 40;
    const intensity = parameters.intensity[0] || 0.4;
    const irregularity = parameters.irregularity[0] || 0;
    const load = parameters.load[0] || 0.3;
    const phaseIncBase = firingHz / sampleRate;

    for (let i = 0; i < ch0.length; i += 1) {
      let inc = phaseIncBase;
      if (irregularity > 0.001) {
        inc *= 1 + (this.rand() - 0.5) * irregularity * 0.08;
      }
      this.phase += Math.max(0, inc);
      if (this.phase >= 1) {
        this.phase -= 1;
        const punch = 0.55 + load * 0.45;
        this.env = punch * (0.65 + intensity * 0.35);
        this.noise = (this.rand() * 2 - 1) * (0.35 + load * 0.4);
      }
      this.env *= 0.92 - load * 0.04;
      this.noise = this.noise * 0.97 + (this.rand() * 2 - 1) * 0.03;
      const sample = this.env * (0.72 + this.noise * 0.28) * intensity * 0.55;
      ch0[i] = sample;
      if (ch1) ch1[i] = sample * (0.92 + this.noise * 0.08);
    }
    return true;
  }
}

registerProcessor("elcamoso-combustion-excitation", CombustionExcitationProcessor);
