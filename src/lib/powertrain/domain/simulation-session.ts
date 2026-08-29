import type { VehicleMotionState } from "@/lib/motion/types";
import {
  createSimulatorRuntime,
  motionFromSimulator,
  stepSimulatorControls,
  type SimulatorControls,
  type SimulatorPhysicsOptions,
  type SimulatorRuntime,
} from "@/lib/powertrain/dev-simulator";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";

export interface SimulationTickResult {
  controls: SimulatorControls;
  motion: VehicleMotionState;
  powertrain: VirtualPowertrainState;
}

/** Developer-facing session: sliders → motion → powertrain. No audio, no vehicle sensors. */
export class PowertrainSimulationSession {
  private sim: PowertrainSimulator;
  private runtime: SimulatorRuntime;
  private clockMs = 0;

  constructor(profile: PowertrainProfile | string, physics?: Partial<SimulatorPhysicsOptions>) {
    this.sim = new PowertrainSimulator(
      typeof profile === "string" ? { profileId: profile } : { profile },
    );
    this.runtime = createSimulatorRuntime(undefined, {
      integrateSpeed: physics?.integrateSpeed ?? true,
      maxAccelMs2: physics?.maxAccelMs2 ?? 4.2,
      maxBrakeMs2: physics?.maxBrakeMs2 ?? 7.5,
    });
  }

  getProfile(): PowertrainProfile {
    return this.sim.getProfile();
  }

  setProfile(profile: PowertrainProfile | string) {
    this.sim.setProfile(profile);
  }

  reset(
    controls: SimulatorControls = { speedKmh: 0, accelerationMs2: 0, throttle: 0, braking: 0 },
  ) {
    this.sim.reset();
    this.runtime = createSimulatorRuntime(controls);
    this.clockMs = 0;
  }

  tick(controls: SimulatorControls, dt: number, integrateSpeed = true): SimulationTickResult {
    const dtSafe = Math.min(0.1, Math.max(0.001, dt));
    this.clockMs += dtSafe * 1000;

    let nextControls = controls;
    if (integrateSpeed && this.runtime.physics.integrateSpeed) {
      nextControls = stepSimulatorControls(this.runtime, controls, dtSafe);
    }

    const motion = motionFromSimulator(nextControls, this.runtime, this.clockMs, dtSafe);
    const powertrain = this.sim.tick(motion, dtSafe, {
      directThrottle: nextControls.throttle,
      braking: nextControls.braking,
    });

    return { controls: nextControls, motion, powertrain };
  }
}

export function createSimulationSession(
  profileId = getPowertrainProfile("gt-v8").id,
): PowertrainSimulationSession {
  return new PowertrainSimulationSession(profileId);
}
