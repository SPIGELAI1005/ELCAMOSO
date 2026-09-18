import { describe, expect, it } from "vitest";

import { createAudioLifecycleHarness } from "./testing/lifecycle-harness";
import { createFusionMixer } from "@/lib/fusion/mixer";
import { createHarmonicResonance } from "@/lib/fusion/harmonic-resonance";
import { createStemPlayer } from "@/lib/symphony/stem-player";
import { createMusicClock } from "@/lib/symphony/music-clock";
import { CINEMATIC_ROCK_PACK } from "@/lib/symphony";
import { createWorldLayerPlayer } from "@/lib/worlds/layer-player";
import { SPACE_DRIVE_PACK } from "@/lib/worlds";

interface DisposableInterpretation {
  dispose(): void;
}

describe("unified Web Audio lifecycle", () => {
  it("leaves no connected nodes or running sources across experience switches", () => {
    const harness = createAudioLifecycleHarness();
    let active: DisposableInterpretation | null = null;

    const switchTo = (createNext: () => DisposableInterpretation) => {
      active?.dispose();
      expect(harness.snapshot().connectedNodes).toBe(0);
      expect(harness.snapshot().runningSources).toBe(0);
      active = createNext();
      expect(harness.snapshot().connectedNodes).toBeGreaterThan(0);
    };

    switchTo(() => harness.createEngineVoice());

    const buffers = new Map(
      CINEMATIC_ROCK_PACK.stems.map((stem) => [
        stem.id,
        harness.context.createBuffer(1, 64, harness.context.sampleRate),
      ]),
    );
    const clock = createMusicClock(CINEMATIC_ROCK_PACK, 0);
    switchTo(() => {
      const symphony = createStemPlayer(
        harness.context,
        harness.destination,
        CINEMATIC_ROCK_PACK,
        clock,
        42,
        buffers,
      );
      symphony.start(0);
      return symphony;
    });

    switchTo(() => {
      const world = createWorldLayerPlayer(
        harness.context,
        harness.destination,
        SPACE_DRIVE_PACK,
        42,
      );
      world.start(0);
      return world;
    });

    switchTo(() => {
      const mixer = createFusionMixer(harness.context, harness.destination);
      const resonance = createHarmonicResonance(harness.context, mixer.machine, "D minor");
      return {
        dispose() {
          resonance.dispose();
          mixer.dispose();
        },
      };
    });

    active?.dispose();
    expect(harness.snapshot()).toMatchObject({ connectedNodes: 0, runningSources: 0 });
  });
});
