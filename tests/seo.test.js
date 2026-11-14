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
  const practice = blocks.find((block) => block["@type"] === "ProfessionalService");
  assert.ok(practice, "ProfessionalService JSON-LD");
  assert.equal(practice.name, "Collins & Gamble");
  assert.equal(practice.url, `${ORIGIN}/`);
  assert.equal(practice.logo, `${ORIGIN}/assets/img/icon-512.png`);
  assert.equal(practice.email, "hello@collinsandgamble.com");
  assert.equal(practice.founder, undefined);
  assert.equal(practice.employee, undefined);

  const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
  assert.match(robots, new RegExp(`Sitemap: ${ORIGIN}/sitemap.xml`));
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.equal(sitemap.includes("https://collinsgamble.com"), false);
  assert.ok(sitemap.includes(`${ORIGIN}/`));
});

function canonicalFor(where) {
  const route = where.split(path.sep).join("/");
  if (route === "index.html") return `${ORIGIN}/`;
  if (route.endsWith("/index.html")) return `${ORIGIN}/${route.slice(0, -"/index.html".length)}`;
  return `${ORIGIN}/${route.slice(0, -".html".length)}`;
}

function walkJson(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, visit);
    return;
  }
  visit(node);
  for (const value of Object.values(node)) walkJson(value, visit);
}

test("structured data names the agency and never a person", () => {
  const agencyTypes = new Set(["Organization", "ProfessionalService"]);
  for (const file of htmlFiles()) {
    const where = path.relative(root, file);
    const page = parse(fs.readFileSync(file, "utf8"));
    if (where !== "404.html") {
      const canonical = page.querySelector('link[rel="canonical"]')?.getAttribute("href");
      assert.equal(canonical, canonicalFor(where), where);
    }
    const headings = page.querySelectorAll("h1,h2,h3,h4,h5,h6").map((node) => Number(node.tagName.replace(/\D/g, "")));
    let prev = 0;
    for (const level of headings) {
      if (prev) assert.ok(level <= prev + 1, `${where} heading skips from h${prev} to h${level}`);
      prev = level;
    }
    for (const img of page.querySelectorAll("img")) {
      const alt = (img.getAttribute("alt") ?? "").trim();
      assert.equal(/[@]|https?:|linkedin\.com\/in\/|\.(?:png|jpe?g|svg|webp|gif|avif)$/i.test(alt), false, `${where} alt ${alt}`);
      if (alt) assert.ok(alt.length >= 12, `${where} alt is too thin`);
    }
    for (const script of page.querySelectorAll('script[type="application/ld+json"]')) {
      walkJson(JSON.parse(script.text), (node) => {
        const types = [].concat(node["@type"] ?? []);
        assert.equal(types.includes("Person"), false, `${where} Person`);
        for (const key of ["founder", "employee", "employees", "alumni"]) {
          assert.equal(node[key], undefined, `${where} ${key}`);
        }
        if (types.some((type) => type === "BlogPosting" || type === "Article" || type === "Blog")) {
          assert.ok(agencyTypes.has(node.author?.["@type"]), `${where} author`);
          assert.equal(node.author.name, "Collins & Gamble", where);
        }
        if (node["@type"] === "WebApplication") {
          assert.equal(node.provider?.["@type"], "ProfessionalService", where);
          assert.equal(node.provider.name, "Collins & Gamble", where);
          assert.equal(node.offers?.price, "0", where);
        }
      });
    }
  }
});

test("the service catalog lists the capabilities on the page", () => {
  const page = parse(fs.readFileSync(path.join(root, "services.html"), "utf8"));
  const blocks = page.querySelectorAll('script[type="application/ld+json"]').map((node) => JSON.parse(node.text));
  const service = blocks.find((block) => block["@type"] === "Service");
  const names = service.hasOfferCatalog.itemListElement.map((offer) => offer.itemOffered.name);
  const visible = page.querySelectorAll("#capabilities h3").map((node) => node.text.trim());
  assert.deepEqual(names, visible);
});

