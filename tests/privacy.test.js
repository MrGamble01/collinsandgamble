import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const denylistPath = path.join(root, "tests/privacy-denylist.txt");

const TEXT = /\.(html|js|json|css|md|xml|txt|svg|yml|webmanifest)$/;
const IMAGE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const CREATOR_IMAGE = /(?:^|\/)(?:creators|clients|roster|headshots|portraits)\//i;
const CREATOR_FILE = /(?:^|\/)(?:creator|client)[-_](?:photo|headshot|portrait|logo)/i;

function denylist() {
  return fs
    .readFileSync(denylistPath, "utf8")
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
}

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root });
  return out.toString().split("\0").filter(Boolean);
}

test("the denylist stays generic", () => {
  const entries = denylist();
  assert.ok(entries.length >= 5);
  for (const entry of entries) {
    assert.match(entry, /^[a-z0-9./_-]+$/, entry);
    assert.ok(entry.length >= 8, entry);
  }
});

test("tracked files do not contain a denylisted marker", () => {
  const entries = denylist();
  const hits = [];
  for (const rel of trackedFiles()) {
    if (rel === "tests/privacy-denylist.txt") continue;
    if (!TEXT.test(rel)) continue;
    const text = fs.readFileSync(path.join(root, rel), "utf8").toLowerCase();
    for (const entry of entries) {
      if (text.includes(entry)) hits.push(`${rel} contains ${entry}`);
    }
  }
  assert.deepEqual(hits, []);
});

test("no creator or client image path is tracked or referenced", () => {
  const hits = [];
  for (const rel of trackedFiles()) {
    const normalized = rel.replaceAll("\\", "/");
    if (IMAGE.test(normalized) && (CREATOR_IMAGE.test(normalized) || CREATOR_FILE.test(normalized))) {
      hits.push(normalized);
    }
    if (!TEXT.test(normalized) || normalized === "tests/privacy-denylist.txt" || normalized === "tests/privacy.test.js") {
      continue;
    }
    const text = fs.readFileSync(path.join(root, normalized), "utf8");
    if (CREATOR_IMAGE.test(text) || CREATOR_FILE.test(text)) hits.push(`${normalized} references a creator image`);
  }
  assert.deepEqual(hits, []);
});
