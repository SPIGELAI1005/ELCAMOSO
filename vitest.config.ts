import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Gating tests assert real Drive+ behaviour: keep the testing unlock off and
    // simulate a post-gate "now" (gate = 9 Nov 2026 Europe/Berlin). Tests that
    // pass an explicit `now` are unaffected; see sound-tier-gate.test.ts.
    env: { VITE_UNLOCK_ALL_SOUNDS: "false", VITE_SOUND_GATE_SIMULATE_NOW: "2026-11-15T12:00:00Z" },
  },
});
