import React, { useEffect, useState } from "react";

import "./App.css";

export default function App() {
  const [quote, setQuote] = useState("Loading...");
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Load a joke (cached by the SW if available)
    fetch("https://official-joke-api.appspot.com/random_joke")
      .then((r) => r.json())
      .then((j) => {
        if (!mounted) return;
        setQuote(`${j?.setup} — ${j?.punchline}`);
      })
      .catch(() => {
        if (!mounted) return;
        setQuote("⚡ Using cache/fallback or offline.");
      });

    // Register service worker (public/sw.js)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg);
          setSwRegistered(true);

          // Optional: listen for updates (log-only)
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              console.log("SW state:", installing.state);
            });
          });
        })
        .catch((err) => {
          console.error("SW registration failed:", err);
        });
    } else {
      console.warn("Service Worker not supported in this browser.");
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Request notifications permission
  async function askPermission() {
    if (!("Notification" in window)) {
      alert("This browser doesn't support notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      alert("Notifications permission granted!");
    } else {
      alert("Notifications permission denied.");
    }
  }

  // Trigger a test notification (via the registered SW)
  async function testNotification() {
    if (!("Notification" in window)) {
      alert("Notifications not supported");
      return;
    }
    if (Notification.permission !== "granted") {
      alert(
        'Grant notification permission first (click "Turn ON Notifications")',
      );
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;

      await reg.showNotification("Test notification", {
        body: "This notification was created from the page via the SW registration.",
        icon: "/vite.svg",
        badge: "/vite.svg",
      });
    } catch (err) {
      console.error(err);
      alert("Could not show notification: " + err);
    }
  }

  // POST to /api/save — Workbox will queue this when offline (see sw.js)
  async function scheduleSendData() {
    const endpoint = "https://httpbin.org/post";
    const payload = { joke: quote, ts: Date.now() };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Sent to server (server responded OK).");
      } else {
        const text = await res.text().catch(() => res.statusText);
        alert("Server responded: " + res.status + " — " + text);
      }
    } catch (err) {
      // Network error -> Workbox Background Sync plugin will queue the request for replay
      console.warn(
        "Network error while POSTing; request should be queued by SW",
        err,
      );
      alert(
        "Network error — request should be queued and retried when online.",
      );
    }
  }

  return (
    <div>
      <h1>App 3 - Workbox demo</h1>

      <div className="card">
        <p>{quote}</p>
      </div>

      <div className="card">
        <button onClick={() => window.location.reload()}>Reload page</button>
      </div>

      <div className="card">
        <button onClick={scheduleSendData}>
          Schedule Data Sending (Background Sync)
        </button>
      </div>

      <div className="card">
        <button onClick={askPermission}>Turn ON Notifications</button>
      </div>

      <div className="card">
        <button onClick={testNotification}>Test Notification (via SW)</button>
      </div>

      <p style={{ marginTop: 18, color: "#666", fontSize: 13 }}>
        SW registered: <strong>{swRegistered ? "yes" : "no"}</strong>. Looking
        for: <code>public/sw.js</code> at site root.
      </p>
    </div>
  );
}
