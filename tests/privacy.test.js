import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function files(dir = root, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "test-results") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) files(full, out);
    else if (/\.(html|js|json|xml|txt|css|md)$/.test(name)) out.push(full);
  }
  return out;
}

test("public files do not name a person or a personal booking link", () => {
  const banned = [/matthew-beagle/i, /calendly\.com/i, /\bJules\b/, /jules@/i];
  for (const file of files()) {
    if (file.endsWith("privacy.test.js")) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of banned) {
      assert.equal(pattern.test(text), false, `${path.relative(root, file)} matches ${pattern}`);
    }
  }
});
