/**
 * AudioWorkletProcessor: continuous four-stroke combustion excitation (Realism V2.1).
 * Served from /audio/combustion-processor.js — never spawn per-fire OscillatorNodes.
 *
 * Impulse train at firingHz = RPM × cylinders / 120 (four-stroke).
 * Architecture shapes bank balance / lope; load shapes pressure and brightness.
 */
class CombustionExcitationProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.bank = 0;
    this.env = 0;
    this.bright = 0;
    this.noise = 0;
    this.seed = 1;
    this.fireIndex = 0;
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
      {
        name: "sharpness",
        defaultValue: 0.45,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      /**
       * 0 even · 1 lope · 2 flat · 3 cross-plane refined · 4 v-twin · 5 single
       */
      {
        name: "architecture",
        defaultValue: 0,
        minValue: 0,
        maxValue: 5,
        automationRate: "k-rate",
      },
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
    const sharpness = parameters.sharpness[0] || 0.45;
    const arch = Math.round(parameters.architecture[0] || 0);
    const phaseIncBase = firingHz / sampleRate;

    // Decay: sharper under high load (pressure pulse), softer at cruise.
    const decay = 0.88 - sharpness * 0.08 - load * 0.05;
    const brightDecay = 0.82 - sharpness * 0.1;

    for (let i = 0; i < ch0.length; i += 1) {
      let inc = phaseIncBase;
      if (irregularity > 0.001) {
        inc *= 1 + (this.rand() - 0.5) * irregularity * 0.12;
      }
      // V-twin / lope stretch alternate intervals
      if (arch === 1 || arch === 4) {
        const odd = this.fireIndex & 1;
        inc *= odd ? 1 + irregularity * 0.08 : 1 - irregularity * 0.05;
      }

      this.phase += Math.max(0, inc);
      if (this.phase >= 1) {
        this.phase -= 1;
        this.fireIndex = (this.fireIndex + 1) & 0xffff;
        this.bank = 1 - this.bank;

        let punch = 0.5 + load * 0.5;
        // Architecture-specific impulse balance
        if (arch === 1) {
          // American lope: strong/weak alternate
          punch *= this.fireIndex & 1 ? 1.18 : 0.72;
        } else if (arch === 2) {
          // Flat-six: even overlapping banks
          punch *= 0.92 + this.bank * 0.08;
        } else if (arch === 3) {
          // GT cross-plane: dense, refined
          punch *= 0.95 + (this.fireIndex % 4 === 0 ? 0.08 : 0);
        } else if (arch === 4) {
          punch *= this.fireIndex & 1 ? 1.25 : 0.55;
        } else if (arch === 5) {
          punch *= 1.15;
        }

        this.env = punch * (0.55 + intensity * 0.45);
        this.bright = punch * sharpness * (0.35 + load * 0.65);
        this.noise = (this.rand() * 2 - 1) * (0.25 + load * 0.55 * sharpness);
      }

      this.env *= decay;
      this.bright *= brightDecay;
      this.noise = this.noise * 0.94 + (this.rand() * 2 - 1) * 0.04 * (0.2 + load);

      // Pressure impulse + load-bright grit (not a clean oscillator sample)
      const body = this.env * (0.78 + this.noise * 0.22);
      const edge = this.bright * this.noise * 0.35;
      const sample = (body + edge) * intensity * 0.58;

      ch0[i] = sample;
      if (ch1) {
        // Slight bank L/R imbalance for V / flat characters
        const pan = arch === 2 || arch === 3 || arch === 1 ? 0.06 * (this.bank * 2 - 1) : 0;
        ch1[i] = sample * (1 - pan);
      }
    }
    return true;
  }
}

registerProcessor("elcamoso-combustion-excitation", CombustionExcitationProcessor);
