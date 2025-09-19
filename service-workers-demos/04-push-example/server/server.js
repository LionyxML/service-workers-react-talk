const express = require("express");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const cors = require("cors");
const app = express();
const PORT = 4000;

app.use(cors());
app.use(bodyParser.json());

// GENERATE YOUR OWN:
// npx web-push generate-vapid-keys
const publicVapidKey = "";
const privateVapidKey = "";

webpush.setVapidDetails(
  "mailto:yourmail@example.com", // or https site
  publicVapidKey,
  privateVapidKey,
);

let subscriptions = [];

app.post("/subscribe", (req, res) => {
  const sub = req.body;
  subscriptions.push(sub);
  console.log(
    "New subscription:",
    sub.endpoint ? sub.endpoint.slice(0, 60) : sub,
  );
  res.status(201).json({ ok: true });
});

function sendToAll(payload) {
  subscriptions.forEach((sub) => {
    webpush.sendNotification(sub, JSON.stringify(payload)).catch((err) => {
      console.error("Error sending push", err);
    });
  });
}

setInterval(() => {
  if (subscriptions.length > 0) {
    console.log(`Sending a push to ${subscriptions.length} registered devices`);
    sendToAll({
      title: "Server ping!",
      body: "Pushing each 10 seconds",
    });
  }
}, 10_000);

app.listen(PORT, () =>
  console.log(`Push server running on http://localhost:${PORT}`),
);
