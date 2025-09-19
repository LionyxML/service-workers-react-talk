/* global workbox importScripts */

/*
  Workbox service worker.
  - Put this file in /public so it's served at /sw.js
  - Uses Workbox CDN (no build-time wiring needed). If you prefer build-time precache
    (recommended for production), integrate workbox-build or vite-plugin-pwa and
    keep precacheAndRoute(self.__WB_MANIFEST).
*/

importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js",
);

if (!self.workbox) {
  console.warn("Workbox failed to load; falling back to basic fetch handling.");
}

try {
  // Optional: make debugging easier during development
  workbox.setConfig({ debug: false });

  // Precaching (if you use a build step that injects __WB_MANIFEST)
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // ---------- Activate immediately after install
  self.addEventListener("install", () => {
    self.skipWaiting();
  });
  self.addEventListener("activate", (evt) => {
    evt.waitUntil(self.clients.claim());
  });

  // ---------- SPA navigation route (NetworkFirst)
  workbox.routing.registerRoute(
    ({ request }) => request.mode === "navigate",
    new workbox.strategies.NetworkFirst({
      cacheName: "html-shell",
      networkTimeoutSeconds: 3,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({ maxEntries: 10 }),
      ],
    }),
  );

  // ---------- Official Joke API: StaleWhileRevalidate
  workbox.routing.registerRoute(
    ({ url }) => url.origin === "https://official-joke-api.appspot.com",
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "api-jokes-cache",
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 60 * 60,
        }), // 1 hour
      ],
    }),
  );

  // ----------  Static assets: CSS/JS/Workers (StaleWhileRevalidate)
  workbox.routing.registerRoute(
    ({ request }) =>
      ["style", "script", "worker"].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "static-resources",
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({ maxEntries: 60 }),
      ],
    }),
  );

  // ---------- Images: CacheFirst
  workbox.routing.registerRoute(
    ({ request }) => request.destination === "image",
    new workbox.strategies.CacheFirst({
      cacheName: "images-cache",
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }), // 30 days
      ],
    }),
  );

  // ----------  Background Sync: queue failed POSTs
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin(
    "form-queue",
    {
      maxRetentionTime: 24 * 60, // in minutes (24 hours)
    },
  );

  workbox.routing.registerRoute(
    ({ url, request }) => {
      // Match POSTs to our save endpoint (change if your API path differs)
      try {
        return (
          request.method === "POST" &&
          url.origin === "https://httpbin.org" &&
          url.pathname === "/post"
        );
      } catch {
        return false;
      }
    },
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    "POST",
  );

  // ---------- Push notifications handling
  self.addEventListener("push", (event) => {
    let payload = { title: "📩 New message", body: "You have a new message." };
    if (event.data) {
      try {
        payload = event.data.json();
      } catch {
        payload.body = event.data.text();
      }
    }

    const options = {
      body: payload.body,
      icon: payload.icon || "/vite.svg",
      badge: payload.badge || "/vite.svg",
      data: { url: payload.url || "/" },
      actions: payload.actions || [{ action: "open", title: "Open app" }],
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
  });

  // ---------- When user clicks notification
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || "/";

    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientsArr) => {
          for (const client of clientsArr) {
            if (client.url === urlToOpen && "focus" in client) {
              return client.focus();
            }
          }
          if (self.clients.openWindow)
            return self.clients.openWindow(urlToOpen);
        }),
    );
  });

  console.log("Workbox service worker ready.");
} catch (err) {
  console.error("Workbox SW failed to initialize:", err);
}
