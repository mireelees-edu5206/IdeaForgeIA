/* Cachea recursos del shell offline y excluye la API privada. */
// Versionar estas constantes fuerza una caché nueva cuando cambia el shell.
const CACHE_PREFIX = "ideaforge-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/app-icon.svg",
];
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);

self.addEventListener("install", (event) => {
  // Prepara solo recursos publicos y toma control tras descargar el shell.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Borra versiones anteriores de esta app sin tocar cachés de otros sitios.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Solo GET publicos: nunca interceptar respuestas privadas o solicitudes autenticadas.
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("Authorization")) return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/service-worker.js"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    // La pagina offline es el respaldo de navegacion; no sustituye datos de la API.
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/offline.html")) ?? Response.error()),
    );
    return;
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) return;

  // Devuelve primero una copia local y actualiza el recurso estatico en segundo plano.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const refresh = fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          void cache.put(request, response.clone());
        }
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => undefined));
        return cached;
      }
      return refresh;
    }),
  );
});
