import type { DriveState } from "@/lib/drive/model";
import { supportsDynamicDrive } from "@/lib/powertrain/adapters/profile-map";
import { DynamicDriveSynth } from "@/lib/sound/dynamic-drive/synth";
import { ImprovedSynth } from "@/lib/sound/realism/improved-synth";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import { HybridCombustionSynth } from "@/lib/sound/realism/v2/hybrid-combustion-synth";
import { isCombustionRealismV2Profile } from "@/lib/sound/realism/v2/acoustic-engine";
import { getProfile, type SoundProfile } from "@/lib/sound/profiles";
import { getSymphonyPack, SymphonySynth } from "@/lib/symphony";
import { createHarmonicResonance, type HarmonicResonance } from "./harmonic-resonance";
import {
  createFusionMixer,
  machinePresenceScale,
  musicSpaceScale,
  perceptualFusionGains,
  type FusionMixer,
} from "./mixer";
import { effectiveFusionMix, getRuntimeFusionParams } from "@/lib/studio";
import { getFusionPreset } from "./presets";
import type { FusionDiagnostics, FusionPreset } from "./types";

interface MachineBackend {
  update(state: DriveState, t: number): void;
  dispose(): void;
  kind: string;
}

function buildMachineBackend(
  ctx: BaseAudioContext,
  machineProfile: SoundProfile,
  buses: StrategyBuses,
): MachineBackend | null {
  if (supportsDynamicDrive(machineProfile)) {
    const dd = new DynamicDriveSynth();
    if (dd.build(ctx, machineProfile, buses)) {
      return {
        kind: "dynamic-drive",
        update: (s, t) => dd.update(s, t),
        dispose: () => dd.dispose(),
      };
    }
    dd.dispose();
  }

  if (isCombustionRealismV2Profile(machineProfile.id)) {
    const hybrid = new HybridCombustionSynth();
    if (hybrid.build(ctx, machineProfile, buses)) {
      return {
        kind: "hybrid-v2",
        update: (s, t) => hybrid.update(s, t),
        dispose: () => hybrid.dispose(),
      };
    }
    hybrid.dispose();
  }

  const improved = new ImprovedSynth();
  if (improved.build(ctx, machineProfile, buses)) {
    return {
      kind: "improved",
      update: (s, t) => improved.update(s, t),
      dispose: () => improved.dispose(),
    };
  }
  improved.dispose();
  return null;
}

/**
 * FusionSynth - Engine + Symphony through FusionMixer into existing master chain.
 * Single AudioContext; does not own lifecycle of the context.
 */
export class FusionSynth {
  private preset: FusionPreset | null = null;
  private mixer: FusionMixer | null = null;
  private resonance: HarmonicResonance | null = null;
  private machine: MachineBackend | null = null;
  private symphony: SymphonySynth | null = null;
  private mix = 0.6;
  private harmonicDepth = 0;
  private softPump = false;
  private built = false;

  build(
    ctx: BaseAudioContext,
    profile: SoundProfile,
    buses: StrategyBuses,
    seed?: number,
  ): boolean {
    this.dispose();
    const preset = getFusionPreset(profile.id);
    if (!preset) return false;

    const machineProfile = getProfile(preset.machineProfileId);
    const pack = getSymphonyPack(preset.symphonyProfileId);
    if (!pack) return false;

    this.preset = preset;
    this.mix = preset.defaultMix;
    this.harmonicDepth = preset.harmonicResonance;
    this.softPump = preset.softPump;

    this.mixer = createFusionMixer(ctx, buses.body);
    this.resonance = createHarmonicResonance(ctx, this.mixer.machine, pack.key);

    const machineBuses: StrategyBuses = {
      body: this.resonance.input,
      accents: this.mixer.events,
      beds: this.mixer.atmosphere,
      profile: this.resonance.input,
    };
    this.machine = buildMachineBackend(ctx, machineProfile, machineBuses);
    if (!this.machine) {
      this.dispose();
      return false;
    }

    const musicBuses: StrategyBuses = {
      body: this.mixer.music,
      accents: this.mixer.events,
      beds: this.mixer.atmosphere,
      profile: this.mixer.music,
    };
    this.symphony = new SymphonySynth();
    // Build against symphony profile id so pack resolves
    const symphonyProfile = getProfile(preset.symphonyProfileId);
    const ok = this.symphony.build(ctx, symphonyProfile, musicBuses, seed);
    if (!ok) {
      this.dispose();
      return false;
    }

    const t = "currentTime" in ctx ? ctx.currentTime : 0;
    this.applyMix(t);
    this.resonance.setDepth(this.harmonicDepth, t);
    this.built = true;
    return true;
  }

