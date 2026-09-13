import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile information order and persistent controls.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("fleet reaches inventory early and keeps filters accessible throughout results", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/cars");
    const edit = page.getByRole("button", { name: "Edit journey", exact: true });
    await expect(edit).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("form", { name: "Update your journey", exact: true })).toBeHidden();
    const firstCar = page.getByRole("article").first();
    const firstBounds = await firstCar.boundingBox();
    expect(firstBounds!.y).toBeLessThan(520);
    const controls = page.getByRole("region", { name: "Fleet results and controls", exact: true });
    await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), firstBounds!.y + 350);
    await expect.poll(() => controls.evaluate((element) => Math.abs(element.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height"))))).toBeLessThan(2);
    await expect(controls.getByRole("combobox", { name: "Sort by", exact: true })).toBeInViewport();
    await controls.getByRole("button", { name: "Filters", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Filters", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Show matching cars", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(controls).toBeFocused();
    await expect(page).toHaveURL(/#fleet-results$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.screenshot({ path: testInfo.outputPath(`fleet-controls-${viewport.width}.png`) });
  }
});

test("vehicle puts gallery and base price before secondary content with one contextual action", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/cars/eclass?pkg=p12");
    const gallery = page.getByRole("region", { name: "Vehicle gallery", exact: true });
    const booking = page.getByRole("complementary", { name: "Booking options", exact: true });
    const price = booking.getByRole("status", { name: "Starting package price", exact: true });
    expect((await gallery.boundingBox())!.y).toBeLessThan(250);
    expect((await price.boundingBox())!.y).toBeLessThan(650);
    const actions = page.getByRole("region", { name: "Mercedes-Benz E-Class booking action", exact: true });
    await expect(actions).toBeInViewport({ ratio: 1 });
    await expect(actions.getByRole("link")).toHaveCount(1);
    await expect(actions.getByText("Mercedes-Benz E-Class", { exact: true })).toBeVisible();
    await expect(actions.getByRole("link", { name: "Price my route", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("navigation", { name: "Quick actions", exact: true })).toBeHidden();
    await expect(booking.getByLabel("Booking package", { exact: true })).toHaveValue("p12");
    const questions = page.getByRole("button", { name: "Questions", exact: true });
    await expect(questions).toHaveAttribute("aria-expanded", "false");
    await page.screenshot({ path: testInfo.outputPath(`vehicle-priority-${viewport.width}.png`) });
    await page.getByRole("navigation", { name: "Vehicle details", exact: true }).getByRole("link", { name: "Questions", exact: true }).click();
    await expect(questions).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#vehicle-questions")).toBeFocused();
    await expect(booking.getByLabel("Booking package", { exact: true })).toHaveValue("p12");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});
