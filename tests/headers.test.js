import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function siteHeaders() {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const rule = config.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(rule, "catch-all header rule");
  return Object.fromEntries(rule.headers.map((header) => [header.key, header.value]));
}

test("every response sets a content security policy, referrer policy, and permissions policy", () => {
  const headers = siteHeaders();
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(headers["Permissions-Policy"], /geolocation=\(\)/);
  assert.match(headers["Permissions-Policy"], /microphone=\(\)/);
  assert.match(headers["Permissions-Policy"], /camera=\(\)/);
  assert.match(headers["Permissions-Policy"], /payment=\(\)/);
  assert.match(headers["Permissions-Policy"], /usb=\(\)/);

  const csp = headers["Content-Security-Policy"];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src [^;]*'self'/);
  assert.match(csp, /style-src [^;]*'self'/);
  assert.match(csp, /font-src 'self'/);
  assert.match(csp, /img-src [^;]*'self'/);
  assert.match(csp, /connect-src [^;]*'self'/);
  assert.match(csp, /form-action [^;]*mailto:/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(csp.includes("*"), false);
  assert.equal(csp.includes("unsafe-eval"), false);
});

test("the browser server copies those headers from the hosting config", () => {
  const source = fs.readFileSync(path.join(root, "tests/static-server.js"), "utf8");
  assert.match(source, /vercel\.json/);
  assert.match(source, /source === "\/\(\.\*\)"/);
});
