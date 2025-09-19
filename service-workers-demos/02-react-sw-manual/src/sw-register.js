export function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log(" 🟢 Registered SW:", reg))
        .catch((err) => console.error(" 🔴 Error registering SW:", err));
    });
  }
}