  setMix(mix: number, audioTime: number) {
    this.mix = Math.min(1, Math.max(0, mix));
    this.applyMix(audioTime);
  }

  setHarmonicResonance(depth: number, audioTime: number) {
    this.harmonicDepth = Math.min(1, Math.max(0, depth));
    this.resonance?.setDepth(this.harmonicDepth, audioTime);
  }

  private applyMix(audioTime: number) {
    if (!this.mixer) return;
    const base = perceptualFusionGains(this.mix);
    this.mixer.setGains(base, audioTime);
  }

  update(state: DriveState, audioTime: number) {
    if (!this.built || !this.mixer || !this.machine || !this.symphony) return;

    this.machine.update(state, audioTime);
    this.symphony.update(state, audioTime);

    const energy = this.symphony.getEnergy();
    if (!energy) return;

    const studio = this.preset ? getRuntimeFusionParams(this.preset.id) : null;
    const mix = studio ? effectiveFusionMix(studio) : this.mix;
    if (studio) {
      this.mix = mix;
      if (Math.abs(studio.harmonicResonance - this.harmonicDepth) > 0.01) {
        this.setHarmonicResonance(studio.harmonicResonance, audioTime);
      }
    }

    const base = perceptualFusionGains(mix);
    const presenceBase = machinePresenceScale({
      driverDemand: energy.driverDemand,
      tension: energy.tension,
      movementState: energy.movementState,
      softPump: this.softPump,
    });
    const presenceMul = studio ? 0.75 + studio.machinePresence * 0.55 : 1;
    const shiftBoost =
      studio && energy.driverDemand > 0.55
        ? 1 + studio.shiftEmphasis * (energy.driverDemand - 0.55) * 0.7
        : 1;
    const presence = presenceBase * presenceMul * shiftBoost;
    const musicSpace =
      musicSpaceScale({
        movementState: energy.movementState,
        driverDemand: energy.driverDemand,
      }) * (studio ? 0.75 + studio.musicEnergy * 0.5 : 1);

    this.mixer.setGains(
      {
        machine: base.machine * presence,
        music: base.music * musicSpace,
        atmosphere: base.atmosphere,
        events: base.events * (studio ? 0.85 + studio.shiftEmphasis * 0.3 : 1),
      },
      audioTime,
    );
  }

  getDiagnostics(): FusionDiagnostics {
    const energy = this.symphony?.getEnergy();
    const gains = perceptualFusionGains(this.mix);
    return {
      presetId: this.preset?.id ?? null,
      mix: this.mix,
      machineGain: gains.machine,
      musicGain: gains.music,
      harmonicDepth: this.harmonicDepth,
      energy: energy?.energy ?? 0,
      movementState: energy?.movementState ?? "stopped",
      machineBackend: this.machine?.kind ?? null,
      symphonyActive: Boolean(this.symphony),
    };
  }

  getEnergy() {
    return this.symphony?.getEnergy() ?? null;
  }

  dispose() {
    this.symphony?.dispose();
    this.symphony = null;
    this.machine?.dispose();
    this.machine = null;
    this.resonance?.dispose();
    this.resonance = null;
    this.mixer?.dispose();
    this.mixer = null;
    this.preset = null;
    this.built = false;
  }
}
