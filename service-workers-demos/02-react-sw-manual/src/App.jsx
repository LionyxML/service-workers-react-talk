import { useState } from "react";
import "./App.css";
import { useEffect } from "react";

function App() {
  const [quote, setQuote] = useState("Loading...");

  useEffect(() => {
    fetch("https://official-joke-api.appspot.com/random_joke")
      .then((r) => r.json())
      .then((j) => setQuote(`${j?.setup} - ${j?.punchline}`))
      .catch(() => setQuote("⚡ Using cache/fallback."));
  }, []);

  function askPermission() {
    if ("Notification" in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted")
          alert(
            "Notifications permission granted! Do not forget to check your OS system settings in order to have Notifications REALLY enabled!",
          );
        else alert("Notifications permissions denied.");
      });
    } else alert("Your browser doesn't support notifications.");
  }

  async function scheduleSendData() {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      try {
        await reg.sync.register("send-form");
        alert("Scheduled sending. Will be executed when back online.");
      } catch (err) {
        alert("Error scheduling: " + err);
      }
    } else {
      alert("Background Sync not supported in this browser.");
    }
  }

  return (
    <>
      <h1>App2 - Manual Service Worker</h1>
      <h2>(Cache + Sync + Push demo)</h2>
      <div className="card">
        <p>{quote}</p>
        <button onClick={() => window.location.reload()}>Reload Page</button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <button onClick={scheduleSendData}>
          Schedule Data Sending (Background Sync)
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <button onClick={askPermission} style={{ marginLeft: 8 }}>
          Turn ON Notifications
        </button>{" "}
        and PUSH a message on Application-&gt;SystemWorkers
      </div>
    </>
  );
}

export default App;
