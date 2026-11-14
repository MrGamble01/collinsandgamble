import AxeBuilder from "@axe-core/playwright";
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
  "/journal/how-to-get-approved",
  "/search",
  "/privacy",
  "/thanks",
  "/404.html",
];

test("pages have no serious accessibility violations", async ({ page }) => {
  const failures = [];
  for (const route of pages) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await page.evaluate(() => {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    if (serious.length) {
      failures.push(
        `${route}\n` +
          serious
            .map((item) => `  ${item.id}: ${item.help} (${item.nodes.slice(0, 2).map((node) => node.target.join(" ")).join("; ")})`)
            .join("\n"),
      );
    }
  }
  expect(failures, failures.join("\n\n")).toEqual([]);
});

test("the search dialog is named, focused, and free of serious violations", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-palette-trigger]").click();
  const dialog = page.getByRole("dialog", { name: "Search Collins and Gamble" });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox", { name: "Search the site" });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(dialog.getByRole("listbox", { name: "Suggestions" })).toBeVisible();
  await input.fill("storefront");
  await expect(dialog.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Show keyboard shortcuts" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-palette-trigger]")).toBeFocused();

  await page.locator("[data-palette-trigger]").click();
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include("#cg-palette-dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  expect(serious.map((item) => item.id)).toEqual([]);
});

test("the contact form names its fields and keeps a keyboard path", async ({ page }) => {
  await page.goto("/contact");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  for (const id of ["name", "email", "message"]) {
    const field = page.locator(`#${id}`);
    const label = page.locator(`label[for="${id}"]`);
    await expect(label).toBeVisible();
    await field.focus();
    await expect(field).toBeFocused();
  }

  await page.locator("#name").fill("Ada");
  await page.locator("#email").fill("not-an-email");
  await page.locator("form button[type=submit]").click();
  const message = await page.locator("#email").evaluate((input) => input.validationMessage);
  expect(message.length).toBeGreaterThan(0);
  await expect(page.locator("#email")).toBeFocused();
  await expect(page.locator("[data-status]")).toBeVisible();
  await expect(page.locator("[data-status]")).toHaveText(message);
});
