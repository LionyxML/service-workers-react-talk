# Tech Talk: Service Workers with React

## From our last talk...

For context, start reading
[here](https://www.rahuljuliato.com/posts/react-workers/)

Code for Web Workers demo
[here](https://github.com/LionyxML/web-workers-react-talk)

Web Workers vs Shared Workers vs Service Workers:

```
| Feature / Capability             | Web Worker                          | Shared Worker                             | Service Worker*                                   |
|----------------------------------+-------------------------------------+-------------------------------------------+---------------------------------------------------|
| Scope                            | Single page or tab                  | Shared across tabs (same origin)          | Global (entire site, independent of tabs)         |
| Shared across tabs               | No                                  | Yes                                       | Yes                                               |
| Communication                    | `postMessage` (1:1)                 | `port.postMessage` (many:1)               | `postMessage`, `fetch`, Push API, etc.            |
| Persists after closing the tab   | No                                  | No                                        | Yes (managed by the browser)                      |
| Runs on a separate thread        | Yes, background thread              | Yes, background thread                    | Yes, background thread (event-based)              |
| Use case                         | Delegate CPU-heavy tasks            | Coordinate logic between tabs             | Background sync, caching, push notifications      |
| Typical example                  | Image processing, computation       | Reuse database connection                 | Offline applications, push notifications          |
| Memory sharing                   | No (except `SharedArrayBuffer`)     | Yes, via messages between tabs            | No                                                |
| DOM access                       | No                                  | No                                        | No                                                |
| Intercepts network requests      | No                                  | No                                        | Yes (interception with `fetch`)                   |
| Works without a GUI              | No (terminates when the page closes)| No (terminates when the last tab closes)  | Yes                                               |
| Requires secure context (HTTPS)  | No                                  | No                                        | Yes (HTTPS required)                              |
| Can cache resources              | No                                  | No                                        | Yes (via Cache API)                               |
| Browser support                  | Excellent                           | Partial (some browsers do not support)    | Excellent                                         |
```

Summary of use cases:

```
| Use Case                            | Recommended Worker           |
|-------------------------------------+------------------------------|
| Heavy calculations (e.g., Fibonacci)| Web Worker                   |
| Coordination between tabs           | Shared Worker                |
| Offline applications                | Service Worker               |
| Synchronization or notifications    | Service Worker               |
| Sharing DB between tabs             | Shared Worker                |
| Image/audio/video processing        | Web Worker + OffscreenCanvas |
```

## Objective

Explore the use of Service Workers in React applications, demonstrating:

1.  A base SPA, WITHOUT a Service Worker
2.  A SPA with a manual Service Worker
    - Installing and activating the Service Worker
    - Using the Cache API, pre-populating it
    - Caching the app for offline use
    - Caching external calls
    - Notification permissions
    - Simulating Push Notifications
3.  A SPA with Workbox
4.  Push Notifications with Node + VAPID

To make life easier:

- [Web Workers / Shared Workers](https://github.com/GoogleChromeLabs/comlink)
- [Service Workers](https://github.com/GoogleChrome/workbox)

References:

- https://developer.chrome.com/docs/workbox/
- https://developer.chrome.com/docs/workbox/caching-strategies-overview#caching_strategies
- https://developer.chrome.com/docs/workbox/what-is-workbox

---

## 🚀 Introduction: What are Service Workers?

Service Workers are a special type of **Web Worker**, essentially JavaScript scripts that the browser runs in the background, independently of the web page. They act as a **programmable network proxy**, allowing you to intercept and handle network requests, manage response caching, and enable features that were previously exclusive to native applications.

### Key Features:

- **Background Execution:** They operate on their own thread, without blocking the user interface.

- **Independent Lifecycle:** They have their own lifecycle (`install`, `activate`, `fetch`) which is separate from the page. Once installed, it can process events even when your site's tab is not open.

- **Network Proxy:** They can intercept, modify, and respond to any network request made by the page.

- **No DOM Access:** For security and to prevent blocking, Service Workers do not have direct access to the `document` or `window`. Communication with the page is done through the `postMessage` API.

- **Progressive Enhancement:** They are designed to be an enhancement. If the browser does not support them, the application continues to function normally.

### Limitations and Requirements:

- **HTTPS Required:** For security reasons (to prevent _man-in-the-middle_ attacks), Service Workers can only be registered on pages served over HTTPS. The only exception is `localhost`, to facilitate development.

- **Asynchronous by Nature:** All their APIs are based on Promises, ensuring they do not block the main thread.

- **Browser Support:** Although widely supported by modern browsers, it is always good to check for compatibility (`'serviceWorker' in navigator`).

- **State Management:** They do not maintain state between restarts. To persist data, they must use APIs like `Cache` or `IndexedDB`.

---

## Hands-on!

### 1. Standard React Application (No Service Worker)

Our base is a simple React application, created with Vite.

- **Location:** `service-workers-demos/01-react-no-sw/`

- **Functionality:** On each load, it fetches and displays a random joke from the `official-joke-api`.

**Key Code (`src/App.jsx`):**

```javascript
function App() {
  const [quote, setQuote] = useState("Loading...");

  useEffect(() => {
    fetch("https://official-joke-api.appspot.com/random_joke")
      .then((r) => r.json())
      .then((j) => setQuote(`${j?.setup} - ${j?.punchline}`))
      .catch(() => setQuote("❌ Error fetching quote."));
  }, []);

  return (
    <>
      <h1>App1 - Common React App</h1>
      <div className="card">
        <p>{quote}</p>
      </div>
      <button onClick={() => window.location.reload()}>Reload Page</button>
    </>
  );
}
```

**Demonstration:**

1.  Run the application (`pnpm run dev`).

2.  Show that it works online.

3.  Open DevTools, go to the "Network" tab and enable "Offline" mode.

4.  Reload the page. The result will be the Chrome "Dinosaur" error, as the application cannot access the network to fetch its assets or the joke.

---

### 2. Adding a Service Worker Manually

Now, let's add a Service Worker to give our application superpowers, like offline functionality.

- **Location:** `service-workers-demos/02-react-sw-manual/`

#### 2.1. Service Worker Registration

First, we need to register our SW script.

**Key Code (`src/main.jsx` and `src/sw-register.js`):**

```javascript
// src/main.jsx
import { registerSW } from "./sw-register";
// ...
registerSW();

// src/sw-register.js
export function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js") // Registers the SW located in the /public folder
        .then((reg) => console.log(" 🟢 Registered SW:", reg))
        .catch((err) => console.error(" 🔴 Error registering SW:", err));
    });
  }
}
```

#### 2.2. Lifecycle: Installation and Activation

The SW has a lifecycle. In the `install` event, we pre-cache the essential assets of our application. In the `activate` event, we clear old caches.

**Key Code (`public/service-worker.js`):**

```javascript
const CACHE_NAME = "app-cache-v1";
const URLS_TO_PRECACHE = ["/", "vite.svg"]; // App Shell files

// Installation Event
self.addEventListener("install", (event) => {
  console.log("🔧 [SW] install");
  // Waits until the cache is opened and the files are pre-cached
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_PRECACHE)),
  );
  self.skipWaiting(); // Forces the SW to become active immediately
});

// Activation Event
self.addEventListener("activate", (event) => {
  console.log("🔧 [SW] activate");
  // Clears old caches that do not match the current CACHE_NAME
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
        ),
      ),
  );
  self.clients.claim(); // Allows the SW to control open clients immediately
});
```

#### 2.3. Intercepting Requests (Fetch) for Offline

The `fetch` event is the heart of the SW. Here, we intercept requests and decide whether to respond with data from the cache or the network.

**Key Code (`public/service-worker.js`):**

```javascript
self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cachedResp) => {
      // 1. If the response is in the cache, return it.
      if (cachedResp) return cachedResp;

      // 2. If not, fetch from the network.
      return fetch(req)
        .then((networkResp) => {
          // 3. If the network response is valid, clone and store it in the cache.
          if (
            req.method === "GET" &&
            networkResp &&
            networkResp.status === 200 &&
            req.url.startsWith(self.location.origin)
          ) {
            const copy = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResp;
        })
        .catch(() => {
          // 4. If the network fails, return a fallback (e.g., the main page for navigation).
          if (req.headers.get("accept").includes("text/html")) {
            return caches.match("/index.html");
          }
          return new Response("You're offline, this resource is not cached!", {
            status: 503,
          });
        });
    }),
  );
});
```

**Demonstration:**

1.  Run the application.

2.  Go to the "Application" -> "Service Workers" tab in DevTools and show the active SW.

3.  Go to "Cache Storage" and show the pre-cached files.

4.  Put the application in "Offline" mode and reload. The application now works! The joke, however, will show a fallback error, as the request to the external API was not cached by the `req.url.startsWith(self.location.origin)` rule.

#### 2.4. Background Sync

Allows the application to defer an action (like a POST) until the network connection is re-established.

**Key Code (`src/App.jsx` and `public/service-worker.js`):**

```javascript
// src/App.jsx - Scheduling the sync
async function scheduleSendData() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
	const reg = await navigator.serviceWorker.ready;
	await reg.sync.register("send-form"); // Registers a sync event with the tag 'send-form'
	alert("Scheduled sending. Will be executed when back online.");
  }
}

// public/service-worker.js - Listening for the sync event
self.addEventListener("sync", (event) => {
  if (event.tag === "send-form") {
	event.waitUntil(sendPendingData());
  }
});

function sendPendingData() {
  // Logic to resend the data to the server
  return fetch("/api/save", { method: "POST", ... });
}
```

**Demonstration:**

1.  Go offline.

2.  Click the "Schedule Data Sending" button.

3.  Go to the "Application" -> "Background Sync" tab and show the pending tag.

4.  Go online. The SW will try to send the data and the tag will disappear.

#### 2.5. Push Notifications (Simulated)

The SW can receive push messages from a server and display notifications, even with the site closed.

**Key Code (`src/App.jsx` and `public/service-worker.js`):**

```javascript
// src/App.jsx - Asking for permission
function askPermission() {
  Notification.requestPermission().then((perm) => { ... });
}

// public/service-worker.js - Receiving the push
self.addEventListener("push", (event) => {
  console.log("🔔 [SW] Push event received:", event);
  let title = "Default title";
  let body = "Hello from fake push";
  if (event.data) {
	// ... logic to parse the push data
  }
  const options = { body, icon: "/vite.svg" };
  // Displays the notification
  event.waitUntil(self.registration.showNotification(title, options));
});
```

**Demonstration:**

1.  Click "Turn ON Notifications" and accept the permission.

2.  Go to "Application" -> "Service Workers", find the active SW and click the "Push" link.

3.  Send a simulated push message. The notification will appear.

---

### 3. Simplifying with Workbox

Writing a manual SW can be complex and repetitive. Workbox is a Google library that abstracts best practices and simplifies the creation of Service Workers.

- **Location:** `service-workers-demos/03-react-sw-workbox/`

**Key Code (`public/sw.js`):**
Instead of `addEventListener` for `fetch`, we use declarative routes and strategies.

```javascript
/* global workbox */
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js",
);

// Strategy for SPA navigation (tries the network first)
workbox.routing.registerRoute(
  ({ request }) => request.mode === "navigate",
  new workbox.strategies.NetworkFirst({ cacheName: "html-shell" }),
);

// Strategy for the jokes API (uses cache while fetching from the network)
workbox.routing.registerRoute(
  ({ url }) => url.origin === "https://official-joke-api.appspot.com",
  new workbox.strategies.StaleWhileRevalidate({ cacheName: "api-jokes-cache" }),
);

// Strategy for assets (CSS, JS)
workbox.routing.registerRoute(
  ({ request }) => ["style", "script", "worker"].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "static-resources",
  }),
);

// Background Sync with plugin
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin(
  "form-queue",
);
workbox.routing.registerRoute(
  ({ url, request }) => request.method === "POST" && url.pathname === "/post",
  new workbox.strategies.NetworkOnly({ plugins: [bgSyncPlugin] }),
  "POST",
);
```

**Demonstration:**

1.  Show the `sw.js` code and compare its simplicity with the manual SW.

2.  Run the application and repeat the offline and background sync tests. The behavior will be similar, but the implementation code is much cleaner and more robust.

---

### 4. Real Push Notifications with Node.js and VAPID

To send real pushes, we need a server. The VAPID (Voluntary Application Server Identification) protocol allows our server to securely identify itself to the browser's push service.

- **Location:** `service-workers-demos/04-push-example/`

#### Architecture:

- **Client (`client/`):** A React application that asks for permission and subscribes to receive pushes.

- **Server (`server/`):** A Node.js/Express server that stores subscriptions and sends push messages.

**Step-by-Step:**

1.  **Generate VAPID Keys (on the server):**

    ```bash
    npx web-push generate-vapid-keys
    ```

    This generates a public and a private key.

2.  **Configure the Client (`client/src/App.jsx`):**

    - The public VAPID key is used on the client so it can subscribe to the correct push service.

    - The client registers `sw-push.js`.

    - When "Subscribe" is clicked, the client requests the `PushSubscription` from the browser and sends it to our server at the `/subscribe` endpoint.

    ```javascript
    // client/src/App.jsx
    const PUBLIC_VAPID_KEY = "..."; // Generated public key

    async function subscribeUser() {
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
      });

      // Sends the subscription to the server
      await fetch("http://localhost:4000/subscribe", {
        method: "POST",
        body: JSON.stringify(sub),
        headers: { "Content-Type": "application/json" },
      });
    }
    ```

3.  **Configure the Server (`server/server.js`):**

    - Uses the `web-push` library.

    - Configures the VAPID keys (public and private).

    - Creates a `/subscribe` endpoint to receive and store client subscriptions.

    - Periodically (every 10s), sends a notification to all stored subscriptions.

    ```javascript
    // server/server.js
    const webpush = require("web-push");
    const publicVapidKey = "...";
    const privateVapidKey = "...";

    webpush.setVapidDetails(
      "mailto:test@example.com",
      publicVapidKey,
      privateVapidKey,
    );

    let subscriptions = [];

    app.post("/subscribe", (req, res) => {
      const sub = req.body;
      subscriptions.push(sub);
      res.status(201).json({ ok: true });
    });

    setInterval(() => {
      // Sends a push to all subscriptions
      subscriptions.forEach((sub) => {
        webpush.sendNotification(
          sub,
          JSON.stringify({ title: "Server ping!" }),
        );
      });
    }, 10_000);
    ```

4.  **Client's Service Worker (`client/public/sw-push.js`):**

    - It is extremely simple: it just listens for the `push` event and displays the notification with the received data.

    ```javascript
    self.addEventListener("push", (event) => {
      const data = event.data.json();
      self.registration.showNotification(data.title, { body: data.body });
    });
    ```

**Demonstration:**

1.  Start the server (`pnpm run start`).

2.  Start the client (`pnpm run dev`).

3.  Click "Subscribe to push!" and accept the permission.

4.  Show in the server console that a new subscription has been received.

5.  Wait a few seconds. The notification sent by the server will appear on the operating system.
