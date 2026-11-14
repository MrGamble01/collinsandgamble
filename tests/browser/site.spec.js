import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/services",
  "/about",
  "/contact",
  "/playbook",
  "/apply",
  "/brands",
  "/brief",
  "/check",
  "/math",
  "/journal",
  "/journal/on-site-review-explained",
  "/search",
  "/privacy",
  "/thanks",
];

async function sameOriginFailures(page) {
  const failures = [];
  page.on("pageerror", (err) => failures.push(err.message));
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (res.status() >= 400 && url.origin === "http://127.0.0.1:4173") {
      failures.push(`${res.status()} ${url.pathname}`);
    }
  });
  return failures;
}

test("key pages render at desktop and phone width", async ({ page }) => {
  for (const route of pages) {
    for (const width of [1280, 390]) {
      const failures = await sameOriginFailures(page);
      await page.setViewportSize({ width, height: 800 });
      const response = await page.goto(route);
      expect(response?.status(), route).toBeLessThan(400);
      await expect(page).toHaveTitle(/Collins/);
      await expect(page.locator("h1")).toBeVisible();
      expect((await page.locator("h1").innerText()).trim().length).toBeGreaterThan(3);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
      expect(failures, `${route} at ${width}px`).toEqual([]);
    }
  }
});

test("unknown URLs use the 404 page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Not here.");
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get in touch" })).toBeVisible();
  await expect(page.locator("#primary-nav")).toBeVisible();
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toBe("noindex");
});

test("the phone nav opens and its links go somewhere", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const toggle = page.locator(".nav-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const playbook = page.locator("#primary-nav a[href='/playbook']");
  await expect(playbook).toBeVisible();
  await playbook.click();
  await expect(page).toHaveURL(/\/playbook$/);
  await expect(page.locator("h1")).toBeVisible();
});

test("old home search URLs land on the search page", async ({ page }) => {
  await page.goto("/?q=storefront");
  await expect(page).toHaveURL(/\/search\?q=storefront$/);
  await expect(page.locator(".search-result-link").first()).toBeVisible();
});

test("search from the address bar returns a real page", async ({ page }) => {
  await page.goto("/search?q=storefront");
  const link = page.locator(".search-result-link").first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/journal\/storefront-is-the-store/);
  await link.click();
  await expect(page.locator("h1")).toContainText(/storefront/i);
});

test("contact form blocks a blank name, prefixes a bare URL, and sends once", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.locator("#looking-for")).toContainText("Join the roster");
  await page.locator("#side").selectOption("brand");
  await expect(page.locator("#looking-for")).toContainText("Single-product test campaign");

  await page.locator("#name").fill("   ");
  await page.locator("#email").fill("ada@example.com");
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("#name")).toHaveValue("");
  expect(await page.locator("form").evaluate((form) => form.checkValidity())).toBe(false);

  let calls = 0;
  await page.route("**/api/submit", async (route) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.locator("#name").fill("Ada Lovelace");
  await page.locator("#link").fill("amazon.com/shop/ada");
  const button = page.locator("form button[type=submit]");
  await button.click();
  await expect(button).toBeDisabled();
  await page.locator("form").evaluate((form) => form.requestSubmit());
  await page.waitForURL(/\/thanks$/);
  expect(calls).toBe(1);
});

test("the earnings slider fill follows the thumb", async ({ page }) => {
  await page.goto("/math");
  const slider = page.locator("#m-cadence");
  await expect(slider).toHaveAttribute("value", "3");
  await expect.poll(() => slider.evaluate((el) => el.style.getPropertyValue("--range-pct"))).toBe("15%");
  await slider.evaluate((el) => {
    el.value = "20";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect.poll(() => slider.evaluate((el) => el.style.getPropertyValue("--range-pct"))).toBe("100%");
  await expect(page.locator('[data-out="likely"]')).not.toHaveText("0");
  await slider.evaluate((el) => {
    el.value = "0";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect.poll(() => slider.evaluate((el) => el.style.getPropertyValue("--range-pct"))).toBe("0%");
});

test("the fit check reaches an honest result", async ({ page }) => {
  await page.goto("/check");
  for (let i = 0; i < 5; i += 1) {
    await page.locator(".quiz-option").first().click();
  }
  await expect(page.locator("[data-result-title]")).toHaveText("You're who we built this for.");
  await expect(page.locator("[data-result-primary]")).toHaveAttribute("href", "/apply");
});
