const CACHE_NAME = "app-cache-v1";
const URLS_TO_PRECACHE = ["/", "vite.svg"];

// ---------- SW INIT
self.addEventListener("install", (event) => {
  console.log("🔧 [SW] install");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_PRECACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("🔧 [SW] activate");
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
        ),
      ),
  );
  self.clients.claim();
});

// ---------- SW USAGE 1 - Caching app for offline usage
self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cachedResp) => {
      if (cachedResp) return cachedResp;
      return fetch(req)
        .then((networkResp) => {
          if (
            req.method === "GET" &&
            networkResp &&
            networkResp.status === 200 &&
            // NOTE: For testing porpouses, comment this condition, and check:
            //       - 1.) It will cache the api call (make app offline and reload to check it)
            //             Turn the network back online.
            //       - 2.) Click on "refresh", a new fetch will occur with a new quote.
            //       - 3.) Refresh the page: you will see the first cached quote.
            //             This is how our service works, by trying to get cached data first.
            //             This is entire up to the developer, you could have a rule in which
            //             only self data is cached, foregin data would need the user to be offline
            //             before it hits cache.
            //             Exercise: try to do it here.
            req.url.startsWith(self.location.origin)
          ) {
            const copy = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResp;
        })
        .catch(() => {
          if (
            req.headers.get("accept") &&
            req.headers.get("accept").includes("text/html")
          ) {
            return caches.match("/index.html");
          }
          return new Response("You're offline, this resouce is not cached!", {
            status: 503,
          });
        });
    }),
  );
});

// ---------- SW USAGE 2 - Background Sync Handler
self.addEventListener("sync", (event) => {
  if (event.tag === "send-form") {
    event.waitUntil(sendPendingData());
  }
});

function sendPendingData() {
  return fetch("/api/save", {
    method: "POST",
    body: JSON.stringify({ msg: "Example data!!!!" }),
    headers: { "Content-Type": "application/json" },
  })
    .then(() => {
      console.log("[SW] Data sent on background!");
    })
    .catch((err) => {
      console.log("[SW] Failed to send data on background: ", err);
    });
}

// ---------- SW USAGE 3 - Push Handler
self.addEventListener("push", (event) => {
  console.log("🔔 [SW] Push event received:", event);

  let title = "Default title";
  let body = "Hello from fake push";

  if (event.data) {
    try {
      // Data example: { "title": "🚀 From DevTools", "body": "This simulates a server push" }

      const parsed = JSON.parse(event.data.text());
      title = parsed.title || title;
      body = parsed.body || body;
    } catch {
      body = event.data.text();
    }
  }

  const options = {
    body,
    icon: "/vite.svg",
    badge: "/vite.svg",
  };

  const delayedNotification = new Promise((resolve) => {
    setTimeout(() => {
      console.log("HELLO");
      self.registration.showNotification(title, options).then(resolve);
    }, 5000);
  });

  event.waitUntil(delayedNotification);
});
