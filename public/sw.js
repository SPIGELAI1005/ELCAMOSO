const CACHE = "elcamoso-shell-v13";
// Bump CACHE whenever a file under /sample-packs/recorded/ is replaced at the same URL.
const WORKLET = "/audio/combustion-processor.js";
// Keep in sync with COMBUSTION_WORKLET_VERSION (checked by src/lib/sound/sw-precache.test.ts).
const WORKLET_URL = WORKLET + "?v=2026-10-15a";
// Everything the sound engine fetches at drive start. Cached on install so a drive never
// depends on the network (checked against the folder by sw-precache.test.ts).
const AUDIO = [
  WORKLET_URL,
  "/sample-packs/recorded/beds-v1/dragon.m4a",
  "/sample-packs/recorded/beds-v1/horse.m4a",
  "/sample-packs/recorded/beds-v1/tractor.m4a",
  "/sample-packs/recorded/beds-v1/ufo.m4a",
  "/sample-packs/recorded/debris-v1/grains.wav",
  "/sample-packs/recorded/snorts-v1/snort_4.m4a",
  "/sample-packs/recorded/snorts-v1/snort_6.m4a",
  "/sample-packs/recorded/v3/big_twin_regions.m4a",
  "/sample-packs/recorded/v3/f1_passby_regions.m4a",
  "/sample-packs/recorded/v3/maserati_v8_regions.m4a",
  "/sample-packs/recorded/v3/rover_v8_regions.m4a",
  "/sample-packs/recorded/v3/superbike_hi_regions.m4a",
  "/sample-packs/recorded/v3/superbike_i4_regions.m4a",
];
const SHELL = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

function isDevModuleRequest(url) {
  const p = url.pathname;
  // The worklet URL is versioned with ?v=; it is a production asset, not a Vite module.
  if (p === WORKLET) return false;
  return (
    p.startsWith("/@") ||
    p.startsWith("/src/") ||
    p.startsWith("/node_modules/") ||
    p.includes("/.vite/") ||
    p.endsWith(".tsx") ||
    p.endsWith(".ts") ||
    p.endsWith(".jsx") ||
    p.endsWith(".mjs") ||
    url.searchParams.has("v") ||
    url.searchParams.has("t") ||
    url.searchParams.has("import")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(SHELL).then(() =>
          // Best effort: one failed file must not block the install; it is fetched on demand.
          Promise.all(
            AUDIO.filter((u) => u !== undefined).map((u) =>
              cache.match(u).then((hit) => (hit ? undefined : cache.add(u).catch(() => undefined))),
            ),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("elcamoso-traces") || url.protocol === "indexeddb:") return;
  // Never intercept Vite/HMR or app modules (duplicate React / broken hooks).
  if (isDevModuleRequest(url)) return;

  // Always prefer network for HTML / app navigations so deploys and HMR are visible.
  const isDocument =
    req.mode === "navigate" || (req.headers.get("accept") ?? "").includes("text/html");

  if (isDocument) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Production static shell assets only: cache-first, then network.
  const isShellAsset =
    SHELL.includes(url.pathname) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/favicon.png" ||
    url.pathname.startsWith("/sample-packs/recorded/") ||
    url.pathname === WORKLET ||
    url.pathname === "/sw.js";

  if (!isShellAsset) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    }),
  );
});
