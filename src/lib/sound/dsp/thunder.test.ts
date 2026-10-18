import { describe, expect, it } from "vitest";
import { getBassEnhancerConfig } from "./bass-enhancer";
import { createLiftOffThunder, ROCKET_LIFTOFF_THUNDER } from "./liftoff-thunder";

function fakeParam() {
  return {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  };
}
function fakeNode() {
  return {
    frequency: fakeParam(),
    gain: fakeParam(),
    Q: fakeParam(),
    type: "",
    buffer: null,
    loop: false,
    onended: null,
    connect(n: unknown) {
      return n;
    },
    disconnect() {},
    start() {},
    stop() {},
  };
}
function fakeCtx(): BaseAudioContext {
  return {
    sampleRate: 48000,
    createBuffer: (ch: number, len: number) => ({
      length: len,
      numberOfChannels: ch,
      getChannelData: () => new Float32Array(len),
    }),
    createOscillator: fakeNode,
    createGain: fakeNode,
    createBiquadFilter: fakeNode,
    createBufferSource: fakeNode,
  } as unknown as BaseAudioContext;
}

describe("decel thunder config", () => {
  it("gives the non-recorded combustion cars decel-only thunder", () => {
    for (const id of ["racing-v10", "race-car", "flat-six-sport", "turbo-inline-6", "rally-car"]) {
      const cfg = getBassEnhancerConfig(id);
      expect(cfg?.decelOnly).toBe(true);
      expect(cfg?.neutralAtRest).toBe(true);
      expect(cfg!.liftOffBoost).toBeGreaterThan(0);
      expect(cfg!.subLowHz).toBeGreaterThanOrEqual(34);
    }
  });
  it("leaves the recorded V8s on their own config", () => {
    expect(getBassEnhancerConfig("american-muscle-v8")?.decelOnly).toBeFalsy();
    expect(getBassEnhancerConfig("gt-v8")?.decelOnly).toBeFalsy();
  });
});

describe("lift-off thunder", () => {
  it("fires once when slowing after real thrust, not while cruising", () => {
    const th = createLiftOffThunder(fakeCtx(), fakeNode() as unknown as AudioNode, ROCKET_LIFTOFF_THUNDER);
    let v = 0;
    let t = 0;
    const step = (load: number, accel: number, secs: number) => {
      for (let i = 0; i < secs * 50; i++) {
        t += 0.02;
        v += accel * 0.02;
        th.update(load, v, t);
      }
    };
    step(0, 0, 2);
    expect(th.fired).toBe(0);
    step(0.6, 2.5, 5); // thrust
    step(0.1, 0, 3); // cruise
    expect(th.fired).toBe(0);
    step(0, -2, 3); // lift and slow
    expect(th.fired).toBe(1);
    step(0, -2, 6);
    expect(th.fired).toBe(1);
  });
});
