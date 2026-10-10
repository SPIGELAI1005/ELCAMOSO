/**
 * AudioWorkletProcessor: continuous four-stroke combustion excitation (Realism V2.2).
 * Served from /audio/combustion-processor.js - never spawn per-fire OscillatorNodes.
 *
 * Impulse train at firingHz = RPM × cylinders / 120 (four-stroke).
 * Architecture shapes bank balance / lope; load shapes pressure and brightness.
 *
 * V2.2 de-synth pass:
 * - every combustion event carries its own amplitude and timing jitter at all RPM
 *   (real engines keep 2-5 % cycle-to-cycle variation; a jitter-free train reads as a buzzer),
 * - each fire launches a short band-limited noise burst (gas rush / valve edge),
 * - a slow 0.5-2 Hz wander on the pressure body so cruise never freezes into one tone.
 */
class CombustionExcitationProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.bank = 0;
    this.env = 0;
    this.bright = 0;
    this.burst = 0;
    this.grit = 0;
    this.noiseLp = 0;
    this.noiseDc = 0;
    this.seed = 1;
    this.fireIndex = 0;
    this.intervalScale = 1;
    this.previousRaw = 0;
    this.dcBlocked = 0;
    this.wanderPhase = 0;
    this.wanderRate = 0.9;
    this.wanderDepth = 0.04;
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

    // Sample-rate-aware pressure tails. Fixed per-sample values around 0.8
    // die in a fraction of a millisecond and turn cadence into pitched clicks.
    const bodyTauSeconds = 0.0045 + (1 - sharpness) * 0.004 + load * 0.0015;
    const edgeTauSeconds = 0.0012 + (1 - sharpness) * 0.0013;
    const burstTauSeconds = 0.0022 + (1 - sharpness) * 0.0018 + load * 0.0008;
    const decay = Math.exp(-1 / (sampleRate * bodyTauSeconds));
    const brightDecay = Math.exp(-1 / (sampleRate * edgeTauSeconds));
    const burstDecay = Math.exp(-1 / (sampleRate * burstTauSeconds));

    // Per-fire noise burst band: opens with load and sharpness (gas rush, not hiss).
    const burstLpHz = 900 + load * 2600 + sharpness * 1400;
    const burstHpHz = 140 + load * 120;
    const lpCoef = 1 - Math.exp((-2 * Math.PI * burstLpHz) / sampleRate);
    const hpCoef = 1 - Math.exp((-2 * Math.PI * burstHpHz) / sampleRate);

    // Light-load combustion is the least repeatable - amplitude spread grows as load drops.
    const ampSpread = 0.06 + (1 - load) * 0.1 + irregularity * 0.45;
    // Impulse excitation gets quieter as the firing rate drops (fewer events per
    // second). Real idle is not silent in the cabin, so partially compensate the
    // per-event energy for rate; the formant chain still adds RPM / load energy.
    const rateComp = Math.min(2, Math.max(0.6, Math.pow(100 / Math.max(20, firingHz), 0.35)));
    const timeSpread = 0.012 + irregularity * 0.12;
    const wanderInc = (this.wanderRate * 2 * Math.PI) / sampleRate;

    for (let i = 0; i < ch0.length; i += 1) {
      let inc = phaseIncBase * this.intervalScale;
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
        // Next interval carries its own timing error (per cycle, not per sample).
        this.intervalScale = 1 + (this.rand() - 0.5) * timeSpread;

        // Load shapes pressure, but the engine never drops out at cruise: the
        // downstream formants and order resonators add their own load contrast,
        // so the excitation keeps its loudness range modest (~6 dB here).
        let punch = 0.7 + load * 0.3;
        // Architecture-specific impulse balance
        if (arch === 1) {
          // American lope: strong/weak alternate
          punch *= this.fireIndex & 1 ? 1.18 : 0.72;
        } else if (arch === 2) {
          // Flat-six: even overlapping banks
          punch *= 0.92 + this.bank * 0.08;
        } else if (arch === 3) {
          // GT cross-plane: dense, refined, with the 4-event bank pattern
          punch *= 0.95 + (this.fireIndex % 4 === 0 ? 0.08 : 0);
        } else if (arch === 4) {
          punch *= this.fireIndex & 1 ? 1.25 : 0.55;
        } else if (arch === 5) {
          punch *= 1.15;
        }
        // Cycle-to-cycle combustion variability at every RPM.
        punch *= (1 + (this.rand() - 0.5) * ampSpread) * rateComp;

        // Closely spaced cylinder events overlap into one engine body.
        this.env = Math.min(2.4, this.env + punch * (0.6 + intensity * 0.2));
        this.bright = Math.min(1.5, this.bright + punch * sharpness * (0.18 + load * 0.42));
        this.burst = Math.min(
          1.6,
          this.burst + punch * (0.3 + load * 0.5) * (0.45 + sharpness * 0.55),
        );
        this.grit = (this.rand() * 2 - 1) * (0.25 + load * 0.55 * sharpness);
      }

      this.env *= decay;
      this.bright *= brightDecay;
      this.burst *= burstDecay;
      this.grit = this.grit * 0.94 + (this.rand() * 2 - 1) * 0.04 * (0.2 + load);

      // Band-limited noise for the per-fire burst (one-pole LP then DC-tracking HP).
      const white = this.rand() * 2 - 1;
      this.noiseLp += (white - this.noiseLp) * lpCoef;
      this.noiseDc += (this.noiseLp - this.noiseDc) * hpCoef;
      const band = this.noiseLp - this.noiseDc;

      // Slow body wander so steady cruise is never a frozen waveform.
      this.wanderPhase += wanderInc;
      if (this.wanderPhase > 2 * Math.PI) {
        this.wanderPhase -= 2 * Math.PI;
        this.wanderRate = 0.5 + this.rand() * 1.5;
        this.wanderDepth = 0.025 + this.rand() * 0.035;
      }
      const wander = 1 + Math.sin(this.wanderPhase) * this.wanderDepth;

      // Pressure impulse + load-bright grit + gas burst (not a clean oscillator sample)
      const body = this.env * (0.76 + this.grit * 0.16) * wander;
      const edge = this.bright * this.grit * 0.22;
      const rush = this.burst * band * 0.6;
      // Intensity steers timbre (punch, brightness, burst) more than raw level, so
      // cruise-to-full-load stays in a cabin-plausible 12-16 dB window overall.
      const raw = (body + edge + rush) * (0.6 + intensity * 0.4) * 0.8;

      // Make the one-sided pressure envelope bipolar without losing its body.
      const sample = raw - this.previousRaw + 0.9975 * this.dcBlocked;
      this.previousRaw = raw;
      this.dcBlocked = sample;

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
