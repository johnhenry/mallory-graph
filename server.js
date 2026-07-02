import { serve } from "srvx/node";
import { serveStatic } from "srvx/static";
import handler from "./dist/server/server.js";

const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";

const server = serve({
  port: Number(port),
  hostname: host,
  middleware: [serveStatic({ dir: "./dist/client" })],
  fetch: handler.fetch,
});

console.log(`Server running on http://${host}:${port}`);
