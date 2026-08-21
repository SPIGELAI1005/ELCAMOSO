// Hosted TanStack Start Vite preset already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, nitro: { ... } }) if needed.
// npm package id remains @lovable.dev/vite-tanstack-config (Lovable-origin preset).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Default Nitro target in this preset is Cloudflare. Pin Vercel so deploy serves routes
  // instead of returning platform 404 NOT_FOUND.
  nitro: {
    preset: "vercel",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-router",
        "@tanstack/react-query",
      ],
    },
    server: {
      // Dedicated local URL. Avoid 8080 (often taken by other stacks) and hopping 8081+.
      port: 5173,
      strictPort: true,
      // Keep HMR on the same origin as the page (avoids failed websocket + stale modules).
      host: "localhost",
    },
  },
});
