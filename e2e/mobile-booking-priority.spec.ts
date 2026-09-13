import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pickup = "@10.0889,76.35,Priority pickup";
const drop = "@9.97,76.29,Priority drop";
const customer = "@10.04,76.31,Customer meeting point";

test("calculator landing fragments survive hydration and query edits keep input focus", async ({ page, isMobile }) => {
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/directions?*", (route) => route.fulfill({ json: { routed: false } }));
  const query = new URLSearchParams({ car: "eclass", pkg: "p8", stops: `${pickup}~${drop}`, cust: customer });
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  for (const fragment of ["calc-route", "calc-map"]) {
    await page.goto(`/price-calculator?${query}#${fragment}`);
    await expect(page.locator(`#${fragment}`)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`#${fragment}$`));
    await expect(page.locator("#calc-map .leaflet-container")).toBeVisible();
    await page.getByRole("navigation", { name: "Calculator sections" }).getByRole("link", { name: "Route & schedule", exact: true }).click();
    // Start editing immediately, while a fragment focus callback may still be queued.
    const field = page.getByLabel("Pickup date", { exact: true });
    await field.fill(date);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(field).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe(date);
    expect(new URL(page.url()).searchParams.get("cust")).toBe(customer);
    expect(new URL(page.url()).searchParams.get("stops")).toBe(`${pickup}~${drop}`);
  }
});

test("compact mobile calculator shows the map, then the required fields, and opens optional targets on demand", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/price-calculator?car=eclass&pkg=p8&stops=~");
  const action = page.getByRole("region", { name: "Journey action", exact: true });
  await expect(action).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".stickybar:visible")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Quick actions", exact: true })).toBeHidden();
  await expect(page.locator("#calc-map .leaflet-container")).toBeVisible();
  for (const label of ["Pickup location", "Final drop"]) {
    await expect(page.getByRole("combobox", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByLabel("Pickup date", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Pickup time", { exact: true })).toBeVisible();
  await expect(page.locator("#calc-options")).toHaveAttribute("data-open", "false");
  await expect(page.getByLabel("Halt duration", { exact: true })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("calculator-mobile-priority.png") });
  await action.getByRole("link", { name: "Complete trip details", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toBeInViewport({ ratio: 1 });
  expect(new URL(page.url()).searchParams.get("pkg")).toBe("p8");

  await page.getByRole("link", { name: "Route map", exact: true }).click();
  await expect(page.locator("#calc-map")).toBeFocused();
  await expect(page.locator("#calc-map .leaflet-container")).toBeVisible();
  await page.getByRole("button", { name: "Additional trip details", exact: true }).click();
  await page.getByLabel("Halt duration", { exact: true }).fill("2");
  await expect.poll(() => new URL(page.url()).searchParams.get("halt")).toBe("2");
  await page.getByRole("button", { name: "Additional trip details", exact: true }).click();
  await expect(page.getByLabel("Halt duration", { exact: true })).toBeHidden();
  expect(new URL(page.url()).searchParams.get("halt")).toBe("2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("mobile quote action targets the missing date and time while retaining the full journey", async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/directions?*", (route) => route.fulfill({ json: { routed: false } }));
  const query = new URLSearchParams({ car: "eclass", pkg: "p8", trip: "round", stops: `${pickup}~${drop}`, cust: customer });
  await page.goto(`/price-calculator?${query}`);
  // A supplied optional value remains visible instead of becoming a hidden charge/detail.
  await expect(page.locator("#calc-options")).toHaveAttribute("data-open", "true");
  const action = page.getByRole("region", { name: "Journey action", exact: true });
  await action.getByRole("link", { name: "Complete trip details", exact: true }).click();
  await expect(page.getByLabel("Pickup date", { exact: true })).toBeFocused();
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Pickup date", { exact: true }).fill(date);
  await action.getByRole("link", { name: "Complete trip details", exact: true }).click();
  await expect(page.getByLabel("Pickup time", { exact: true })).toBeFocused();
  await page.getByLabel("Pickup time", { exact: true }).fill("10:00");
  const review = action.getByRole("link", { name: "Review & send", exact: true });
  await expect(review).toBeVisible();
  const target = new URL((await review.getAttribute("href"))!, page.url());
  for (const [key, value] of Object.entries({ stops: `${pickup}~${drop}`, cust: customer, trip: "round", pkg: "p8", date, time: "10:00" })) {
    expect(target.searchParams.get(key)).toBe(value);
  }
  const route = await page.locator("#calc-route").boundingBox();
  const map = await page.locator("#calc-map").boundingBox();
  expect(map!.y).toBeLessThan(route!.y);
  await expect(page.locator("#calc-vehicle")).toBeHidden();
  await expect(page.locator("#calc-quote")).toBeHidden();
  await action.getByRole("link", { name: "Details", exact: true }).click();
  await expect(page.locator("#calc-quote")).toBeFocused();
  await expect(page.locator("#calc-route")).toBeHidden();
  await expect(page.getByRole("complementary", { name: "Live journey estimate", exact: true }).getByText(/^GST /)).toBeVisible();
});

test("mobile summary puts price and one contact form before itinerary and focuses rejected submissions", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let requests = 0;
  await page.route("**/api/enquiries", (route) => {
    requests += 1;
    return route.fulfill({ status: 400, json: { error: "Please check the contact number before sending." } });
  });
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const query = new URLSearchParams({ car: "eclass", pkg: "p8", trip: "local", stops: `${pickup}~${drop}`, cust: customer, date, time: "10:00" });
  await page.goto(`/booking-summary?${query}`);
  const receipt = page.getByRole("complementary", { name: "Booking price and contact", exact: true });
  const vehicle = page.getByRole("region", { name: "Selected vehicle and package", exact: true });
  expect((await receipt.boundingBox())!.y).toBeLessThan((await vehicle.boundingBox())!.y);
  await expect(page.locator("#summary-itinerary")).toHaveAttribute("data-open", "false");
  const name = page.getByRole("textbox", { name: "Your name", exact: true });
  await expect(name).toBeInViewport({ ratio: 1 });
  await expect(page.locator("#summary-send")).toHaveCount(1);
  await expect(page.locator(".stickybar:visible")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("summary-mobile-priority.png") });
  await page.getByRole("link", { name: "Send on WhatsApp", exact: true }).click();
  await expect(page.locator("#summary-send")).toBeFocused();
  await name.fill("Mobile guest");
  await page.getByRole("textbox", { name: "Phone", exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Send this quote on WhatsApp", exact: true }).click();
  const feedback = page.getByRole("alert").filter({ hasText: "Please check the contact number before sending." });
  await expect(feedback).toBeFocused();
  await expect(name).toHaveValue("Mobile guest");
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Trip itinerary & distance", exact: true }).click();
  await expect(page.getByText("Priority pickup", { exact: true })).toBeVisible();
  const edit = page.getByRole("link", { name: "Edit journey", exact: false });
  const target = new URL((await edit.getAttribute("href"))!, page.url());
  expect(target.hash).toBe("#calc-route");
  expect(target.searchParams.get("cust")).toBe(customer);
  expect(target.searchParams.get("stops")).toBe(`${pickup}~${drop}`);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
});
