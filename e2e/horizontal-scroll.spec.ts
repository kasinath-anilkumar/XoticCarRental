import { expect, test, type Locator, type Page } from "@playwright/test";

function horizontalScroll(page: Page, label: string) {
  const viewport = page.locator(`[data-scroll-viewport][aria-label="${label}"]`);
  const wrapper = page.locator("[data-horizontal-scroll]").filter({ has: viewport });
  return {
    viewport,
    wrapper,
    previous: wrapper.getByRole("button", { name: `Previous ${label}`, exact: true }),
    next: wrapper.getByRole("button", { name: `Next ${label}`, exact: true }),
  };
}

const scrollLeft = (viewport: Locator) => viewport.evaluate((element) => element.scrollLeft);
const remaining = (viewport: Locator) => viewport.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft);

async function expectContained(page: Page) {
  const geometry = await page.evaluate(() => ({ left: window.scrollX, overflow: document.documentElement.scrollWidth - window.innerWidth }));
  expect(geometry.left).toBe(0);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 360 : 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/cities/kochi");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test("city navigation scroll buttons move the rail without moving the page", async ({ page }) => {
  const cities = horizontalScroll(page, "Cities");
  await expect(cities.viewport).toHaveAttribute("tabindex", "0");
  await expect.poll(() => remaining(cities.viewport)).toBeGreaterThan(1);
  // Clear persistent bottom actions before measuring whether the click scrolls the page.
  await cities.wrapper.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(cities.next).toBeVisible();
  await cities.viewport.focus();
  await cities.viewport.press("Home");
  await expect.poll(() => scrollLeft(cities.viewport)).toBeLessThanOrEqual(1);
  await expect(cities.previous).toBeDisabled();
  const pageTop = await page.evaluate(() => window.scrollY);

  await cities.next.click();
  await expect.poll(() => scrollLeft(cities.viewport)).toBeGreaterThan(20);
  await expect(cities.previous).toBeEnabled();
  await expect.poll(() => page.evaluate((before) => Math.abs(window.scrollY - before), pageTop)).toBeLessThanOrEqual(2);
  await cities.previous.click();
  await expect.poll(() => scrollLeft(cities.viewport)).toBeLessThanOrEqual(1);
  await expect(cities.previous).toBeDisabled();
  await expectContained(page);

  expect(await cities.viewport.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe("none");
  await expect(cities.viewport.getByRole("link", { name: "Kochi", exact: true })).toHaveAttribute("href", "/cities/kochi");
});

test("city rail supports arrows and boundaries only when its viewport receives the key", async ({ page }) => {
  const cities = horizontalScroll(page, "Cities");
  await cities.wrapper.scrollIntoViewIfNeeded();
  await cities.viewport.focus();
  await expect(cities.viewport).toBeFocused();
  await cities.viewport.press("End");
  await expect.poll(() => remaining(cities.viewport)).toBeLessThanOrEqual(2);
  await expect(cities.next).toBeDisabled();
  await expect(cities.previous).toBeEnabled();
  const end = await scrollLeft(cities.viewport);

  await cities.viewport.press("ArrowLeft");
  await expect.poll(() => scrollLeft(cities.viewport)).toBeLessThan(end - 10);
  await expect(cities.next).toBeEnabled();
  await cities.viewport.press("Home");
  await expect.poll(() => scrollLeft(cities.viewport)).toBeLessThanOrEqual(1);
  await cities.viewport.press("ArrowRight");
  await expect.poll(() => scrollLeft(cities.viewport)).toBeGreaterThan(10);

  await cities.viewport.press("Home");
  await expect.poll(() => scrollLeft(cities.viewport)).toBeLessThanOrEqual(1);
  const firstLink = cities.viewport.getByRole("link").first();
  await firstLink.focus();
  // Descendant links retain their own keyboard behavior. A bubbling key must
  // not be intercepted by the parent's viewport navigation handler.
  const intercepted = await firstLink.evaluate((element) => {
    const event = new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(intercepted).toBe(false);
  await expect.poll(() => scrollLeft(cities.viewport)).toBeLessThanOrEqual(1);
  await expectContained(page);
});

test("vehicle rates preserve table columns and refresh overflow controls after resize", async ({ page }) => {
  const rates = horizontalScroll(page, "Vehicle rates");
  await page.setViewportSize({ width: 360, height: 900 });
  await rates.wrapper.scrollIntoViewIfNeeded();
  await expect(rates.next).toBeVisible();
  await expect.poll(() => remaining(rates.viewport)).toBeGreaterThan(1);
  await expect(rates.viewport).toHaveAttribute("tabindex", "0");
  const table = rates.viewport.getByRole("table");
  expect(await table.locator("thead th").count()).toBeGreaterThanOrEqual(6);
  expect(await table.locator("tbody tr").count()).toBeGreaterThan(0);
  expect(await table.evaluate((element) => getComputedStyle(element).display)).toBe("table");
  const headers = await table.locator("thead th").allTextContents();
  const initialWidth = await table.evaluate((element) => element.getBoundingClientRect().width);

  await rates.viewport.focus();
  const pageTop = await page.evaluate(() => window.scrollY);
  await rates.viewport.press("End");
  await expect.poll(() => remaining(rates.viewport)).toBeLessThanOrEqual(2);
  await expect(rates.next).toBeDisabled();
  await expect(rates.previous).toBeEnabled();
  expect(await table.locator("thead th").allTextContents()).toEqual(headers);
  expect(await table.evaluate((element) => element.getBoundingClientRect().width)).toBeCloseTo(initialWidth, 0);
  await expect.poll(() => page.evaluate((before) => Math.abs(window.scrollY - before), pageTop)).toBeLessThanOrEqual(2);
  expect(await rates.viewport.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe("none");
  await expectContained(page);

  // ResizeObserver must remove stale controls when the same table fits.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => rates.viewport.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await expect(rates.next).not.toBeVisible();
  await expect(rates.previous).not.toBeVisible();
  await expectContained(page);

  // Returning to a narrow viewport must restore the controls without a reload.
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(rates.next).toBeVisible();
  await rates.viewport.focus();
  await rates.viewport.press("Home");
  await expect.poll(() => scrollLeft(rates.viewport)).toBeLessThanOrEqual(1);
  await expect(rates.next).toBeEnabled();
  await expect(rates.previous).toBeDisabled();
  await expectContained(page);
});
