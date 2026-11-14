import { expect, test } from "@playwright/test";

test("pages run their scripts under the content security policy", async ({ page }) => {
  const blocked = [];
  page.on("console", (msg) => {
    if (/content security policy/i.test(msg.text())) blocked.push(msg.text());
  });
  page.on("pageerror", (err) => blocked.push(err.message));

  const home = await page.goto("/");
  expect(home?.headers()["content-security-policy"] || "").toContain("default-src 'self'");
  expect(home?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(home?.headers()["permissions-policy"] || "").toContain("camera=()");
  await expect(page.locator("h1")).toBeVisible();

  await page.goto("/search?q=storefront");
  await expect(page.locator(".search-result-link").first()).toBeVisible();

  const missing = await page.goto("/this-page-does-not-exist");
  expect(missing?.status()).toBe(404);
  expect(missing?.headers()["content-security-policy"] || "").toContain("default-src 'self'");
  await expect(page.locator("h1")).toHaveText("Not here.");

  expect(blocked).toEqual([]);
});
