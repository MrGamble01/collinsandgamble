// Static server with the same clean URLs and 404 page Vercel serves.
// Used by the browser tests. No dependencies.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  if (decoded.includes("\0")) return null;
  const rel = decoded.replace(/^\/+/, "");
  const candidates = rel === ""
    ? ["index.html"]
    : [rel, rel + ".html", path.join(rel, "index.html")];
  for (const candidate of candidates) {
    const full = path.resolve(root, candidate);
    if (!full.startsWith(root + path.sep) && full !== root) continue;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

const hostedHeaders = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"))
  .headers.find((rule) => rule.source === "/(.*)")
  .headers
  .reduce((acc, header) => {
    acc[header.key] = header.value;
    return acc;
  }, {});

function send(res, status, type, body, method, extra = {}) {
  res.writeHead(status, { ...hostedHeaders, "Content-Type": type, ...extra });
  res.end(method === "HEAD" ? undefined : body);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "text/plain; charset=utf-8", "Method not allowed", req.method, { Allow: "GET, HEAD" });
    return;
  }
  const file = resolveFile(req.url || "/");
  if (!file) {
    send(res, 404, "text/html; charset=utf-8", fs.readFileSync(path.join(root, "404.html")), req.method);
    return;
  }
  const body = fs.readFileSync(file);
  send(res, 200, types[path.extname(file)] || "application/octet-stream", body, req.method);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`static server http://127.0.0.1:${port}`);
});
