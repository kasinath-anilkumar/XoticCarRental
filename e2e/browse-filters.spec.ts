import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pickup = "@10.0889,76.35,Selected pickup + landmark";

async function openFilters(page: Page, mobile: boolean): Promise<Locator> {
  if (mobile) {
    await page.getByRole("button", { name: /^Filters/ }).click();
    return page.getByRole("dialog", { name: "Filters", exact: true });
  }
  return page.getByRole("form", { name: "Fleet filters", exact: true });
}

async function openSection(filters: Locator, label: string) {
  const summary = filters.locator("summary").filter({ hasText: new RegExp(`^${label}`) });
  if (await summary.locator("..").getAttribute("open") === null) await summary.click();
}

async function apply(filters: Locator, mobile: boolean) {
  await filters.getByRole("button", { name: mobile ? "Show matching cars" : "Apply filters", exact: true }).click();
}

function expectJourney(page: Page) {
  const query = new URL(page.url()).searchParams;
  expect(query.get("from")).toBe(pickup);
  expect(query.get("pkg")).toBe("p12");
  return query;
}

test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("location choices remain a draft until one apply and clear an incompatible city", async ({ page, isMobile }) => {
  const query = new URLSearchParams({ from: pickup, pkg: "p12", sort: "low", page: "2", state: "Kerala", city: "kochi" });
  await page.goto(`/cars?${query}`);
  const before = page.url();
  const filters = await openFilters(page, isMobile);
  await openSection(filters, "Location");
  const state = filters.getByLabel("State or territory", { exact: true });
  const otherState = await state.locator('option:not([value="all"]):not([value="Kerala"])').first().getAttribute("value");
  expect(otherState).toBeTruthy();
  await state.selectOption(otherState!);
  await openSection(filters, "Service city");
  await expect(filters.locator('input[name$="-city"][value="all"]')).toBeChecked();
  await expect(filters.locator('input[name$="-city"][value="kochi"]')).toHaveCount(0);
  const city = filters.locator('input[name$="-city"]:not([value="all"])').first();
  const citySlug = await city.getAttribute("value");
  expect(citySlug).toBeTruthy();
  await city.check();
  const search = filters.getByLabel("Search service cities", { exact: true });
  await search.fill("No service city matches this query");
  await expect(filters.locator('input[name$="-city"]:not([value="all"])')).toHaveCount(0);
  await search.fill("");
  await expect(filters.locator(`input[name$="-city"][value="${citySlug}"]`)).toBeChecked();
  await expect(page).toHaveURL(before);
  expect(new URL(page.url()).searchParams.get("city")).toBe("kochi");
  for (const section of ["Vehicle type", "Passengers", "Budget", "Travel dates", "Sort"]) {
    await openSection(filters, section);
  }
  await expect(filters.locator("details[open]")).toHaveCount(7);
  await page.evaluate(() => document.fonts.ready);
  const accessibility = await new AxeBuilder({ page })
    .include(isMobile ? "dialog[open]" : 'form[aria-label="Fleet filters"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  await apply(filters, isMobile);
  await expect.poll(() => new URL(page.url()).searchParams.get("city")).toBe(citySlug);
  const applied = expectJourney(page);
  expect(applied.get("state")).toBe(otherState);
  expect(applied.get("sort")).toBe("low");
  expect(applied.get("page")).toBeNull();
});

test("a legacy budget floor survives an unrelated draft selection", async ({ page, isMobile }) => {
  await page.goto(`/cars?${new URLSearchParams({ from: pickup, pkg: "p12", budget: "30000+", sort: "high", page: "2" })}`);
  const filters = await openFilters(page, isMobile);
  await openSection(filters, "Budget");
  await expect(filters.getByLabel("Minimum estimated amount (₹)")).toHaveValue("30000");
  await expect(filters).toContainText("At least ₹30,000");
  await openSection(filters, "Passengers");
  await filters.locator('input[name$="-seats"][value="4"]').check();
  await apply(filters, isMobile);
  await expect.poll(() => new URL(page.url()).searchParams.get("seats")).toBe("4");
  const applied = expectJourney(page);
  expect(applied.get("budget")).toBe("30000+");
  expect(applied.get("sort")).toBe("high");
  expect(applied.get("page")).toBeNull();
  await expect(page.getByRole("link", { name: "Remove the At least ₹30,000 filter", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Remove the At least ₹30,000 filter", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("budget")).toBe(false);
  const removed = expectJourney(page);
  expect(removed.get("seats")).toBe("4");
  expect(removed.get("sort")).toBe("high");
});

test("date range apply and date-chip removal preserve the pickup package and sorting", async ({ page, isMobile }) => {
  await page.goto(`/cars?${new URLSearchParams({ from: pickup, pkg: "p12", sort: "low", page: "2" })}`);
  const before = page.url();
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const returnDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const filters = await openFilters(page, isMobile);
  await openSection(filters, "Travel dates");
  await filters.getByLabel("Pickup date", { exact: true }).fill(date);
  await filters.getByLabel("Return date (optional)", { exact: true }).fill(returnDate);
  await expect(page).toHaveURL(before);
  await apply(filters, isMobile);
  await expect.poll(() => new URL(page.url()).searchParams.get("returnDate")).toBe(returnDate);
  let applied = expectJourney(page);
  expect(applied.get("date")).toBe(date);
  expect(applied.get("sort")).toBe("low");
  expect(applied.get("page")).toBeNull();
  const dateChip = page.getByRole("link", { name: /^Remove the / })
    .filter({ has: page.getByText("Dates", { exact: true }) });
  const displayDate = (value: string) => new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
  await expect(dateChip).toHaveAccessibleName(`Remove the ${displayDate(date)} – ${displayDate(returnDate)} filter`);
  await dateChip.click();
  await expect.poll(() => new URL(page.url()).searchParams.has("date")).toBe(false);
  applied = expectJourney(page);
  expect(applied.has("returnDate")).toBe(false);
  expect(applied.get("sort")).toBe("low");
});

test("reset edits the draft and clears filters only when applied", async ({ page, isMobile }) => {
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const returnDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/cars?${new URLSearchParams({ from: pickup, pkg: "p12", sort: "high", page: "2", city: "kochi", state: "Kerala", seats: "4", budget: "30000+", occasion: "wedding", occ: "wedding", date, returnDate })}`);
  const before = page.url();
  const filters = await openFilters(page, isMobile);
  await filters.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page).toHaveURL(before);
  await apply(filters, isMobile);
  await expect.poll(() => new URL(page.url()).searchParams.has("city")).toBe(false);
  const applied = expectJourney(page);
  for (const key of ["state", "type", "seats", "occasion", "budget", "date", "returnDate", "sort", "page"]) expect(applied.has(key), key).toBe(false);
  expect(applied.get("occ")).toBe("wedding");
});

test("closing the mobile sheet discards unapplied changes and restores focus", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Only the mobile presentation has a dismissible sheet.");
  await page.goto(`/cars?${new URLSearchParams({ from: pickup, pkg: "p12", budget: "500000", sort: "low" })}`);
  const before = page.url();
  const trigger = page.getByRole("button", { name: /^Filters/ });
  let filters = await openFilters(page, true);
  await openSection(filters, "Budget");
  await filters.getByLabel("Maximum estimated amount (₹)").fill("12345.67");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Filters", exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(before);
  filters = await openFilters(page, true);
  await openSection(filters, "Budget");
  await expect(filters.getByLabel("Maximum estimated amount (₹)")).toHaveValue("500000");
  await filters.getByRole("button", { name: "Close filters", exact: true }).click();
  expectJourney(page);
});

test("sort stays in the draft until applied and browser Back restores the applied selection", async ({ page, isMobile }) => {
  await page.goto(`/cars?${new URLSearchParams({ from: pickup, pkg: "p12", sort: "low", budget: "500000" })}`);
  const before = page.url();
  let filters = await openFilters(page, isMobile);
  await openSection(filters, "Sort");
  await filters.getByLabel("Sort order", { exact: true }).selectOption("high");
  await expect(page).toHaveURL(before);
  await apply(filters, isMobile);
  await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("high");
  expectJourney(page);
  await page.goBack();
  await expect(page).toHaveURL(before);
  filters = await openFilters(page, isMobile);
  await openSection(filters, "Sort");
  await expect(filters.getByLabel("Sort order", { exact: true })).toHaveValue("low");
});

test("toolbar sorting applies immediately while preserving context and browser Back restores it", async ({ page }) => {
  await page.goto(`/cars?${new URLSearchParams({ from: pickup, pkg: "p12", budget: "500000", sort: "low", page: "2" })}`);
  const before = page.url();
  const sort = page.getByRole("combobox", { name: "Sort by", exact: true });
  await expect(sort).toHaveValue("low");
  await sort.selectOption("high");
  await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("high");
  const applied = expectJourney(page);
  expect(applied.get("budget")).toBe("500000");
  expect(applied.has("page")).toBe(false);
  await expect(sort).toHaveValue("high");
  await page.goBack();
  await expect(page).toHaveURL(before);
  await expect(sort).toHaveValue("low");
});

for (const budget of ["0", "1e4"]) {
  test(`invalid budget ${budget} prevents apply and reveals its collapsed section`, async ({ page, isMobile }) => {
    await page.goto(`/cars?${new URLSearchParams({ from: pickup, pkg: "p12", sort: "low" })}`);
    const before = page.url();
    const filters = await openFilters(page, isMobile);
    await openSection(filters, "Budget");
    const amount = filters.getByLabel("Maximum estimated amount (₹)");
    await amount.fill(budget);
    // Exponent notation is valid to the browser's number input but rejected by
    // the application's rupee parser; zero exercises native minimum validation.
    expect(await amount.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(budget === "1e4");
    const summary = filters.locator("summary").filter({ hasText: /^Budget/ });
    await summary.click();
    await expect(summary.locator("..")).not.toHaveAttribute("open", "");
    await apply(filters, isMobile);
    await expect(page).toHaveURL(before);
    await expect(summary.locator("..")).toHaveAttribute("open", "");
    await expect(amount).toBeVisible();
    await expect(amount).toBeFocused();
  });
}
