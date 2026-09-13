import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("browse search updates pickup dates and package without losing the rest of the journey", async ({ page, isMobile }, testInfo) => {
  const originalPickup = "@10.0889,76.35,Original pickup";
  const customerLocation = "@10.22,76.42,Customer current location";
  const via = "@10.04,76.31,Intermediate stop";
  const drop = "@9.97,76.29,Final destination";
  const nextPickup = { token: "@10.11,76.38,Marketplace pickup", name: "Marketplace pickup", detail: "Selected live landmark", served: false, isAirport: false };
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { results: [nextPickup] } }));
  await page.goto(`/cars?${new URLSearchParams({ cust: customerLocation })}`);
  if (isMobile) await page.getByRole("button", { name: "Edit journey", exact: true }).click();
  await expect(page.getByRole("form", { name: "Update your journey", exact: true }).getByRole("combobox", { name: "Pickup location", exact: true })).toHaveValue("");
  const initial = new URLSearchParams({ from: originalPickup, cust: customerLocation, stops: [originalPickup, via, drop].join("~"), pkg: "p8", sort: "low", page: "2", time: "10:30", trip: "local", occ: "casual", halt: "1", budget: "500000" });
  await page.goto(`/cars?${initial}`);
  if (isMobile) await page.getByRole("button", { name: "Edit journey", exact: true }).click();
  const before = page.url();
  const search = page.getByRole("form", { name: "Update your journey", exact: true });
  await expect(search.getByRole("combobox", { name: "Pickup location", exact: true })).toHaveValue("Original pickup");
  await expect(page.getByText("Add travel dates to check availability.", { exact: true })).toBeVisible();
  await search.getByRole("combobox", { name: "Pickup location", exact: true }).fill(nextPickup.name);
  await page.getByRole("option", { name: /Marketplace pickup/ }).click();
  const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const returnDate = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
  await search.getByLabel("Pickup date", { exact: true }).fill(date);
  await search.getByLabel("Return date (optional)", { exact: true }).fill(returnDate);
  await search.getByLabel("Rental package", { exact: true }).selectOption("p12");
  await expect(page).toHaveURL(before);
  await search.getByRole("button", { name: "Update search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBe(nextPickup.token);
  const updated = new URL(page.url()).searchParams;
  expect(updated.get("stops")).toBe([nextPickup.token, via, drop].join("~"));
  expect(updated.get("cust")).toBe(customerLocation);
  for (const [key, value] of Object.entries({ date, returnDate, pkg: "p12", sort: "low", time: "10:30", trip: "local", occ: "casual", halt: "1", budget: "500000" })) expect(updated.get(key)).toBe(value);
  expect(updated.has("page")).toBe(false);
  await expect(page.locator("#fleet-results")).toBeFocused();
  if (isMobile) await page.getByRole("button", { name: "Edit journey", exact: true }).click();
  await expect(search.getByLabel("Rental package", { exact: true })).toHaveValue("p12");
  const card = page.getByRole("article").first();
  await expect(card.getByText(/^Base rate in /)).toBeVisible();
  const details = card.getByRole("link", { name: "Price & details", exact: true });
  const outgoing = new URL((await details.getAttribute("href"))!, page.url()).searchParams;
  expect(outgoing.get("stops")).toBe(updated.get("stops"));
  expect(outgoing.get("returnDate")).toBe(returnDate);
  expect(outgoing.get("pkg")).toBe("p12");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('form[aria-label="Update your journey"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("browse-journey-search.png"), fullPage: true });
});

test("vehicle section links move focus while keeping the selected booking package", async ({ page }, testInfo) => {
  await page.goto("/cars/eclass?pkg=p12");
  const navigation = page.getByRole("navigation", { name: "Vehicle details", exact: true });
  const booking = page.getByRole("complementary", { name: "Booking options", exact: true });
  await expect(booking.getByLabel("Booking package", { exact: true })).toHaveValue("p12");
  for (const [label, id] of [["Packages & rates", "rate-card"], ["Availability", "vehicle-availability"], ["What’s included", "vehicle-inclusions"], ["Questions", "vehicle-questions"]]) {
    await navigation.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeFocused();
    await expect(page.locator(`#${id}`)).toBeInViewport();
    await expect(booking.getByLabel("Booking package", { exact: true })).toHaveValue("p12");
  }
  const calculator = booking.getByRole("link", { name: "Get exact price for my route", exact: true });
  expect(new URL((await calculator.getAttribute("href"))!, page.url()).searchParams.get("pkg")).toBe("p12");
  await navigation.getByRole("link", { name: "Packages & rates", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("vehicle-package-navigation.png") });
});
