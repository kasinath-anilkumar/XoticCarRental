import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("vehicle photos switch and the calculator keeps the complete journey visible", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cars/eclass");
  const gallery = page.getByRole("region", { name: "Vehicle gallery", exact: true });
  const thumbnails = gallery.getByRole("button", { name: /^Show .* photo$/ });
  expect(await thumbnails.count()).toBeGreaterThan(1);
  const firstSource = await gallery.locator("img").first().getAttribute("src");
  await thumbnails.nth(1).click();
  await expect(thumbnails.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(gallery.locator("img").first()).not.toHaveAttribute("src", firstSource!);

  await page.getByRole("link", { name: isMobile ? "Price my route" : "Get exact price for my route", exact: true }).click();
  const sections = page.getByRole("navigation", { name: "Calculator sections" });
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toBeVisible();
  await sections.getByRole("link", { name: "Car & package", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Select luxury vehicle:" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toBeVisible();
  await sections.getByRole("link", { name: "Route & schedule", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toHaveValue("");
  await expect(page.getByLabel("Pickup date", { exact: true })).toHaveValue("");
});

test("mobile fleet filters contain keyboard focus and restore the trigger on close", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The filter sheet is a mobile control.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cars");
  const trigger = page.getByRole("button", { name: "Filters", exact: true, includeHidden: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Filters", exact: true });
  const close = dialog.getByRole("button", { name: "Close filters", exact: true });
  const apply = dialog.getByRole("button", { name: "Show matching cars", exact: true });
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(apply).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("a populated booking summary is accessible and keeps one customer form", async ({ page, isMobile }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let submissions = 0;
  await page.route("**/api/enquiries", async (route) => {
    submissions += 1;
    await route.fulfill({ status: 400, json: { error: "This review must not submit an enquiry." } });
  });
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const query = new URLSearchParams({
    car: "eclass", pkg: "p8", trip: "local", date, time: "10:00", occ: "casual",
    stops: "@10.0889,76.35,Review pickup~@9.97,76.29,Review drop",
  });
  const response = await page.goto(`/booking-summary?${query}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Review your booking", exact: true })).toBeVisible();
  const progress = page.getByRole("navigation", { name: "Booking progress", exact: true });
  await expect(progress.getByRole("listitem")).toHaveCount(3);
  await expect(progress.getByRole("link")).toHaveCount(2);
  await expect(progress.getByRole("link", { name: "Your journey", exact: true })).toHaveAttribute("href", /#calc-route$/);
  await expect(progress.getByRole("link", { name: "Car & package", exact: true })).toHaveAttribute("href", /#calc-vehicle$/);
  await expect(progress.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(progress.locator('[aria-current="step"]')).toContainText("Booking summary");
  await expect(progress.getByRole("link", { name: "Booking summary", exact: true })).toHaveCount(0);
  if (isMobile) await page.getByRole("button", { name: "Trip itinerary & distance", exact: true }).click();
  await expect(page.getByText("Review pickup", { exact: true })).toBeVisible();
  await expect(page.getByText("Review drop", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("populated-summary.png"), fullPage: true });

  const customerForm = page.locator("#summary-send");
  const name = page.getByRole("textbox", { name: "Your name", exact: true });
  const phone = page.getByRole("textbox", { name: "Phone", exact: true });
  await expect(customerForm).toHaveCount(1);
  await expect(name).toHaveCount(1);
  await expect(phone).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Send this quote on WhatsApp", exact: true })).toHaveCount(1);
  await expect(customerForm.getByRole("textbox")).toHaveCount(2);
  await name.fill("Review Guest");
  await phone.fill("+91 90000 00000");

  if (isMobile) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const stickyAction = page.getByRole("link", { name: "Send on WhatsApp", exact: true });
    await expect(stickyAction).toHaveAttribute("href", "#summary-send");
    await stickyAction.click();
    await expect(page).toHaveURL(/#summary-send$/);
    await expect(name).toBeInViewport({ ratio: 1 });
    await expect(phone).toBeInViewport({ ratio: 1 });
  }
  await expect(name).toHaveValue("Review Guest");
  await expect(phone).toHaveValue("+91 90000 00000");
  await page.screenshot({ path: testInfo.outputPath("summary-contact.png") });
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  expect(errors).toEqual([]);
  expect(submissions).toBe(0);
  expect(page.context().pages()).toHaveLength(1);
});
