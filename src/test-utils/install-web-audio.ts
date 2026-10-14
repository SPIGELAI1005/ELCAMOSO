/**
 * Test-only Web Audio polyfill for vitest's node environment.
 *
 * Installs the node-web-audio-api implementation (OfflineAudioContext and the
 * node constructors) on globalThis when the runtime does not provide them, so
 * offline-render tests actually execute instead of being skipped.
 * Import this only from *.test.ts files — it is never bundled into the app.
 */
import * as webAudio from "node-web-audio-api";

const target = globalThis as Record<string, unknown>;
for (const [name, value] of Object.entries(webAudio)) {
  if (typeof value !== "function") continue;
  if (target[name] === undefined) target[name] = value;
}

export const hasOfflineAudioContext = typeof target.OfflineAudioContext === "function";
