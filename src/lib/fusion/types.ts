/** Fusion = Engine (machine) + Symphony (music) on one AudioContext. */

export interface FusionPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  machineProfileId: string;
  symphonyProfileId: string;
  /** 0 = machine, 1 = music. Default ~0.6 music. */
  defaultMix: number;
  /** Optional harmonic resonance depth 0..1 */
  harmonicResonance: number;
  /** Soft sidechain only when true (avoid dance pumping by default). */
  softPump: boolean;
}

/** User-saved Fusion blend stored in settings / Garage. */
export interface SavedFusionPreset {
  id: string;
  name: string;
  machineProfileId: string;
  symphonyProfileId: string;
  mix: number;
  harmonicResonance: number;
  createdAt: number;
}

export interface FusionMixGains {
  machine: number;
  music: number;
  atmosphere: number;
  events: number;
}

export interface FusionDiagnostics {
  presetId: string | null;
  mix: number;
  machineGain: number;
  musicGain: number;
  harmonicDepth: number;
  energy: number;
  movementState: string;
  machineBackend: string | null;
  symphonyActive: boolean;
}
