import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parse } from "node-html-parser";

const root = path.resolve(import.meta.dirname, "..");
const CANONICAL_ORIGIN = "https://www.collinsgamble.com";

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === "tests" || name === ".git") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkHtml(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

const files = walkHtml(root).sort();

function rel(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function routeOf(file) {
  const r = rel(file);
  if (r === "index.html") return "/";
  if (r.endsWith("/index.html")) return "/" + r.slice(0, -"/index.html".length);
  return "/" + r.slice(0, -".html".length);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function doc(file) {
  return parse(read(file));
}

function fileForHref(href) {
  const clean = href.split("?")[0].split("#")[0];
  if (clean === "" || clean.startsWith("mailto:") || clean.startsWith("tel:") || clean.startsWith("http:") || clean.startsWith("https:")) {
    return undefined;
  }
  const pathname = clean.startsWith("/") ? clean : null;
  if (pathname === null) return null;
  const trimmed = pathname.replace(/^\/+/, "");
  const candidates = pathname === "/"
    ? ["index.html"]
    : [trimmed, `${trimmed}.html`, path.join(trimmed, "index.html")];
  for (const candidate of candidates) {
    const full = path.resolve(root, candidate);
    if (full !== root && !full.startsWith(root + path.sep)) return null;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

function idsOf(file) {
  return new Set(doc(file).querySelectorAll("[id]").map((el) => el.getAttribute("id")));
}

test("every page has the document basics", () => {
  assert.ok(files.length >= 18, `expected the site pages, found ${files.length}`);
  for (const file of files) {
    const html = read(file);
    const page = doc(file);
    const where = rel(file);
    assert.equal(page.querySelector("html")?.getAttribute("lang"), "en", where);
    assert.ok(page.querySelector("title")?.text.trim(), `${where} title`);
    assert.ok(page.querySelector('meta[name="description"]')?.getAttribute("content"), `${where} description`);
    assert.equal(page.querySelectorAll("h1").length, 1, `${where} h1`);
    assert.equal(page.querySelectorAll("main").length, 1, `${where} main`);
    const ids = page.querySelectorAll("[id]").map((el) => el.getAttribute("id"));
    assert.equal(new Set(ids).size, ids.length, `${where} duplicate id ${ids}`);
    for (const img of page.querySelectorAll("img")) {
      assert.ok(img.hasAttribute("alt"), `${where} img ${img.getAttribute("src")} missing alt`);
    }
    for (const label of page.querySelectorAll("label[for]")) {
      const id = label.getAttribute("for");
      assert.ok(ids.includes(id), `${where} label for ${id}`);
    }
    for (const script of page.querySelectorAll('script[type="application/ld+json"]')) {
      assert.doesNotThrow(() => JSON.parse(script.text), `${where} json-ld`);
    }
    assert.equal(html.includes("https://collinsgamble.com"), false, `${where} still points at the apex host`);
  }
});

test("metadata uses the www host and the share image", () => {
  for (const file of files) {
    const page = doc(file);
    const where = rel(file);
    const canonical = page.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const image = page.querySelector('meta[property="og:image"]')?.getAttribute("content");
    const twitter = page.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
    assert.equal(image, `${CANONICAL_ORIGIN}/assets/img/og.jpg`, where);
    assert.equal(twitter, `${CANONICAL_ORIGIN}/assets/img/og.jpg`, where);
    if (where === "404.html") {
      assert.equal(canonical, undefined);
      assert.equal(page.querySelector('meta[name="robots"]')?.getAttribute("content"), "noindex");
      continue;
    }
    assert.ok(canonical?.startsWith(CANONICAL_ORIGIN), `${where} canonical ${canonical}`);
    const ogUrl = page.querySelector('meta[property="og:url"]')?.getAttribute("content");
    assert.equal(ogUrl, canonical, where);
  }
});

test("internal links, assets, nav, and footer resolve", () => {
  const navSeen = new Map();
  const footerSeen = new Map();
  for (const file of files) {
    const page = doc(file);
    const where = rel(file);
    for (const el of page.querySelectorAll("[href], [src]")) {
      const url = el.getAttribute("href") || el.getAttribute("src");
      if (!url || url.startsWith("#") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("http:") || url.startsWith("https:")) {
        if (url?.startsWith("#") && url !== "#") {
          assert.ok(idsOf(file).has(url.slice(1)), `${where} missing ${url}`);
        }
        continue;
      }
      if (url.startsWith("/_vercel")) continue;
      const [pathname, hash] = url.split("#");
      const target = fileForHref(pathname || "/");
      assert.ok(target, `${where} broken link ${url}`);
      if (hash) assert.ok(idsOf(target).has(hash), `${where} broken fragment ${url}`);
    }

    const nav = page.querySelectorAll("#primary-nav a").map((a) => a.getAttribute("href"));
    assert.deepEqual(nav, ["/", "/services", "/playbook", "/about", "/contact", "/contact"], where);
    const skip = page.querySelector("a.skip-link")?.getAttribute("href");
    assert.equal(skip, "#main", where);
    navSeen.set(where, nav);

    const footer = page.querySelector("footer.site-footer");
    const paths = [...footer.querySelectorAll("h2")]
      .find((h) => h.text === "Two paths")
      ?.parentNode.querySelectorAll("a")
      .map((a) => a.getAttribute("href"));
    assert.deepEqual(paths, [
      "/apply",
      "/services#creators",
      "/brands",
      "/brief",
      "/math",
      "/services#capabilities",
    ], where);
    footerSeen.set(where, paths);
  }
  assert.equal(navSeen.size, files.length);
  assert.equal(footerSeen.size, files.length);
});

test("sitemap lists the indexable pages and the feed", () => {
  const xml = read(path.join(root, "sitemap.xml"));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const routes = locs.map((loc) => loc.replace(CANONICAL_ORIGIN, "") || "/");
  for (const loc of locs) assert.ok(loc.startsWith(CANONICAL_ORIGIN), loc);

  const indexable = [];
  const hidden = [];
  for (const file of files) {
    const robots = doc(file).querySelector('meta[name="robots"]')?.getAttribute("content") || "";
    const route = routeOf(file);
    if (robots.includes("noindex")) hidden.push(route);
    else indexable.push(route);
  }
  for (const route of indexable) assert.ok(routes.includes(route), `sitemap missing ${route}`);
  for (const route of hidden) assert.equal(routes.includes(route), false, `noindex page listed ${route}`);
  assert.ok(routes.includes("/journal/feed.xml"));
  assert.equal(read(path.join(root, "robots.txt")).includes(`${CANONICAL_ORIGIN}/sitemap.xml`), true);

  const published = {};
  for (const file of files) {
    const where = rel(file);
    if (!where.startsWith("journal/") || where.endsWith("index.html")) continue;
    const blocks = [...doc(file).querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.text));
    const posting = blocks.find((block) => block["@type"] === "BlogPosting");
    assert.ok(posting?.datePublished, `${where} datePublished`);
    published[routeOf(file)] = posting.datePublished;
  }
  const newest = Object.values(published).sort().at(-1);
  published["/journal"] = newest;
  published["/journal/feed.xml"] = newest;
  for (const [route, day] of Object.entries(published)) {
    const loc = `${CANONICAL_ORIGIN}${route}`;
    assert.match(xml, new RegExp(`<loc>${loc}</loc>\\s*<lastmod>${day}</lastmod>`), `${route} lastmod`);
  }
});

test("search index points at real pages", () => {
  const index = JSON.parse(read(path.join(root, "assets/data/search-index.json")));
  assert.ok(index.items.length > 20);
  for (const item of index.items) {
    assert.ok(item.id && item.title && item.url, item.id);
    if (/^(https?:|mailto:)/.test(item.url)) continue;
    const [pathname, hash] = item.url.split("#");
    const target = fileForHref(pathname || "/");
    assert.ok(target, `search ${item.id} -> ${item.url}`);
    if (hash) assert.ok(idsOf(target).has(hash), `search fragment ${item.url}`);
  }
});

test("the menu button names itself and hides its icon", () => {
  for (const file of files) {
    const page = doc(file);
    const where = rel(file);
    const toggle = page.querySelector("button.nav-toggle");
    assert.equal(toggle?.getAttribute("aria-label"), "Menu", where);
    assert.equal(toggle?.getAttribute("aria-controls"), "primary-nav", where);
    assert.equal(toggle?.querySelector("svg")?.getAttribute("aria-hidden"), "true", where);
  }
});

test("pages expose named navigation landmarks", () => {
  for (const file of files) {
    const page = doc(file);
    const where = rel(file);
    const primary = page.querySelector('header nav[aria-label="Primary"]');
    assert.ok(primary?.querySelector("#primary-nav"), `${where} primary nav`);
    const footerNavs = page.querySelector("footer.site-footer").querySelectorAll("nav[aria-labelledby]");
    assert.deepEqual(
      [...footerNavs].map((nav) => nav.getAttribute("aria-labelledby")),
      ["footer-agency", "footer-paths", "footer-connect"],
      where,
    );
    for (const nav of footerNavs) {
      const id = nav.getAttribute("aria-labelledby");
      assert.equal(nav.querySelector("h2")?.getAttribute("id"), id, `${where} ${id}`);
    }
  }
  const playbook = doc(path.join(root, "playbook.html"));
  assert.ok(playbook.querySelector('nav.playbook-toc[aria-label="Contents"]'));
});

test("forms declare an allowed inbox and keep browser checks in script", () => {
  const expected = {
    "contact.html": ["hello@collinsandgamble.com", "contact"],
    "apply.html": ["apply@collinsandgamble.com", "apply"],
    "brands.html": ["hello@collinsandgamble.com", "brand"],
  };
  for (const [name, [inbox, kind]] of Object.entries(expected)) {
    const page = doc(path.join(root, name));
    const form = page.querySelector("form");
    assert.equal(form.getAttribute("novalidate"), "", `${name} novalidate`);
    assert.equal(form.getAttribute("data-inbox"), inbox, name);
    assert.equal(form.getAttribute("data-form"), kind, name);
    assert.ok(form.getAttribute("data-subject"), name);
    assert.ok(page.querySelector("#website"), `${name} honeypot`);
    for (const field of form.querySelectorAll("[required]")) {
      const id = field.getAttribute("id");
      assert.ok(id, `${name} required field needs an id`);
      assert.ok(form.querySelector(`label[for="${id}"]`), `${name} #${id} label`);
    }
  }
});
