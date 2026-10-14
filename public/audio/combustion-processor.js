/**
 * AudioWorkletProcessor: continuous four-stroke combustion excitation (Realism V2.2).
 * Served from /audio/combustion-processor.js - never spawn per-fire OscillatorNodes.
 *
 * Impulse train at firingHz = RPM × cylinders / 120 (four-stroke).
 * Architecture shapes bank balance / lope; load shapes pressure and brightness.
 *
 * Optional topology pilot (host message `{ type: "topology", topology }`):
 * explicit cylinder firing angles over a 360/720° cycle with collector routing and
 * bounded primary-length delays. When topology is null, the legacy aggregate path runs.
 *
 * Architecture contract v1 (keep in sync with src/lib/sound/realism/v2/architecture-contract.ts):
 * 0 even · 1 lope · 2 flat-six · 3 cross-plane refined · 4 v-twin · 5 single · 6 flat-plane-v8
 */
const ARCHITECTURE_CONTRACT_VERSION = 1;
const ARCHITECTURE_CODE_MAX = 6;
const TOPOLOGY_DELAY_MAX_SAMPLES = 512;
const TOPOLOGY_CYLINDER_MAX = 12;
const TOPOLOGY_COLLECTOR_MAX = 4;

/**
 * Finite AudioParam read: zero is valid and must not fall through to defaults.
 * Non-finite / missing → fallback, then clamp to [min, max].
 */
function readParam(values, fallback, min, max) {
  const raw = values && values.length ? values[0] : NaN;
  const v = Number.isFinite(raw) ? raw : fallback;
  return Math.min(max, Math.max(min, v));
}

function angleCrossed(prev, next, angle, cycle) {
  if (next >= prev) return angle > prev && angle <= next;
  return angle > prev || angle <= next;
}

class CombustionExcitationProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.bank = 0;
    this.env = 0;
    this.envTarget = 0;
    this.bright = 0;
    this.brightTarget = 0;
    this.burst = 0;
    this.burstTarget = 0;
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
    this.topology = null;
    this.crankPhaseDegrees = 0;
    this.delayBuffers = null;
    this.delayWrite = null;
    this.delaySamples = null;
    this.collectorAcc = null;
    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "seed" && Number.isFinite(data.seed)) {
        const s = data.seed >>> 0;
        this.seed = s === 0 ? 1 : s;
      } else if (data.type === "topology") {
        this.installTopology(data.topology);
      } else if (data.type === "clearTopology") {
        this.clearTopology();
      }
    };
  }

  rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return (this.seed & 0xffff) / 0x10000;
  }

  clearTopology() {
    this.topology = null;
    this.crankPhaseDegrees = 0;
    this.delayBuffers = null;
    this.delayWrite = null;
    this.delaySamples = null;
    this.collectorAcc = null;
  }

  installTopology(raw) {
    if (!raw || raw.version !== 1) {
      this.clearTopology();
      return;
    }
    const cycle = raw.cycleDegrees === 360 || raw.cycleDegrees === 720 ? raw.cycleDegrees : 0;
    const count = raw.cylinderCount | 0;
    if (!cycle || count < 1 || count > TOPOLOGY_CYLINDER_MAX) {
      this.clearTopology();
      return;
    }
    if (!Array.isArray(raw.cylinders) || raw.cylinders.length !== count) {
      this.clearTopology();
      return;
    }
    if (!Array.isArray(raw.collectors) || raw.collectors.length < 1 || raw.collectors.length > TOPOLOGY_COLLECTOR_MAX) {
      this.clearTopology();
      return;
    }
    const soundSpeed =
      Number.isFinite(raw.soundSpeedMetresPerSecond) && raw.soundSpeedMetresPerSecond > 0
        ? raw.soundSpeedMetresPerSecond
        : 343;
    const collectorIds = new Set();
    for (const c of raw.collectors) {
      if (!c || !Number.isFinite(c.id)) {
        this.clearTopology();
        return;
      }
      collectorIds.add(c.id | 0);
    }
    const cylinders = [];
    for (const cyl of raw.cylinders) {
      if (!cyl || !Number.isFinite(cyl.firingAngleDegrees) || !collectorIds.has(cyl.collectorId | 0)) {
        this.clearTopology();
        return;
      }
      const angle = cyl.firingAngleDegrees;
      if (angle < 0 || angle >= cycle) {
        this.clearTopology();
        return;
      }
      const weight = Number.isFinite(cyl.pulseWeight) ? Math.min(4, Math.max(0.01, cyl.pulseWeight)) : 1;
      const length = Number.isFinite(cyl.primaryLengthMetres)
        ? Math.min(2, Math.max(0, cyl.primaryLengthMetres))
        : 0;
      cylinders.push({
        id: cyl.id | 0,
        firingAngleDegrees: angle,
        collectorId: cyl.collectorId | 0,
        pulseWeight: weight,
        primaryLengthMetres: length,
      });
    }
    this.topology = {
      version: 1,
      cycleDegrees: cycle,
      cylinderCount: count,
      cylinders,
      collectors: [...collectorIds].map((id) => ({ id })),
      soundSpeedMetresPerSecond: soundSpeed,
    };
    this.crankPhaseDegrees = 0;
    this.delayBuffers = new Array(count);
    this.delayWrite = new Int32Array(count);
    this.delaySamples = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      this.delayBuffers[i] = new Float32Array(TOPOLOGY_DELAY_MAX_SAMPLES);
      const delaySec = cylinders[i].primaryLengthMetres / soundSpeed;
      this.delaySamples[i] = Math.min(
        TOPOLOGY_DELAY_MAX_SAMPLES - 2,
        Math.max(0, delaySec * sampleRate),
      );
      this.delayWrite[i] = 0;
    }
    this.collectorAcc = new Float32Array(TOPOLOGY_COLLECTOR_MAX);
    // Atomic replace: reset aggregate envelopes so modes do not cross-bleed.
    this.env = 0;
    this.envTarget = 0;
    this.bright = 0;
    this.brightTarget = 0;
    this.burst = 0;
    this.burstTarget = 0;
    this.phase = 0;
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
      {
        name: "architecture",
        defaultValue: 0,
        minValue: 0,
        maxValue: ARCHITECTURE_CODE_MAX,
        automationRate: "k-rate",
      },
    ];
  }

  firePunch(punch, intensity, sharpness, load) {
    // Root-cause §clicks: use target variables with soft attack for all envelopes.
    // The V-twin has sparse pulses (~12 Hz at idle) where instant steps cause clicks.
    this.envTarget = Math.min(2.4, (this.envTarget || 0) + punch * (0.6 + intensity * 0.2));
    this.brightTarget = Math.min(
      1.8,
      (this.brightTarget || 0) + punch * sharpness * (0.22 + load * 0.48),
    );
    this.burstTarget = Math.min(
      2.0,
      (this.burstTarget || 0) + punch * (0.38 + load * 0.55) * (0.5 + sharpness * 0.55),
    );
    this.grit = (this.rand() * 2 - 1) * (0.3 + load * 0.6 * sharpness);
  }

  process(_inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const ch0 = output[0];
    const ch1 = output[1] || null;

    // Zero semantics (deliberate):
    // - firingHz 0: no new fires; pressure tails continue to decay.
    // - intensity 0: softest timbre / level scale (0.6 + 0*0.4), not mute-by-substitution.
    // - load 0: lightest combustion pressure / brightness shaping, not the 0.3 default.
    // - sharpness 0: softest edge/burst, not the 0.45 default.
    const firingHz = readParam(parameters.firingHz, 40, 0, 800);
    const intensity = readParam(parameters.intensity, 0.4, 0, 1);
    const irregularity = readParam(parameters.irregularity, 0, 0, 1);
    const load = readParam(parameters.load, 0.3, 0, 1);
    const sharpness = readParam(parameters.sharpness, 0.45, 0, 1);
    const arch = Math.round(readParam(parameters.architecture, 0, 0, ARCHITECTURE_CODE_MAX));

    const bodyTauSeconds = 0.0038 + (1 - sharpness) * 0.0042 + load * 0.0012;
    const edgeTauSeconds = 0.0012 + (1 - sharpness) * 0.0013;
    const burstTauSeconds = 0.0022 + (1 - sharpness) * 0.0018 + load * 0.0008;
    const decay = Math.exp(-1 / (sampleRate * bodyTauSeconds));
    const brightDecay = Math.exp(-1 / (sampleRate * edgeTauSeconds));
    const burstDecay = Math.exp(-1 / (sampleRate * burstTauSeconds));

    // Cap burstLpHz at 4200 Hz: keeps some air above 6 kHz (the 2500 Hz cap plus soft attacks
    // dulled the top end) while HF noise still does not dilute order share.
    const burstLpHz = Math.min(4200, 900 + load * 1800 + sharpness * 900);
    const burstHpHz = 140 + load * 120;
    const lpCoef = 1 - Math.exp((-2 * Math.PI * burstLpHz) / sampleRate);
    const hpCoef = 1 - Math.exp((-2 * Math.PI * burstHpHz) / sampleRate);

    // Cycle-to-cycle amplitude jitter: more variation at cruise, less at high load for clean harmonics.
    // irregularity contribution also reduced at high load to keep firing share ~0.55+.
    const ampSpread = 0.06 + (1 - load) * 0.12 + irregularity * (0.32 + (1 - load) * 0.16);
    const rateComp = Math.min(2, Math.max(0.6, Math.pow(100 / Math.max(20, firingHz), 0.35)));
    const timeSpread = 0.015 + irregularity * 0.12;
    const wanderInc = (this.wanderRate * 2 * Math.PI) / sampleRate;
    const topology = this.topology;

    for (let i = 0; i < ch0.length; i += 1) {
      if (topology) {
        // RPM from firingHz: four-stroke firingHz = rpm * cylinders / 120
        // phaseAdvanceDegrees = rpm * 6 / sampleRate
        const cylinders = topology.cylinderCount;
        const rpm = firingHz > 0 ? (firingHz * 120) / cylinders : 0;
        const advance = (rpm * 6) / sampleRate;
        const prev = this.crankPhaseDegrees;
        let next = prev + advance;
        const cycle = topology.cycleDegrees;
        if (next >= cycle) next -= cycle;

        if (this.collectorAcc) this.collectorAcc.fill(0);

        if (this.delayBuffers) {
          for (let c = 0; c < topology.cylinders.length; c += 1) {
            let punchIn = 0;
            if (firingHz > 0 && advance > 0) {
              const cyl = topology.cylinders[c];
              if (angleCrossed(prev, next, cyl.firingAngleDegrees, cycle)) {
                this.fireIndex = (this.fireIndex + 1) & 0xffff;
                let punch = (0.7 + load * 0.3) * cyl.pulseWeight;
                punch *= (1 + (this.rand() - 0.5) * ampSpread * (1 + timeSpread)) * rateComp;
                punchIn = punch;
              }
            }
            const buf = this.delayBuffers[c];
            const w = this.delayWrite[c];
            buf[w] = punchIn;
            this.delayWrite[c] = (w + 1) % TOPOLOGY_DELAY_MAX_SAMPLES;
          }
        }

        let delayedSum = 0;
        let collector0 = 0;
        let collector1 = 0;
        if (this.delayBuffers) {
          for (let c = 0; c < topology.cylinders.length; c += 1) {
            const buf = this.delayBuffers[c];
            const w = this.delayWrite[c];
            const d = this.delaySamples[c];
            const dInt = d | 0;
            const frac = d - dInt;
            const i0 = (w - 1 - dInt + TOPOLOGY_DELAY_MAX_SAMPLES * 4) % TOPOLOGY_DELAY_MAX_SAMPLES;
            const i1 = (i0 - 1 + TOPOLOGY_DELAY_MAX_SAMPLES) % TOPOLOGY_DELAY_MAX_SAMPLES;
            const delayed = buf[i0] * (1 - frac) + buf[i1] * frac;
            delayedSum += delayed;
            const cid = topology.cylinders[c].collectorId;
            if (cid === 0) collector0 += delayed;
            else if (cid === 1) collector1 += delayed;
            else delayedSum += 0;
          }
        }

        if (delayedSum > 0) {
          this.firePunch(delayedSum, intensity, sharpness, load);
        }
        this.crankPhaseDegrees = next;
        // Mild collector stereo from independent bank energy (geometry ≠ final cabin mix).
        this._collectorPan = collector0 + collector1 > 1e-8
          ? (collector1 - collector0) / (collector0 + collector1 + 1e-8)
          : 0;
      } else {
        // Legacy aggregate impulse train
        const phaseIncBase = firingHz / sampleRate;
        let inc = phaseIncBase * this.intervalScale;
        if (arch === 1 || arch === 4) {
          const odd = this.fireIndex & 1;
          inc *= odd ? 1 + irregularity * 0.08 : 1 - irregularity * 0.05;
        }

        this.phase += Math.max(0, inc);
        if (firingHz > 0 && this.phase >= 1) {
          this.phase -= 1;
          this.fireIndex = (this.fireIndex + 1) & 0xffff;
          this.bank = 1 - this.bank;
          this.intervalScale = 1 + (this.rand() - 0.5) * timeSpread;

          let punch = 0.7 + load * 0.3;
          if (arch === 1) {
            punch *= this.fireIndex & 1 ? 1.18 : 0.72;
          } else if (arch === 2) {
            punch *= 0.92 + this.bank * 0.08;
          } else if (arch === 3) {
            punch *= 0.95 + (this.fireIndex % 4 === 0 ? 0.08 : 0);
          } else if (arch === 4) {
            punch *= this.fireIndex & 1 ? 1.25 : 0.55;
          } else if (arch === 5) {
            punch *= 1.15;
          } else if (arch === 6) {
            punch *= 0.96 + this.bank * 0.06;
          }
          punch *= (1 + (this.rand() - 0.5) * ampSpread) * rateComp;
          this.firePunch(punch, intensity, sharpness, load);
        }
        this._collectorPan = 0;
      }

      // Root-cause §clicks: soft attack on all envelopes (~0.3ms for env/bright, ~0.5ms for burst)
      // Prevents clicks from sparse V-twin pulses where instant steps create waveform discontinuities.
      // Attack coefficients: higher = faster attack
      const envAttack = 1 - Math.exp(-1 / (sampleRate * 0.0003));
      const burstAttack = 1 - Math.exp(-1 / (sampleRate * 0.0005));
      // Ramp toward targets
      this.env += (this.envTarget - this.env) * envAttack;
      this.bright += (this.brightTarget - this.bright) * envAttack;
      this.burst += (this.burstTarget - this.burst) * burstAttack;
      // Decay both actual and target values
      this.env *= decay;
      this.envTarget = (this.envTarget || 0) * decay;
      this.bright *= brightDecay;
      this.brightTarget = (this.brightTarget || 0) * brightDecay;
      this.burst *= burstDecay;
      this.burstTarget = (this.burstTarget || 0) * burstDecay;
      this.grit = this.grit * 0.94 + (this.rand() * 2 - 1) * 0.04 * (0.2 + load);

      const white = this.rand() * 2 - 1;
      this.noiseLp += (white - this.noiseLp) * lpCoef;
      this.noiseDc += (this.noiseLp - this.noiseDc) * hpCoef;
      const band = this.noiseLp - this.noiseDc;

      this.wanderPhase += wanderInc;
      if (this.wanderPhase > 2 * Math.PI) {
        this.wanderPhase -= 2 * Math.PI;
        this.wanderRate = 0.5 + this.rand() * 1.5;
        this.wanderDepth = 0.025 + this.rand() * 0.035;
      }
      const wander = 1 + Math.sin(this.wanderPhase) * this.wanderDepth;

      // Root-cause §3-4: rush dilutes order share and causes launch clicks.
      // - Reduce rush from 0.75 to 0.28, scale by (1 - 0.5*load) so it fades at pull
      // - Keep texture floor ≥0.06 to mask isolated pulses at low RPM
      // - Near-constant intensity: 0.85 + 0.15*intensity instead of 0.6 + 0.4*intensity
      const body = this.env * (0.72 + this.grit * 0.18) * wander;
      const edge = this.bright * this.grit * 0.28;
      const rush = this.burst * band * 0.28 * (1 - 0.5 * load);
      const texture = band * (0.06 + (1 - load) * 0.03) * (0.6 + this.env * 0.4);
      const raw = (body + edge + rush + texture) * (0.85 + intensity * 0.15) * 0.88;

      const sample = raw - this.previousRaw + 0.9975 * this.dcBlocked;
      this.previousRaw = raw;
      this.dcBlocked = sample;

      ch0[i] = sample;
      if (ch1) {
        let pan = 0;
        if (topology) {
          pan = 0.08 * (this._collectorPan || 0);
        } else if (arch === 2 || arch === 3 || arch === 1 || arch === 6) {
          pan = 0.06 * (this.bank * 2 - 1);
        }
        ch1[i] = sample * (1 - pan);
      }
    }
    return true;
  }
}

CombustionExcitationProcessor.ARCHITECTURE_CONTRACT_VERSION = ARCHITECTURE_CONTRACT_VERSION;
CombustionExcitationProcessor.ARCHITECTURE_CODE_MAX = ARCHITECTURE_CODE_MAX;

registerProcessor("elcamoso-combustion-excitation", CombustionExcitationProcessor);
