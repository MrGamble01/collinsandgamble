import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CREATOR_NICHES, creators } from "../assets/data/creators.js";

const root = path.resolve(import.meta.dirname, "..");

function brandCategories() {
  const html = fs.readFileSync(path.join(root, "brands.html"), "utf8");
  return [...html.matchAll(/name="categories" value="([^"]+)"/g)].map((match) => match[1]);
}

test("roster slots are placeholders seeded from the brand categories", () => {
  assert.deepEqual([...CREATOR_NICHES], brandCategories());
  assert.equal(creators.length, CREATOR_NICHES.length);
  const ids = new Set();
  for (const creator of creators) {
    assert.equal(creator.placeholder, true, creator.id);
    assert.equal(creator.photo, null, creator.id);
    assert.equal(creator.name, "Placeholder", creator.id);
    assert.equal(creator.placeholderLabel.includes("not a person"), true, creator.id);
    assert.equal(creator.audience.startsWith("Placeholder"), true, creator.id);
    assert.deepEqual([...creator.platforms], ["Amazon storefront"], creator.id);
    assert.equal(CREATOR_NICHES.includes(creator.niche), true, creator.niche);
    assert.equal(ids.has(creator.id), false, creator.id);
    ids.add(creator.id);
    const blob = `${creator.name} ${creator.audience} ${creator.placeholderLabel}`;
    assert.equal(/\d/.test(blob), false, `invented stat in ${creator.id}`);
  }
});
