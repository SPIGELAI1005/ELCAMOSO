import type { DriveState } from "@/lib/drive/model";
import type { LayerHandle } from "@/lib/sound/dsp/layers";
import type { SoundProfile } from "@/lib/sound/profiles";
import {
  createMotionTracker,
  motionFromDrive,
  type MotionTracker,
} from "@/lib/sound/realism/motion";
import { getStrategy } from "@/lib/sound/realism/strategies";
import type { LayerDebugInfo, StrategyBuses } from "@/lib/sound/realism/types";
import {
  profileExperienceConfig,
  type AudioLayerRole,
  type ProfileExperienceConfig,
} from "@/lib/sound/profile-experience-config";

export function inferLayerRole(id: string): AudioLayerRole {
  const value = id.toLowerCase();
  if (/event|shift|crack|pop|wastegate|flutter|horn|whistle|thunder|signal|chirp|laugh|bell|beam|sonar/.test(value)) return "event";
  if (/regen|coast/.test(value)) return "regen";
  if (/turbo|boost|spool|compressor/.test(value)) return "boost";
  if (/intake|stack|suction/.test(value)) return "intake";
  if (/exhaust|overrun|chuff/.test(value)) return "exhaust";
  if (/motor|electric|inverter|traction|maglev/.test(value)) return "motor";
  if (/mechan|gear|drive|chain|track|rod|clatter|clank|rim|wheel|reduction|hydraulic|pump/.test(value)) return "mechanical";
  if (/music|pad|bass|arp|lead|orchestra|pulse|heartbeat|choir|synth/.test(value)) return "music";
  if (/wind|air|rain|water|ocean|spray|snow|gravel|road|aero|wash|surface|cavitation|downwash/.test(value)) return "environment";
  if (/combust|engine|firing|cylinder|v8|v10|flat|twin|diesel|tractor/.test(value)) return "combustion";
  return "core";
}

export function phaseRoleGain(role: AudioLayerRole, motion: ReturnType<typeof motionFromDrive>, config: ProfileExperienceConfig) {
  const phase = config.phases;
  const stopped = motion.speedKmh < 1.5 && motion.throttleFast < 0.1;
  const accelerating = motion.throttleFast > 0.45 || motion.accelMps2 > 0.7;
  const releasing = motion.overrun || (motion.speedKmh > 5 && motion.throttleFast < 0.08 && motion.accelMps2 < -0.2);
  const regenerating = motion.regen > 0.2;
  const engineRoles = ["combustion", "motor", "exhaust", "intake"] as const;
  const isAmbientProfile = !config.availableRoles.some((r) => (engineRoles as readonly string[]).includes(r));
  if (stopped) {
    if (isAmbientProfile) {
      return phase.idleCharacter;
    }
    if (role === "event" || role === "environment" || role === "regen") {
      return 0.55;
    }
    return phase.idleCharacter;
  }
  if (regenerating) {
    if (role === "regen") return Math.max(0.2, phase.regenCharacter);
    if (role === "motor" || role === "combustion" || role === "intake" || role === "boost") return 0.38;
    if (role === "event") return 0.5;
    return 0.72;
  }
  if (releasing) {
    if (role === "exhaust" || role === "event" || role === "environment") return phase.releaseCharacter;
    if (role === "intake" || role === "boost") return 0.28;
    return 0.68;
  }
  if (accelerating) {
    if (role === "intake" || role === "exhaust" || role === "boost" || role === "mechanical" || role === "motor") {
      return phase.accelerationTexture;
    }
    if (role === "event") return Math.min(1, phase.accelerationTexture);
    return 1;
  }
  if (role === "core" || role === "combustion" || role === "motor") {
    return 0.82 + phase.cruiseIntrusiveScale * 0.18;
  }
  return phase.cruiseIntrusiveScale;
}

/**
 * Improved multi-layer synthesis path. Original SoundEngine remains for A/B.
 * Layers feed the existing body / accents / beds environment buses.
 */
export class ImprovedSynth {
  private layers: LayerHandle[] = [];
  private tracker: MotionTracker = createMotionTracker();
  private soloId: string | null = null;
  private muted = new Set<string>();
  private mutedRoles = new Set<AudioLayerRole>();
  private profile: SoundProfile | null = null;
  private experience: ProfileExperienceConfig | null = null;
  private experienceEnabled = true;

  setExperienceEnabled(enabled: boolean) {
    this.experienceEnabled = enabled;
  }

  build(ctx: BaseAudioContext, profile: SoundProfile, buses: StrategyBuses): boolean {
    this.dispose();
    this.profile = profile;
    this.experience = profileExperienceConfig(profile.id);
    this.tracker = createMotionTracker();
    const strategy = getStrategy(profile.id);
    if (!strategy) return false;
    this.layers = strategy.build(ctx, buses, profile);
    this.applySoloMute();
    return true;
  }

  update(state: DriveState, audioTime: number) {
    if (!this.profile || !this.layers.length) return;
    const motion = motionFromDrive(state, this.profile, this.tracker, audioTime);
    this.layers.forEach((layer) => {
      layer.update(motion, audioTime);
      if (this.experience && this.experienceEnabled) {
        const role = inferLayerRole(layer.id);
        layer.setIdentityGain?.(
          phaseRoleGain(role, motion, this.experience),
          audioTime,
          this.experience.transitionTauSeconds,
        );
      }
    });
  }

  listLayers(): LayerDebugInfo[] {
    return this.layers.map((l) => ({
      id: l.id,
      muted: this.muted.has(l.id) || this.mutedRoles.has(inferLayerRole(l.id)),
      role: inferLayerRole(l.id),
      ...(typeof l.trigger === "function" ? { triggerable: true } : {}),
    }));
  }

  triggerLayer(id: string) {
    this.layers.find((l) => l.id === id)?.trigger?.();
  }

  setLayerMuted(id: string, muted: boolean) {
    if (muted) this.muted.add(id);
    else this.muted.delete(id);
    this.layers.find((l) => l.id === id)?.setMuted(muted);
  }

  setRoleMuted(role: AudioLayerRole, muted: boolean) {
    if (muted) this.mutedRoles.add(role);
    else this.mutedRoles.delete(role);
    this.applySoloMute();
  }

  setSolo(id: string | null) {
    this.soloId = id;
    this.applySoloMute();
  }

  private applySoloMute() {
    const solo = this.soloId;
    this.layers.forEach((layer) => {
      layer.setMuted(this.muted.has(layer.id) || this.mutedRoles.has(inferLayerRole(layer.id)));
      if (solo === null) layer.setSoloed(null);
      else layer.setSoloed(layer.id === solo);
    });
  }

  dispose() {
    this.layers.forEach((l) => l.dispose());
    this.layers = [];
    this.profile = null;
    this.experience = null;
    this.soloId = null;
    this.muted.clear();
    this.mutedRoles.clear();
  }
}
