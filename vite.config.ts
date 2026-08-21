// Hosted TanStack Start Vite preset already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
// npm package id remains @lovable.dev/vite-tanstack-config (required by the preset registry).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    server: {
      // Dedicated local URL. Avoid 8080 (often taken by other stacks) and hopping 8081+.
      port: 5173,
      strictPort: true,
    },
  },
});
