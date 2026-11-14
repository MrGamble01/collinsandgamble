import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function htmlFiles(dir = root, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === "tests" || name === ".git") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) htmlFiles(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

test("pages do not block on Google Fonts", () => {
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, "utf8");
    assert.equal(html.includes("fonts.googleapis.com"), false, file);
    assert.equal(html.includes("fonts.gstatic.com"), false, file);
  }
  const css = fs.readFileSync(path.join(root, "assets/css/styles.css"), "utf8");
  assert.match(css, /assets\/fonts\/fraunces-latin\.woff2/);
  assert.match(css, /assets\/fonts\/inter-latin\.woff2/);
  assert.match(css, /font-display:\s*swap/);
});

test("self-hosted fonts are the latin files, not the full family", () => {
  const fraunces = fs.statSync(path.join(root, "assets/fonts/fraunces-latin.woff2")).size;
  const inter = fs.statSync(path.join(root, "assets/fonts/inter-latin.woff2")).size;
  assert.ok(fraunces < 80_000, fraunces);
  assert.ok(inter < 60_000, inter);
  assert.ok(fraunces > 10_000 && inter > 10_000);
});

test("content images are lazy except the hero", () => {
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, "utf8");
    const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    for (const img of images) {
      const hero = img.includes("hero-pdp.svg");
      if (hero) {
        assert.match(img, /fetchpriority="high"/, file);
        assert.equal(img.includes('loading="lazy"'), false);
      } else {
        assert.match(img, /loading="lazy"/, `${file} ${img}`);
      }
      assert.match(img, /decoding="async"/);
    }
  }
});

test("the search index is not preloaded on every page", () => {
  const palette = fs.readFileSync(path.join(root, "assets/js/palette.js"), "utf8");
  assert.equal(palette.includes("setTimeout(loadIndex"), false);
});
