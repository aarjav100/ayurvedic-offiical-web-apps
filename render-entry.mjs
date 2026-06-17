// Node.js HTTP adapter for the Cloudflare Worker-style server.
// Converts Node.js IncomingMessage/ServerResponse ↔ Web standard Request/Response.
// Usage: node render-entry.mjs

import { createServer } from "node:http";

const port = parseInt(process.env.PORT || "10000", 10);

async function start() {
  const mod = await import("./dist/server/server.js");
  const app = mod.default;

  if (!app || typeof app.fetch !== "function") {
    console.error(
      "dist/server/server.js does not export a default object with a fetch() method.",
      "Exports found:",
      Object.keys(mod)
    );
    process.exit(1);
  }

  const server = createServer(async (nodeReq, nodeRes) => {
    try {
      // Build a web-standard Request from the Node.js request
      const host = nodeReq.headers.host || `localhost:${port}`;
      const url = new URL(nodeReq.url || "/", `http://${host}`);

      const headers = new Headers();
      for (const [key, val] of Object.entries(nodeReq.headers)) {
        if (val)
          headers.set(key, Array.isArray(val) ? val.join(", ") : val);
      }

      const method = (nodeReq.method || "GET").toUpperCase();
      const hasBody = method !== "GET" && method !== "HEAD";

      let body = undefined;
      if (hasBody) {
        body = new ReadableStream({
          start(controller) {
            nodeReq.on("data", (chunk) => controller.enqueue(chunk));
            nodeReq.on("end", () => controller.close());
            nodeReq.on("error", (err) => controller.error(err));
          },
        });
      }

      const request = new Request(url.toString(), {
        method,
        headers,
        body,
        duplex: hasBody ? "half" : undefined,
      });

      // Call the Worker-style fetch handler
      const response = await app.fetch(request, process.env, {
        waitUntil: () => {},
        passThroughOnException: () => {},
      });

      // Convert the web Response back to Node.js
      const resHeaders = {};
      response.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });
      nodeRes.writeHead(response.status, response.statusText, resHeaders);

      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            nodeRes.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      nodeRes.end();
    } catch (error) {
      console.error("Request error:", error);
      if (!nodeRes.headersSent) {
        nodeRes.writeHead(500, { "Content-Type": "text/plain" });
      }
      nodeRes.end("Internal Server Error");
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`✓ Server listening on http://0.0.0.0:${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
