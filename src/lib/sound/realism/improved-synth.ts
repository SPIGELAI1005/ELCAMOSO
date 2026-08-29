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

/**
 * Improved multi-layer synthesis path. Original SoundEngine remains for A/B.
 * Layers feed the existing body / accents / beds environment buses.
 */
export class ImprovedSynth {
  private layers: LayerHandle[] = [];
  private tracker: MotionTracker = createMotionTracker();
  private soloId: string | null = null;
  private muted = new Set<string>();
  private profile: SoundProfile | null = null;

  build(ctx: BaseAudioContext, profile: SoundProfile, buses: StrategyBuses): boolean {
    this.dispose();
    this.profile = profile;
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
    this.layers.forEach((layer) => layer.update(motion, audioTime));
  }

  listLayers(): LayerDebugInfo[] {
    return this.layers.map((l) => ({
      id: l.id,
      muted: this.muted.has(l.id),
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

  setSolo(id: string | null) {
    this.soloId = id;
    this.applySoloMute();
  }

  private applySoloMute() {
    const solo = this.soloId;
    this.layers.forEach((layer) => {
      layer.setMuted(this.muted.has(layer.id));
      if (solo === null) layer.setSoloed(null);
      else layer.setSoloed(layer.id === solo);
    });
  }

  dispose() {
    this.layers.forEach((l) => l.dispose());
    this.layers = [];
    this.profile = null;
    this.soloId = null;
    this.muted.clear();
  }
}
