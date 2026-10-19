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

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function svfCoef(hz) {
  return 2 * Math.sin((Math.PI * Math.min(hz, sampleRate / 6)) / sampleRate);
}

/** Optional `organic` topology block → precomputed coefficients, or null when absent/invalid. */
function parseOrganic(o) {
  if (!o || typeof o !== "object") return null;
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const out = {
    crankJitter: Math.min(0.05, Math.max(0, num(o.crankJitter, 0))),
    crankWander: Math.min(0.05, Math.max(0, num(o.crankWander, 0))),
    wanderCoef: 1 - Math.exp((-2 * Math.PI * Math.min(20, Math.max(0.05, num(o.wanderHz, 1.5)))) / sampleRate),
    kickDecay: Math.exp(-1 / (sampleRate * 0.004)),
    // Bank-rate amplitude modulation (0..1): one bank breathes louder, locked to crank
    // phase, which puts energy on the half orders (V10: 2.5 / 7.5 / 12.5) without new tones.
    bankAm: Math.min(1, Math.max(0, num(o.bankAm, 0))),
    vt: null,
    roar: null,
  };
  const v = o.valvetrain;
  if (v && Number.isFinite(v.level) && v.level > 0 && Number.isFinite(v.hz)) {
    const f0 = num(v.fadeStartRpm, 6000);
    out.vt = {
      level: Math.min(1, v.level),
      f: svfCoef(v.hz),
      damp: 1 / Math.max(0.5, num(v.q, 2)),
      decay: Math.exp(-1 / (sampleRate * Math.max(0.0002, num(v.tauS, 0.0007)))),
      fadeStartRpm: f0,
      fadeEndRpm: Math.max(f0 + 1, num(v.fadeEndRpm, f0 + 3000)),
    };
  }
  const r = o.intakeRoar;
  if (r && Number.isFinite(r.level) && r.level > 0 && Number.isFinite(r.hz)) {
    const s0 = num(r.startRpm, 3000);
    out.roar = {
      level: Math.min(1, r.level),
      f: svfCoef(r.hz),
      damp: 1 / Math.max(0.5, num(r.q, 1.2)),
      startRpm: s0,
      fullRpm: Math.max(s0 + 1, num(r.fullRpm, s0 + 6000)),
      idle: Math.min(1, Math.max(0, num(r.idle, 0.15))),
    };
  }
  return out.crankJitter || out.crankWander || out.bankAm || out.vt || out.roar ? out : null;
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
    if (
      !Array.isArray(raw.collectors) ||
      raw.collectors.length < 1 ||
      raw.collectors.length > TOPOLOGY_COLLECTOR_MAX
    ) {
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
      if (
        !cyl ||
        !Number.isFinite(cyl.firingAngleDegrees) ||
        !collectorIds.has(cyl.collectorId | 0)
      ) {
        this.clearTopology();
        return;
      }
      const angle = cyl.firingAngleDegrees;
      if (angle < 0 || angle >= cycle) {
        this.clearTopology();
        return;
      }
      const weight = Number.isFinite(cyl.pulseWeight)
        ? Math.min(4, Math.max(0.01, cyl.pulseWeight))
        : 1;
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
    const cycleLope = Number.isFinite(raw.cycleLope) ? Math.min(1, Math.max(0, raw.cycleLope)) : 0;
    this.cycleGain = 1;
    const noiseScale = Number.isFinite(raw.noiseScale)
      ? Math.min(1, Math.max(0, raw.noiseScale))
      : 1;
    const r = raw.rasp;
    const rasp =
      r &&
      Number.isFinite(r.level) &&
      Number.isFinite(r.startRpm) &&
      Number.isFinite(r.fullRpm) &&
      Number.isFinite(r.lowHz) &&
      Number.isFinite(r.highHz) &&
      r.fullRpm > r.startRpm &&
      r.highHz > r.lowHz &&
      r.lowHz > 0
        ? {
            level: Math.min(1, Math.max(0, r.level)),
            startRpm: r.startRpm,
            fullRpm: r.fullRpm,
            lpCoef: 1 - Math.exp((-2 * Math.PI * Math.min(16000, r.highHz)) / sampleRate),
            hpCoef: 1 - Math.exp((-2 * Math.PI * r.lowHz) / sampleRate),
          }
        : null;
    this.raspLp = 0;
    this.raspDc = 0;
    // Optional pulse time scale (F1-class firing rates): shorter pulse envelopes so ~1.6 kHz
    // firing still reads as discrete pulses. Absent (1) for every other topology.
    const pulseTauScale = Number.isFinite(raw.pulseTauScale)
      ? Math.min(1, Math.max(0.05, raw.pulseTauScale))
      : 1;
    // Optional organic layer (V10 family): crank-speed jitter/wander, cam-synchronous
    // valvetrain ticks and a pulse-modulated airbox roar. Absent (null) for every other
    // topology, so their output stays byte-identical.
    const organic = parseOrganic(raw.organic);
    this.ogWander = 0;
    this.ogTarget = 0;
    this.ogCount = 0;
    this.ogKick = 0;
    this.vtCountdown = -1;
    this.vtAmp = 0;
    this.vtEnv = 0;
    this.vtLow = 0;
    this.vtBand = 0;
    this.irLow = 0;
    this.irBand = 0;
    this.topology = {
      version: 1,
      cycleLope,
      noiseScale,
      rasp,
      pulseTauScale,
      organic,
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
      { name: "firingHz", defaultValue: 40, minValue: 0, maxValue: 2000, automationRate: "k-rate" },
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
    const firingHz = readParam(parameters.firingHz, 40, 0, 2000);
    const intensity = readParam(parameters.intensity, 0.4, 0, 1);
    const irregularity = readParam(parameters.irregularity, 0, 0, 1);
    const load = readParam(parameters.load, 0.3, 0, 1);
    const sharpness = readParam(parameters.sharpness, 0.45, 0, 1);
    const arch = Math.round(readParam(parameters.architecture, 0, 0, ARCHITECTURE_CODE_MAX));

    const tauScale = this.topology ? this.topology.pulseTauScale : 1;
    const bodyTauSeconds = (0.0038 + (1 - sharpness) * 0.0042 + load * 0.0012) * tauScale;
    const edgeTauSeconds = (0.0012 + (1 - sharpness) * 0.0013) * tauScale;
    const burstTauSeconds = (0.0022 + (1 - sharpness) * 0.0018 + load * 0.0008) * tauScale;
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
        let advance = (rpm * 6) / sampleRate;
        const og = topology.organic;
        if (og && advance > 0) {
          // Crank speed is never perfectly constant: slow random wander plus a small
          // per-fire torque kick (combustion-to-combustion variation) - no fixed-pitch tone.
          if (--this.ogCount <= 0) {
            this.ogCount = 600 + ((this.rand() * 1800) | 0);
            this.ogTarget = this.rand() * 2 - 1;
          }
          this.ogWander += (this.ogTarget - this.ogWander) * og.wanderCoef;
          this.ogKick *= og.kickDecay;
          advance *= 1 + this.ogWander * og.crankWander + this.ogKick;
        }
        const prev = this.crankPhaseDegrees;
        let next = prev + advance;
        const cycle = topology.cycleDegrees;
        if (next >= cycle) {
          next -= cycle;
          // Optional per-cycle lope (cam overlap / mixture variation): one random gain per 720°,
          // scaled by irregularity so it lives at idle and fades with load (order-½ lumpiness).
          if (topology.cycleLope > 0) {
            this.cycleGain = 1 + (this.rand() - 0.5) * 2 * topology.cycleLope * irregularity;
          }
        }

        if (this.collectorAcc) this.collectorAcc.fill(0);

        if (this.delayBuffers) {
          for (let c = 0; c < topology.cylinders.length; c += 1) {
            let punchIn = 0;
            if (firingHz > 0 && advance > 0) {
              const cyl = topology.cylinders[c];
              if (angleCrossed(prev, next, cyl.firingAngleDegrees, cycle)) {
                this.fireIndex = (this.fireIndex + 1) & 0xffff;
                let punch = (0.7 + load * 0.3) * cyl.pulseWeight * (this.cycleGain || 1);
                punch *= (1 + (this.rand() - 0.5) * ampSpread * (1 + timeSpread)) * rateComp;
                punchIn = punch;
                if (og) {
                  if (og.crankJitter > 0) {
                    this.ogKick += (this.rand() - 0.5) * 2 * og.crankJitter * (0.6 + irregularity);
                  }
                  if (og.vt && this.vtCountdown < 0) {
                    // Cam / valve event a little after the fire; most ticks soft, a few loud.
                    const r0 = this.rand();
                    this.vtCountdown = ((sampleRate / Math.max(1, firingHz)) * (0.35 + this.rand() * 0.3)) | 0;
                    this.vtAmp = og.vt.level * r0 * r0 * r0 * (0.4 + this.rand() * 0.6);
                  }
                }
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
        this._collectorPan =
          collector0 + collector1 > 1e-8
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
      // F1-class short pulses (pulseTauScale < 1) scale the attacks with them; 1 elsewhere.
      const envAttack = 1 - Math.exp(-1 / (sampleRate * 0.0003 * tauScale));
      const burstAttack = 1 - Math.exp(-1 / (sampleRate * 0.0005 * tauScale));
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
      // Optional per-topology broadband scale: the noise floor is load-gated so cruise stays clean.
      const ns = topology ? topology.noiseScale : 1;
      const nsLoad = ns >= 1 ? 1 : ns + (1 - ns) * load * load;
      const rush = this.burst * band * 0.28 * (1 - 0.5 * load) * nsLoad;
      const texture = band * (0.06 + (1 - load) * 0.03) * (0.6 + this.env * 0.4) * nsLoad;
      // Optional firing-synchronous rasp (topology.rasp): its own band-limited noise rides the
      // pulse envelopes, gated by rpm and load. Absent for every topology without `rasp`.
      let raspOut = 0;
      const rs = topology ? topology.rasp : null;
      if (rs) {
        const rpmNow = firingHz > 0 ? (firingHz * 120) / topology.cylinderCount : 0;
        const rpmGate = Math.min(
          1,
          Math.max(0, (rpmNow - rs.startRpm) / (rs.fullRpm - rs.startRpm)),
        );
        const loadGate = Math.min(1, Math.max(0, (load - 0.3) / 0.4));
        const wr = this.rand() * 2 - 1;
        this.raspLp += (wr - this.raspLp) * rs.lpCoef;
        this.raspDc += (this.raspLp - this.raspDc) * rs.hpCoef;
        const g = rpmGate * loadGate;
        if (g > 0) {
          raspOut =
            (this.raspLp - this.raspDc) * (this.burst * 0.75 + this.env * 0.25) * rs.level * g;
        }
      }
      let organicOut = 0;
      const ogx = topology ? topology.organic : null;
      if (ogx) {
        const rpmNow = firingHz > 0 ? (firingHz * 120) / topology.cylinderCount : 0;
        if (ogx.vt) {
          const vt = ogx.vt;
          if (this.vtCountdown >= 0 && --this.vtCountdown < 0) this.vtEnv += this.vtAmp;
          this.vtEnv *= vt.decay;
          const fade = 1 - clamp01((rpmNow - vt.fadeStartRpm) / (vt.fadeEndRpm - vt.fadeStartRpm));
          const n = this.rand() * 2 - 1;
          this.vtLow += vt.f * this.vtBand;
          const hi = n - this.vtLow - vt.damp * this.vtBand;
          this.vtBand += vt.f * hi;
          organicOut += this.vtBand * this.vtEnv * fade * (1 - 0.5 * load);
        }
        if (ogx.roar) {
          const ro = ogx.roar;
          const g =
            clamp01((rpmNow - ro.startRpm) / (ro.fullRpm - ro.startRpm)) *
            clamp01((load - 0.2) / 0.5);
          const amt = ro.idle + (1 - ro.idle) * g;
          const n = this.rand() * 2 - 1;
          this.irLow += ro.f * this.irBand;
          const hi = n - this.irLow - ro.damp * this.irBand;
          this.irBand += ro.f * hi;
          // Pulse-modulated: the airbox roar breathes with each intake stroke.
          organicOut += this.irBand * ro.level * amt * (0.45 + 0.55 * Math.min(1, this.env * 0.8));
        }
      }
      let raw = (body + edge + rush + texture + raspOut + organicOut) * (0.85 + intensity * 0.15) * 0.88;
      if (ogx && ogx.bankAm > 0) {
        // 720° cycle → (cylinders / 2) bank periods; cosine locked to the (jittered) crank.
        const ph = (this.crankPhaseDegrees / topology.cycleDegrees) * (topology.cylinderCount / 2) * 2 * Math.PI;
        raw *= 1 + ogx.bankAm * Math.cos(ph);
      }

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
