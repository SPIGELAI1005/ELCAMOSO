const CACHE = "elcamoso-shell-v6";
const SHELL = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

function isDevModuleRequest(url) {
  const p = url.pathname;
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
      .then((cache) => cache.addAll(SHELL))
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
