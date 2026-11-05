const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const globalRoute = require("./routes/global");
const visibleRoute = require("./routes/visible");
const passesRoute = require("./routes/passes");

const app = express();
const PORT = 4000;

app.use(cors());

app.use("/global", globalRoute);
app.use("/visible", visibleRoute);
app.use("/passes", passesRoute);

const wsProxy = createProxyMiddleware({
  target: "ws://127.0.0.1:8000",
  changeOrigin: true,
  ws: true,
});

app.use("/ws", wsProxy);

// Bound to localhost only: this gateway now sits behind the main
// backend/server.js (which reverse-proxies /visualizer-api and
// /visualizer-ws to it, behind the site's shared auth_check). It has no
// auth of its own, so it must not be directly reachable from outside —
// the main backend is the only intended path in.
const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`Gateway running on port ${PORT} (localhost only)`);
});

// http-proxy-middleware normally registers its WebSocket upgrade handling
// lazily, off the first HTTP request it sees on the proxied path — which
// means the very first WebSocket connection attempt after each server
// start gets rejected (confirmed: a 403 straight from Express, never
// reaching the proxy) while every subsequent attempt works fine. Wiring
// the upgrade event explicitly, as the library's own docs recommend for
// this exact case, registers it immediately at startup instead.
server.on("upgrade", wsProxy.upgrade);