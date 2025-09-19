import React from "react";

const PUBLIC_VAPID_KEY = "same as server";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeUser() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Push not supported here!");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw-push.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Permission denied!");
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    });

    await fetch("http://localhost:4000/subscribe", {
      method: "POST",
      body: JSON.stringify(sub),
      headers: { "Content-Type": "application/json" },
    });

    alert("Subscribed!!");
  } catch (err) {
    console.error("Error subscribing:", err);
    alert("Error subscribing: check the console.");
  }
}

export default function App() {
  return (
    <div>
      <h1>App 4 — Push Real (VAPID)</h1>
      <p>Subscribe in push notifications.</p>
      <button onClick={subscribeUser}>Subscribe to push!</button>
      <p>(After subscribind, server will push every 10 seconds)</p>
    </div>
  );
}
