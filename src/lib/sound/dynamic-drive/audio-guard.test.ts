import { describe, expect, it } from "vitest";
import { targetLayerGain } from "@/lib/sound/dsp/smoother";

describe("targetLayerGain", () => {
  it("schedules near-silence for inactive layers", () => {
    const calls: { value: number; time: number; tau: number }[] = [];
    const param = {
      value: 0.5,
      setTargetAtTime(value: number, time: number, tau: number) {
        calls.push({ value, time, tau });
      },
    } as AudioParam;

    targetLayerGain(param, 0, 1, 0.07);
    expect(calls[0]?.value).toBeLessThan(0.0001);
  });

  it("schedules audible floor for active layers", () => {
    const calls: { value: number }[] = [];
    const param = {
      value: 0.00001,
      setTargetAtTime(value: number) {
        calls.push({ value });
      },
    } as AudioParam;

    targetLayerGain(param, 0.25, 1, 0.07);
    expect(calls[0]?.value).toBeGreaterThanOrEqual(0.0001);
    expect(calls[0]?.value).toBe(0.25);
  });
});
