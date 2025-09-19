self.addEventListener("push", (event) => {
  let data = { title: "No Data", body: "No Body" };
  try {
    data = event.data ? event.data.json() : data;
  } catch (e) {
    data = {
      title: "New Notification",
      body: event.data ? event.data.text() : "...",
    };
  }
  const options = { body: data.body, icon: "/vite.svg" };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(this.clients.openWindow("/"));
});
