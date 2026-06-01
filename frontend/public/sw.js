// Service Worker mínimo para que el sitio califique como PWA instalable.
// No cachea streams ni la API (no queremos servir video offline).
const CACHE_NAME = "televix-shell-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Nunca interceptar API ni recursos de video
  if (url.pathname.startsWith("/api/")) return;
  // Pasar todo a la red (no offline cache de assets dinámicos)
  // Solo respondemos del cache si la red falla en la navegación raíz
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
  }
});
