// PYQ-LY service worker — makes the app installable + usable offline.
// Strategy: network-first for page navigations (so a deploy isn't stuck on a
// stale shell, but the app still opens offline from the cached shell), and
// cache-first for the build's hashed static assets. Anything cross-origin
// (Supabase, fonts CDN) or under /api/, /models/, /ort/, /tesseract/ is left to
// the network — we never want to serve a stale model/auth/grouping response.
const CACHE = "pyqly-shell-v1";
const BYPASS = /^\/(api|models|ort|tesseract)\//;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || BYPASS.test(url.pathname)) return;

  // Page loads: try the network, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => { caches.open(CACHE).then((c) => c.put("/", r.clone())).catch(() => {}); return r; })
        .catch(() => caches.match("/").then((c) => c || caches.match(req)))
    );
    return;
  }

  // Hashed static assets: cache-first (new deploys have new URLs, so no staleness).
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok && r.type === "basic") { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {}); }
      return r;
    }))
  );
});
