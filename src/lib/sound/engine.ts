import type { DriveState } from "@/lib/drive/model";
import type { SoundProfile } from "@/lib/sound/profiles";

/**
 * Motion-to-sound synthesis. Every profile consumes the same DriveState but maps
 * it through its own strategy (virtual transmission vs. continuous).
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private voices: { osc: OscillatorNode; gain: GainNode; ratio: number }[] = [];
  private noise: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private profile: SoundProfile | null = null;
  private volume = 0.7;

  get running() {
    return this.ctx !== null;
  }

  async start(profile: SoundProfile) {
    if (this.ctx) {
      this.setProfile(profile);
      return;
    }
    const ctx = new AudioContext();
    await ctx.resume();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    filter.Q.value = 1.2;
    filter.connect(master);
    master.connect(ctx.destination);
    this.master = master;
    this.filter = filter;

    this.playSignature();
    this.setProfile(profile);
    master.gain.setTargetAtTime(this.volume, ctx.currentTime + 0.9, 0.6);
  }

  /** Short, original ELCAMOSO sonic signature — two soft rising sines. */
  private playSignature() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    [392, 587.33].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 0.75, now + i * 0.18);
      osc.frequency.exponentialRampToValueAtTime(freq, now + i * 0.18 + 0.45);
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.18 + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 1);
    });
  }

  setProfile(profile: SoundProfile) {
    const ctx = this.ctx;
    const filter = this.filter;
    if (!ctx || !filter) {
      this.profile = profile;
      return;
    }
    this.teardownVoices();
    this.profile = profile;

    profile.voice.harmonics.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? profile.voice.wave : "sawtooth";
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * profile.voice.detune * (i + 1);
      osc.frequency.value = profile.voice.baseFrequency * ratio;
      gain.gain.value = 0.34 / (i + 1.4);
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      this.voices.push({ osc, gain, ratio });
    });

    if (profile.voice.noise > 0) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(filter);
      src.start();
      this.noise = { src, gain };
    }
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.15);
    }
  }

  update(state: DriveState) {
    const ctx = this.ctx;
    const profile = this.profile;
    if (!ctx || !profile || !this.filter) return;
    const t = ctx.currentTime;
    const v = profile.voice;

    let fundamental: number;
    if (profile.drivetrainMode === "virtual-transmission") {
      fundamental = (state.rpm / 60) * (v.baseFrequency / 26);
    } else {
      fundamental = v.baseFrequency * (1 + state.load * 2.6 + state.throttle * 0.5);
    }
    fundamental = Math.max(18, Math.min(900, fundamental));

    this.voices.forEach(({ osc, gain, ratio }, i) => {
      osc.frequency.setTargetAtTime(fundamental * ratio, t, 0.05);
      const brightness = 0.2 + state.load * 0.8;
      gain.gain.setTargetAtTime((0.3 / (i + 1.4)) * (i === 0 ? 1 : brightness), t, 0.12);
    });

    const cutoff = v.filterBase + v.filterRange * Math.pow(state.load, 0.8);
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.08);
    this.filter.Q.setTargetAtTime(profile.drivetrainMode === "continuous" ? 4 : 1.2, t, 0.3);

    if (this.noise) {
      const level = v.noise * (0.25 + state.load * 0.9) + state.regen * v.noise * 0.6;
      this.noise.gain.gain.setTargetAtTime(level * 0.35, t, 0.15);
    }

    if (this.master) {
      const duck = 1 - state.regen * 0.35;
      this.master.gain.setTargetAtTime(this.volume * (0.55 + state.load * 0.45) * duck, t, 0.12);
    }
  }

  private teardownVoices() {
    this.voices.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    });
    this.voices = [];
    if (this.noise) {
      try {
        this.noise.src.stop();
      } catch {
        /* already stopped */
      }
      this.noise = null;
    }
  }

  async stop() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.master) this.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    await new Promise((r) => setTimeout(r, 380));
    this.teardownVoices();
    await ctx.close();
    this.ctx = null;
    this.master = null;
    this.filter = null;
  }
}
