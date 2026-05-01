const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const nodeEnv = process.env.NODE_ENV || "development";
const isDev = nodeEnv !== "production";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const sendError = (res, statusCode, message) => {
  const isJsonError = message && typeof message === "object";
  if (isJsonError) {
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: message.error || "Error" }));
  } else {
    res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(message || "Error");
  }
};

http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/healthz") {
    const payload = { status: "ok", uptime: process.uptime() };
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(payload));
    return;
  }

  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(root, requestPath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(root)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  fs.stat(resolvedPath, (error, stats) => {
    if (error) {
      if (requestPath.startsWith("/api/")) {
        sendError(res, 404, { error: "Not found" });
      } else {
        serveFile(path.join(root, "/index.html"));
      }
      return;
    }

    if (stats.isDirectory()) {
      if (requestPath.startsWith("/api/")) {
        sendError(res, 404, { error: "Not found" });
      } else {
        serveFile(path.join(root, "/index.html"));
      }
      return;
    }

    serveFile(resolvedPath);
  });

  function serveFile(filePath) {
    const contentType = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": contentType === "text/html; charset=utf-8" ? "no-cache" : "public, max-age=3600",
    };

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => {
      if (!res.headersSent) {
        sendError(res, 500, "Server error");
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }
}).listen(port, host, () => {
  if (isDev) {
    console.log(`M3R Torrent running at http://${host}:${port}`);
  }
});
