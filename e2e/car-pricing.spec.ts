import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const pickup = "@10.0889,76.35,Selected pickup + landmark";

function bookingPanel(page: Page) {
  return page.getByRole("complementary", { name: "Booking options", exact: true });
}

function rateCard(page: Page) {
  return page.getByRole("region", { name: "Rate card", exact: true });
}

async function openCar(page: Page, query = "") {
  const response = await page.goto(`/cars/eclass${query ? `?${query}` : ""}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mercedes-Benz E-Class");
  await expect(bookingPanel(page).getByLabel("Booking package", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function expectNoNestedScrolling(container: Locator) {
  const overflowing = await container.evaluate((root) => [root, ...root.querySelectorAll("*")]
    .filter((element): element is HTMLElement => element instanceof HTMLElement && element.getClientRects().length > 0)
    // Native option menus are browser controls, not page scroll containers.
    .filter((element) => !element.matches("select, option"))
    .filter((element) => {
      const style = getComputedStyle(element);
      return (/auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2)
        || (/auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2);
    })
    .map((element) => ({ tag: element.tagName, label: element.getAttribute("aria-label"), class: element.className })));
  expect(overflowing).toEqual([]);
  const geometry = await container.evaluate((element) => ({
    horizontalOverflow: element.scrollWidth - element.clientWidth,
    verticalOverflow: element.scrollHeight - element.clientHeight,
  }));
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(2);
  expect(geometry.verticalOverflow).toBeLessThanOrEqual(2);
}

async function expectBookingControlsFit(page: Page, testInfo: TestInfo) {
  const panel = bookingPanel(page);
  await expect(panel).toHaveCSS("max-height", "none");
  await expectNoNestedScrolling(panel);
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  const controls = [
    panel.getByRole("status", { name: "Starting package price", exact: true }),
    panel.getByLabel("Booking package", { exact: true }),
    panel.getByRole("link", { name: "Get exact price for my route", exact: true }),
    panel.getByRole("link", { name: "Enquire on WhatsApp", exact: true }),
  ];
  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
    expect(box!.y).toBeGreaterThanOrEqual(bounds!.y - 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
  }
  // One document scroll should expose the price and both primary actions.
  // An internally scrolling aside could otherwise pass basic visibility checks.
  await panel.evaluate((element) => {
    const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0;
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - headerHeight - 20, behavior: "instant" });
  });
  await expect(controls[0]).toBeInViewport({ ratio: 1 });
  await expect(controls[2]).toBeInViewport({ ratio: 1 });
  await expect(controls[3]).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath("pricing.png") });
}

async function expectPricingAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('aside[aria-label="Booking options"]')
    .include("#rate-card")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

async function scrollDocument(page: Page, top: number) {
  await page.evaluate((position) => window.scrollTo({ top: position, behavior: "instant" }), top);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function panelMetrics(panel: Locator) {
  return panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      documentTop: box.top + window.scrollY,
      top: box.top,
      height: box.height,
      viewportHeight: window.innerHeight,
      headerHeight: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0,
    };
  });
}

test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("booking actions and package rates fit without nested scrolling", async ({ page, isMobile }, testInfo) => {
  await openCar(page);
  await expectBookingControlsFit(page, testInfo);
  if (isMobile) {
    const panel = bookingPanel(page);
    await expect(panel).toHaveCSS("position", "static");
    const before = await panel.boundingBox();
    const oldScroll = await page.evaluate(() => window.scrollY);
    await scrollDocument(page, oldScroll + 120);
    const scrollDistance = await page.evaluate((previous) => window.scrollY - previous, oldScroll);
    expect(scrollDistance).toBeGreaterThan(100);
    const after = await panel.boundingBox();
    expect(Math.abs(after!.y - (before!.y - scrollDistance))).toBeLessThanOrEqual(2);
  }
  const rates = rateCard(page);
  await rates.scrollIntoViewIfNeeded();
  await expectNoNestedScrolling(rates);
  await expect(rates.getByRole("button", { name: /^Select .+ package$/ }).first()).toBeVisible();
  await rates.screenshot({ path: testInfo.outputPath("rate-card.png") });
  // Availability remains in the document flow after prices, outside the aside.
  const from = page.getByLabel("From", { exact: true });
  const availability = page.locator("form").filter({ has: from });
  await expect(bookingPanel(page).getByLabel("From", { exact: true })).toHaveCount(0);
  await expect(availability.getByLabel("Days", { exact: true })).toBeVisible();
  await expect(availability.getByRole("button", { name: "Check", exact: true })).toBeVisible();
  const rateBounds = await rates.boundingBox();
  const availabilityBounds = await availability.boundingBox();
  expect(availabilityBounds!.y).toBeGreaterThanOrEqual(rateBounds!.y + rateBounds!.height - 1);
  await expectPricingAccessible(page);
});

for (const viewport of [{ width: 1280, height: 650 }, { width: 1440, height: 900 }]) {
  test(`booking panel stays pinned while scrolling at ${viewport.width}x${viewport.height}`, async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, "Desktop sticky behavior has a separate mobile flow check.");
    await page.setViewportSize(viewport);
    await openCar(page);
    const panel = bookingPanel(page);
    await expect(panel).toHaveCSS("position", "sticky");
    await scrollDocument(page, 0);
    const metrics = await panelMetrics(panel);
    const headerTop = metrics.headerHeight + 24;
    const expectedTop = Math.min(headerTop, metrics.viewportHeight - metrics.height - 24);
    if (viewport.height === 900) expect(expectedTop).toBe(headerTop);
    const firstScroll = metrics.documentTop - expectedTop + 100;
    await scrollDocument(page, firstScroll);
    await expect.poll(async () => Math.abs((await panel.boundingBox())!.y - expectedTop)).toBeLessThanOrEqual(2);
    const firstPosition = await panel.boundingBox();
    const firstDocumentScroll = await page.evaluate(() => window.scrollY);
    await scrollDocument(page, firstScroll + 260);
    expect(await page.evaluate((previous) => window.scrollY - previous, firstDocumentScroll)).toBeGreaterThan(240);
    const secondPosition = await panel.boundingBox();
    expect(Math.abs(secondPosition!.y - firstPosition!.y)).toBeLessThanOrEqual(2);
    if (expectedTop === headerTop) expect(secondPosition!.y).toBeGreaterThanOrEqual(metrics.headerHeight + 22);
    await expect(panel.getByRole("link", { name: "Get exact price for my route", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(panel.getByRole("link", { name: "Enquire on WhatsApp", exact: true })).toBeInViewport({ ratio: 1 });
    await expectNoNestedScrolling(panel);
    await page.screenshot({ path: testInfo.outputPath("sticky-booking.png") });
  });
}

test("an oversized desktop booking panel keeps lower actions reachable through page scrolling", async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, "Desktop sticky behavior has a separate mobile flow check.");
  await page.setViewportSize({ width: 1280, height: 480 });
  await openCar(page);
  const panel = bookingPanel(page);
  await expect(panel).toHaveCSS("position", "sticky");
  await scrollDocument(page, 0);
  const metrics = await panelMetrics(panel);
  expect(metrics.height).toBeGreaterThan(metrics.viewportHeight - metrics.headerHeight - 48);
  const expectedTop = metrics.viewportHeight - metrics.height - 24;
  const firstScroll = metrics.documentTop - expectedTop + 100;
  await scrollDocument(page, firstScroll);
  await expect.poll(async () => Math.abs((await panel.boundingBox())!.y - expectedTop)).toBeLessThanOrEqual(2);
  await scrollDocument(page, firstScroll + 220);
  await expect.poll(async () => Math.abs((await panel.boundingBox())!.y - expectedTop)).toBeLessThanOrEqual(2);
  for (const label of ["Get exact price for my route", "Enquire on WhatsApp", "Compare packages & charges"]) {
    const action = panel.getByRole("link", { name: label, exact: true });
    await expect(action).toBeInViewport({ ratio: 1 });
    const box = await action.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(metrics.headerHeight);
    expect(box!.y + box!.height).toBeLessThanOrEqual(metrics.viewportHeight - 22);
  }
  await expect(panel).toHaveCSS("max-height", "none");
  await expectNoNestedScrolling(panel);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath("short-sticky-booking.png") });
});

test("package cards and booking select synchronize price and calculator journey", async ({ page, isMobile }, testInfo) => {
  const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const returnDate = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
  await openCar(page, new URLSearchParams({ pkg: "p12", from: pickup, date, returnDate }).toString());
  const panel = bookingPanel(page);
  const select = panel.getByLabel("Booking package", { exact: true });
  const price = panel.getByRole("status", { name: "Starting package price", exact: true });
  const rates = rateCard(page);
  const options = await select.locator("option").evaluateAll((items) => items.map((item) => {
    const option = item as HTMLOptionElement;
    return { value: option.value, label: option.label };
  }));
  expect(options.length).toBeGreaterThan(1);
  await expect(select).toHaveValue("p12");
  await expect(rates.locator('[data-package-slug="p12"]')).toHaveAttribute("aria-pressed", "true");

  const selected = options[options.length - 1];
  await select.selectOption(selected.value);
  const selectedCard = rates.getByRole("button", { name: `Select ${selected.label} package`, exact: true });
  await expect(selectedCard).toHaveAttribute("aria-pressed", "true");
  await expect(rates.locator('[data-package-slug][aria-pressed="true"]')).toHaveCount(1);
  await expect(selectedCard).toContainText((await price.innerText()).trim());
  await expectBookingControlsFit(page, testInfo);

  const alternative = options.find((option) => option.value !== selected.value)!;
  const alternativeCard = rates.getByRole("button", { name: `Select ${alternative.label} package`, exact: true });
  await alternativeCard.focus();
  await alternativeCard.press("Enter");
  await expect(select).toHaveValue(alternative.value);
  await expect(alternativeCard).toHaveAttribute("aria-pressed", "true");
  await expect(selectedCard).toHaveAttribute("aria-pressed", "false");
  await expect(alternativeCard).toContainText((await price.innerText()).trim());

  const calculator = panel.getByRole("link", { name: "Get exact price for my route", exact: true });
  const href = new URL((await calculator.getAttribute("href"))!, page.url());
  expect(href.pathname).toBe("/price-calculator");
  expect(href.searchParams.get("pkg")).toBe(alternative.value);
  expect(href.searchParams.get("from")).toBe(pickup);
  expect(href.searchParams.get("date")).toBe(date);
  expect(href.searchParams.get("returnDate")).toBe(returnDate);
  if (isMobile) {
    await expect(page.getByRole("link", { name: "Price my route", exact: true })).toHaveAttribute("href", `${href.pathname}${href.search}`);
  }
  // Package selection is immediate local state; it does not replace the URL's journey.
  expect(new URL(page.url()).searchParams.get("pkg")).toBe("p12");
});

test("service-city search changes comparison rates without relabeling the home estimate", async ({ page }) => {
  await openCar(page);
  const panel = bookingPanel(page);
  const price = panel.getByRole("status", { name: "Starting package price", exact: true });
  const homePrice = (await price.innerText()).trim();
  const calculator = panel.getByRole("link", { name: "Get exact price for my route", exact: true });
  const homeHref = await calculator.getAttribute("href");
  const rates = rateCard(page);
  const packageCards = rates.getByRole("button", { name: /^Select .+ package$/ });
  const homeRates = await packageCards.allTextContents();
  const homeNote = "Booking estimate uses Kochi. Choose your route for the final quote.";
  await expect(rates).toContainText(homeNote);

  await rates.getByRole("button", { name: "Change package city", exact: true }).click();
  const search = rates.getByRole("searchbox", { name: "Search service cities", exact: true });
  await expect(search).toBeFocused();
  const cityChoices = rates.getByRole("button", { name: /^Use .+ for package rates$/ });
  const initialCityCount = await cityChoices.count();
  expect(initialCityCount).toBeGreaterThan(0);
  expect(initialCityCount).toBeLessThanOrEqual(8);
  const moreCities = rates.getByRole("button", { name: "Show more service cities", exact: true });
  if (await moreCities.isVisible()) {
    await moreCities.click();
    expect(await cityChoices.count()).toBeGreaterThan(initialCityCount);
    expect(await cityChoices.count()).toBeLessThanOrEqual(initialCityCount + 8);
  }
  await expectNoNestedScrolling(rates);
  await rates.getByLabel("State or territory", { exact: true }).selectOption("Maharashtra");
  await search.fill("No service city matches this query");
  await expect(rates.getByRole("button", { name: /^Use .+ for package rates$/ })).toHaveCount(0);
  await search.fill("Mumbai");
  const mumbai = rates.getByRole("button", { name: "Use Mumbai for package rates", exact: true });
  await expect(mumbai).toBeVisible();
  await expect(rates.getByRole("button", { name: /^Use .+ for package rates$/ })).toHaveCount(1);
  await expectPricingAccessible(page);
  await mumbai.click();
  await expect(search).toHaveCount(0);
  await expect.poll(() => packageCards.allTextContents()).not.toEqual(homeRates);
  await expect(rates).toContainText("Mumbai");
  await expect(rates).toContainText(homeNote);
  await expect(price).toHaveText(homePrice);
  await expect(panel).toContainText("Base rate in Kochi.");
  await expect(calculator).toHaveAttribute("href", homeHref!);
  await expectNoNestedScrolling(rates);

  // Returning to the home city restores its rates and retains the chosen package.
  const chosen = await panel.getByLabel("Booking package", { exact: true }).inputValue();
  await rates.getByRole("button", { name: "Change package city", exact: true }).click();
  await rates.getByLabel("State or territory", { exact: true }).selectOption("all");
  await search.fill("Kochi");
  await rates.getByRole("button", { name: "Use Kochi for package rates", exact: true }).click();
  await expect.poll(() => packageCards.allTextContents()).toEqual(homeRates);
  await expect(panel.getByLabel("Booking package", { exact: true })).toHaveValue(chosen);
});
