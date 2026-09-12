import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const routes = ["/", "/cars", "/cars/eclass", "/services/wedding", "/cities/kochi", "/gallery", "/price-calculator", "/booking-summary", "/contact"];

for (const path of routes) {
  test(`${path} renders without errors, overflow, or accessibility violations`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("We could not load this page");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(accessibility.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("page.png"), fullPage: true });
  });
}

test("fleet pagination changes vehicles and retains filters", async ({ page }) => {
  await page.goto("/cars?sort=price-asc");
  const pagination = page.getByRole("navigation", { name: "cars pagination" });
  await expect(pagination).toContainText("12");
  await pagination.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/sort=price-asc/);
  await expect(page.getByRole("navigation", { name: "cars pagination" })).toContainText("13");
});

test("gallery loads additional photos and supports modal keyboard navigation", async ({ page }) => {
  await page.goto("/gallery");
  const photos = page.getByRole("button", { name: /^View .+, photo \d+$/ });
  await expect(photos).toHaveCount(12);
  await page.getByRole("button", { name: /Show more/i }).click();
  await expect(photos).toHaveCount(24);
  await photos.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog").getByRole("img")).toHaveAttribute("alt", /2/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(photos.first()).toBeFocused();
});

test("service enquiry distinguishes saved and unsaved requests without sending messages", async ({ page }) => {
  await page.addInitScript(() => { window.open = () => null; });
  await page.route("**/api/enquiries/service", (route) => route.fulfill({
    json: { recorded: false, whatsappHref: "https://wa.me/919876543210?text=test" },
  }));
  await page.goto("/services/wedding");
  await page.locator('[name="customerName"]').fill("Browser Test");
  await page.locator('[name="customerPhone"]').fill("9876543210");
  const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.locator('[name="date"]').fill(date);
  await page.locator('[name="city"]').fill("Kochi");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText("One more step: send your WhatsApp message")).toBeVisible();
  await expect(page.getByText("We could not save your enquiry.", { exact: false })).toBeVisible();
  await expect(page.getByText("Enquiry received", { exact: false })).toHaveCount(0);
});

test("calendar opens on demand and Tomorrow selects the actual next day", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Pickup date/ }).click();
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  const expected = await page.evaluate(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return String(tomorrow.getDate());
  });
  await expect(page.getByRole("button", { name: /Pickup date/ })).toContainText(expected);
});

test("mobile menu traps focus and restores it on Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open menu" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Navigation menu" });
  await expect(dialog).toBeVisible();
  for (let step = 0; step < 15; step++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("missing routes and malformed API input fail cleanly", async ({ page, request }) => {
  const missing = await page.goto("/this-page-does-not-exist");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /back on the road/ })).toBeVisible();
  const response = await request.post("/api/enquiries/service", { data: { service: "invalid" } });
  expect(response.status()).toBe(400);
  await expect(page.locator("main")).toBeVisible();
});

test("calculator supports a bounded itinerary of twelve stops", async ({ page }) => {
  await page.goto("/price-calculator?stops=");
  const add = page.getByRole("button", { name: "Add another stop", exact: true });
  for (let count = 0; count < 12; count++) await add.click();
  await expect(page.getByRole("button", { name: "Maximum 12 stops", exact: true })).toBeDisabled();
  await expect(page.locator('[id^="calc-stop-"][role="combobox"]')).toHaveCount(12);
});

test("every generated public route responds successfully", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(120_000);
  const manifest = JSON.parse(await readFile(".next/prerender-manifest.json", "utf8"));
  const paths = Object.keys(manifest.routes).filter((path) => !path.startsWith("/_"));
  expect(paths.length).toBeGreaterThan(250);
  for (let offset = 0; offset < paths.length; offset += 4) {
    const results = await Promise.all(paths.slice(offset, offset + 4).map(async (path) => {
      const response = await request.get(path);
      return { path, status: response.status() };
    }));
    expect(results.filter(({ status }) => status !== 200)).toEqual([]);
  }
});

test("admin demo worklists and configuration pages render", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  for (const path of ["/admin", "/admin/enquiries", "/admin/availability", "/admin/fleet", "/admin/cities", "/admin/garages", "/admin/locations", "/admin/packages", "/admin/settings", "/admin/seasons", "/admin/routes"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).not.toContain("We could not load this page");
  }
});
