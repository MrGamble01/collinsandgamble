import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parse } from "node-html-parser";

const root = path.resolve(import.meta.dirname, "..");
const ORIGIN = "https://www.collinsgamble.com";
const IMAGE = `${ORIGIN}/assets/img/og.jpg`;

function htmlFiles(dir = root, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === "tests" || name === ".git") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) htmlFiles(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out.sort();
}

function meta(page, attr, key) {
  return page.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content") || "";
}

test("every page has its own title, description, and share cards on the site domain", () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const file of htmlFiles()) {
    const where = path.relative(root, file);
    const page = parse(fs.readFileSync(file, "utf8"));
    const title = page.querySelector("title")?.text.trim();
    const description = meta(page, "name", "description");
    assert.ok(title && title.length >= 10 && title.length <= 60, `${where} title length ${title?.length}`);
    assert.ok(description && description.length >= 70 && description.length <= 160, `${where} description length ${description?.length}`);
    assert.equal(titles.has(title), false, `duplicate title ${title}`);
    assert.equal(descriptions.has(description), false, `duplicate description on ${where}`);
    titles.add(title);
    descriptions.add(description);

    const canonical = page.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const ogUrl = meta(page, "property", "og:url");
    if (where !== "404.html") {
      assert.ok(canonical?.startsWith(ORIGIN), `${where} canonical ${canonical}`);
      assert.equal(ogUrl, canonical, where);
    }
    assert.equal(meta(page, "property", "og:title").length > 0, true, where);
    assert.equal(meta(page, "property", "og:description").length > 0, true, where);
    assert.equal(meta(page, "property", "og:image"), IMAGE, where);
    assert.equal(meta(page, "name", "twitter:card"), "summary_large_image", where);
    assert.equal(meta(page, "name", "twitter:title"), meta(page, "property", "og:title"), where);
    assert.equal(meta(page, "name", "twitter:description"), meta(page, "property", "og:description"), where);
    assert.equal(meta(page, "name", "twitter:image"), IMAGE, where);
    assert.equal(fs.readFileSync(file, "utf8").includes("https://collinsgamble.com"), false, where);
  }
});

test("the homepage publishes Organization data and the sitemap matches robots", () => {
  const home = parse(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  const blocks = home.querySelectorAll('script[type="application/ld+json"]').map((node) => JSON.parse(node.text));
  const org = blocks.find((block) => block["@type"] === "Organization");
  assert.ok(org, "Organization JSON-LD");
  assert.equal(org.name, "Collins & Gamble");
  assert.equal(org.url, `${ORIGIN}/`);
  assert.equal(org.logo, `${ORIGIN}/assets/img/icon-512.png`);
  assert.equal(org.contactPoint[0].email, "hello@collinsandgamble.com");

  const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
  assert.match(robots, new RegExp(`Sitemap: ${ORIGIN}/sitemap.xml`));
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.equal(sitemap.includes("https://collinsgamble.com"), false);
  assert.ok(sitemap.includes(`${ORIGIN}/`));
});