function routeOf(where) {
  const route = where.split(path.sep).join("/");
  if (route === "index.html") return "/";
  if (route.endsWith("/index.html")) return `/${route.slice(0, -"/index.html".length)}`;
  return `/${route.slice(0, -".html".length)}`;
}

test("robots.txt allows the site, blocks only the 404, and points at the www sitemap", () => {
  const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8").replace(/\r\n/g, "\n").trim();
  const lines = robots.split("\n").map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(lines, [
    "User-agent: *",
    "Allow: /",
    "Disallow: /404.html",
    `Sitemap: ${ORIGIN}/sitemap.xml`,
  ]);
  assert.equal(robots.includes("https://collinsgamble.com"), false);
});

test("canonicals are clean www URLs and noindex pages stay out of the sitemap", () => {
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(locs).size, locs.length, "duplicate sitemap loc");
  for (const loc of locs) {
    assert.ok(loc.startsWith(`${ORIGIN}/`) || loc === `${ORIGIN}/`, loc);
    assert.equal(loc.includes("https://collinsgamble.com"), false, loc);
    assert.equal(/[?#]/.test(loc), false, loc);
    assert.equal(loc.endsWith(".html"), false, loc);
  }
  const listed = new Set(locs.map((loc) => loc.slice(ORIGIN.length) || "/"));

  for (const file of htmlFiles()) {
    const where = path.relative(root, file);
    const page = parse(fs.readFileSync(file, "utf8"));
    const canonical = page.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
    const robots = meta(page, "name", "robots");
    const route = routeOf(where);
    if (where === "404.html") {
      assert.equal(canonical, "");
      assert.equal(robots, "noindex");
      assert.equal(listed.has("/404.html") || listed.has("/404"), false);
      continue;
    }
    assert.equal(canonical, `${ORIGIN}${route === "/" ? "/" : route}`, where);
    assert.equal(canonical.endsWith(".html"), false, where);
    if (route !== "/") assert.equal(canonical.endsWith("/"), false, where);
    if (robots.includes("noindex")) {
      assert.equal(listed.has(route), false, `${where} is noindex but listed`);
    } else {
      assert.equal(listed.has(route), true, `${where} missing from sitemap`);
    }
  }
  assert.equal(listed.has("/journal/feed.xml"), true);
});

test("structured data stays on the www host and describes the agency, not a person", () => {
  const home = parse(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  const homeBlocks = [...home.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.text));
  const site = homeBlocks.find((block) => block["@type"] === "WebSite");
  assert.equal(site?.potentialAction?.["@type"], "SearchAction");
  assert.equal(site.potentialAction.target, `${ORIGIN}/search?q={search_term_string}`);
  const org = homeBlocks.find((block) => block["@type"] === "Organization");
  for (const link of [].concat(org.sameAs ?? [])) {
    const url = new URL(link);
    assert.equal(url.protocol, "https:");
    assert.notEqual(url.pathname.split("/").filter(Boolean)[0], "in", link);
  }

  for (const file of htmlFiles()) {
    const where = path.relative(root, file);
    const page = parse(fs.readFileSync(file, "utf8"));
    for (const script of page.querySelectorAll('script[type="application/ld+json"]')) {
      const block = JSON.parse(script.text);
      assert.equal(block["@context"], "https://schema.org", where);
      walkJson(block, (node) => {
        const types = [].concat(node["@type"] ?? []);
        assert.equal(types.includes("Person"), false, `${where} Person`);
        for (const value of Object.values(node)) {
          if (typeof value !== "string" || !/^https?:\/\//.test(value)) continue;
          if (!value.includes("collinsgamble.com")) continue;
          assert.equal(value.startsWith(ORIGIN), true, `${where} ${value}`);
        }
      });
    }
  }
});
