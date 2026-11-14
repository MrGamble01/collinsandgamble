import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function fillInquiry(page, { creators = true, email = "ada@example.com", name = "Ada Lovelace" } = {}) {
  await page.locator("#name").fill(name);
  await page.locator("#company").fill("Analytical Engines");
  await page.locator("#email").fill(email);
  await page.locator("#budget").selectOption({ label: "Under $2,000" });
  await page.locator("#goal").selectOption({ label: "Launch a new product" });
  const box = page.locator('input[name="creators"]').first();
  if (creators) await box.check({ force: true });
  else await box.uncheck({ force: true });
}

test("placeholder cards render at desktop and phone width", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/roster");
    await expect(page.locator(".roster-card")).toHaveCount(9);
    await expect(page.locator(".roster-photo").first()).toHaveText("Photo placeholder");
    await expect(page.locator(".roster-card h3").first()).toHaveText("Beauty");
    const text = await page.locator("[data-roster]").innerText();
    expect(text).toContain("Placeholder");
    expect(text).toContain("Amazon storefront");
    expect(text).not.toMatch(/\d/);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test("validation blocks an incomplete inquiry and does not send", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/submit", async (route) => {
    calls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.route("**/*resend.com/**", () => {
    throw new Error("refused a real email send");
  });
  await page.goto("/roster");
  await expect(page.locator('input[name="creators"]')).toHaveCount(9);

  await page.locator('button[type="submit"]').click();
  expect(await page.locator("form").evaluate((form) => form.checkValidity())).toBe(false);
  await expect(page.locator("[data-form-success]")).toBeHidden();

  await fillInquiry(page, { name: "   " });
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("#name")).toHaveValue("");
  expect(await page.locator("form").evaluate((form) => form.checkValidity())).toBe(false);

  await fillInquiry(page, { email: "not-an-email" });
  await page.locator('button[type="submit"]').click();
  expect(await page.locator("form").evaluate((form) => form.checkValidity())).toBe(false);

  await fillInquiry(page, { creators: false });
  await page.locator('input[name="creators"]').first().uncheck();
  await page.locator('button[type="submit"]').click();
  expect(await page.locator("form").evaluate((form) => form.checkValidity())).toBe(false);
  await expect(page.locator("[data-form-success]")).toBeHidden();
  expect(calls).toBe(0);
});

test("a successful submit shows the success state and never calls Resend", async ({ page }) => {
  let body;
  await page.route("**/api/submit", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.route("**/*resend.com/**", () => {
    throw new Error("refused a real email send");
  });
  await page.goto("/roster");
  await fillInquiry(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("[data-form-success]")).toBeVisible();
  await expect(page.locator("[data-form-success]")).toContainText("Got it. Now it's on us.");
  await expect(page.locator("form")).toBeHidden();
  await expect(page.locator("[data-form-error]")).toBeHidden();
  expect(body.to).toBe("hello@collinsandgamble.com");
  expect(body.subjectPrefix).toBe("Creator roster inquiry");
  expect(body.honeypot).toBe("");
  expect(body.fields.name).toBe("Ada Lovelace");
  expect(body.fields.company).toBe("Analytical Engines");
  expect(body.fields.email).toBe("ada@example.com");
  expect(body.fields.budget).toBe("Under $2,000");
  expect(body.fields.goal).toBe("Launch a new product");
  expect(body.fields.creators).toBe("placeholder-beauty");
});

test("a failed submit stays on the form and offers mailto", async ({ page }) => {
  await page.route("**/api/submit", async (route) => {
    await route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"Send failed"}' });
  });
  await page.route("**/*resend.com/**", () => {
    throw new Error("refused a real email send");
  });
  await page.goto("/roster");
  await fillInquiry(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("[data-form-error]")).toBeVisible();
  await expect(page.locator("[data-form-success]")).toBeHidden();
  await expect(page.locator("form")).toBeVisible();
  const href = await page.locator("[data-mailto-fallback]").getAttribute("href");
  expect(href).toContain("mailto:hello@collinsandgamble.com");
  expect(decodeURIComponent(href)).toContain("Ada Lovelace");
  expect(decodeURIComponent(href)).toContain("placeholder-beauty");
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
});

test("a network failure uses the same error state", async ({ page }) => {
  await page.route("**/api/submit", (route) => route.abort("failed"));
  await page.goto("/roster");
  await fillInquiry(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("[data-form-error]")).toBeVisible();
  await expect(page.locator("[data-form-success]")).toBeHidden();
});

test("a filled honeypot does not show an error", async ({ page }) => {
  let body;
  await page.route("**/api/submit", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto("/roster");
  await fillInquiry(page);
  await page.locator("#website").fill("https://spam.example", { force: true });
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("[data-form-success]")).toBeVisible();
  await expect(page.locator("[data-form-error]")).toBeHidden();
  expect(body.honeypot).toBe("https://spam.example");
});
