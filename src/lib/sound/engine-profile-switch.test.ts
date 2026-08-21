import { describe, expect, it } from "vitest";
import { IDLE_STATE } from "@/lib/drive/model";
import { SoundEngine } from "@/lib/sound/engine";
import { allProfiles, getProfile } from "@/lib/sound/profiles";

/**
 * Mid-session profile swaps must not throw (Tesla /sounds crash when Listen
 * rebuilt AudioContext while sound was already playing).
 */
describe("SoundEngine profile switch", () => {
  it("crossfades between built-in profiles under OfflineAudioContext", async () => {
    const Offline =
      globalThis.OfflineAudioContext ??
      (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!Offline) {
      expect(true).toBe(true);
      return;
    }

    const ctx = new Offline(2, 48000 * 2, 48000);
    const engine = new SoundEngine();
    const first = getProfile("gt-v8");
    await engine.start(first, { context: ctx, signature: false, seed: 7 });

    const ids = allProfiles()
      .map((p) => p.id)
      .filter((id) => id !== first.id)
      .slice(0, 8);

    for (const id of ids) {
      expect(() => engine.setProfile(getProfile(id), true)).not.toThrow();
      expect(() => engine.update({ ...IDLE_STATE, load: 0.4, throttle: 0.3 })).not.toThrow();
      expect(() => engine.getMeter()).not.toThrow();
    }

    await engine.stop();
  });
});
