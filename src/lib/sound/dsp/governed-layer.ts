/**
 * Wrap a tonal (whistle-like) layer so it only swells briefly: it plays through a gain that the
 * whistle governor drives (swell on launch/surge, low floor otherwise, ducked under thrust).
 * At standstill the layer keeps its authored level.
 */
import type { LayerHandle } from "@/lib/sound/dsp/layers";
import { rocketLoad } from "@/lib/sound/dsp/rocket-layer";
import { targetParam } from "@/lib/sound/dsp/smoother";
import { createWhistleGovernor, type WhistleGovernorOpts } from "@/lib/sound/dsp/whistle-governor";
import { clamp } from "@/lib/sound/dsp/math";

export function createGovernedLayer(
  ctx: BaseAudioContext,
  destination: AudioNode,
  build: (dest: AudioNode) => LayerHandle,
  opts: WhistleGovernorOpts,
): LayerHandle {
  const gate = ctx.createGain();
  gate.gain.value = 1;
  gate.connect(destination);
  const inner = build(gate);
  const gov = createWhistleGovernor(opts);
  let load = 0;
  let armed = true;
  return {
    ...inner,
    update(m, t) {
      inner.update(m, t);
      const target = rocketLoad(m);
      const dt = Math.max(0.001, Math.min(0.1, m.dt || 1 / 60));
      load += (target - load) * (1 - Math.exp(-dt / (target > load ? 0.18 : 0.9)));
      if (armed && target >= 0.4) {
        gov.trigger(t, 1);
        armed = false;
      } else if (target < 0.25) {
        armed = true;
      }
      const moving = clamp((m.speedKmh - 2) / 5);
      targetParam(gate.gain, gov.factor(t, load, moving), t, 0.25);
    },
    dispose() {
      inner.dispose();
      gate.disconnect();
    },
  };
}
