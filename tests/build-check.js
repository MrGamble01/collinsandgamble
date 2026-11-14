// The site has no compiler. This is the build gate: the files that ship
// have to be the files the pages name, and the share image has to be the
// JPEG the metadata describes.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
      };
    }
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

const og = fs.readFileSync(path.join(root, "assets/img/og.jpg"));
const size = jpegSize(og);
if (!size || size.width !== 1200 || size.height !== 630) {
  fail(`og.jpg should be 1200x630, got ${size && size.width}x${size && size.height}`);
}
if (og.length > 150_000) {
  fail(`og.jpg is ${og.length} bytes; the share image should stay a small JPEG`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "site.webmanifest"), "utf8"));
for (const icon of manifest.icons) {
  const file = path.join(root, icon.src.replace(/^\//, ""));
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) fail(`missing icon ${icon.src}`);
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

for (const file of walk(root)) {
  if (file.endsWith(".js")) {
    const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (checked.status !== 0) fail(`${path.relative(root, file)} failed node --check\n${checked.stderr}`);
  }
}

if (!fs.existsSync(path.join(root, "404.html"))) fail("404.html is missing");
if (!fs.readFileSync(path.join(root, "journal/feed.xml"), "utf8").includes("<rss")) {
  fail("journal feed is not RSS");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("build check ok");
