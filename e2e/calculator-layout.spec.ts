import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const viewports = [
  { width: 1024, height: 768, mobile: false },
  { width: 1280, height: 650, mobile: false },
  { width: 1440, height: 900, mobile: false },
  { width: 390, height: 844, mobile: true },
  { width: 320, height: 740, mobile: true },
];

test("an empty calculator shows the vehicle base map without inventing a journey", async ({ page, isMobile }, testInfo) => {
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let directionsRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/directions") directionsRequests += 1;
  });
  await page.goto("/price-calculator?car=eclass&stops=");
  if (isMobile) await page.getByRole("link", { name: "Route map", exact: true }).click();
  const map = page.getByRole("region", { name: "Route Map & Live Distance", exact: true });
  await map.scrollIntoViewIfNeeded();
  await expect(map.locator(".leaflet-container")).toBeVisible();
  await expect(map.locator(".xotic-pin")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Final drop", exact: true })).toHaveValue("");
  await expect(map).toContainText("Add your route");
  await expect(map).toContainText("Vehicle base");
  await expect(page.getByRole("region", { name: "Distance breakdown", exact: true })).toHaveCount(0);
  expect(directionsRequests).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("calculator-base-map.png") });
});

async function boundsOf(section: Locator) {
  const bounds = await section.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

for (const viewport of viewports) {
test(`calculator places the map and keeps the complete journey usable at ${viewport.width}x${viewport.height}`, async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile !== viewport.mobile, "Run each viewport in its matching desktop or mobile browser project.");
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/directions?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const points = params.get("stops")!.split(";").map((point) => point.split(",").map(Number));
    const legs = points.slice(1).map((_, index) => ({ km: 12 + index, minutes: 20 + index }));
    await route.fulfill({ json: {
      routed: true, scope: "vehicle", path: points, legs,
      km: legs.reduce((sum, leg) => sum + leg.km, 0),
      minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    } });
  });
  const params = new URLSearchParams({
    car: "eclass", pkg: "p8", trip: "local",
    stops: "@10.0889,76.35,Review pickup~@9.97,76.29,Review drop",
  });
  await page.goto(`/price-calculator?${params}`);
  const navigation = page.getByRole("navigation", { name: "Calculator sections" });
  await expect(navigation.getByRole("listitem")).toHaveCount(3);
  const roadmapSteps = [
    ["Route & schedule", "#calc-route"],
    ["Car & package", "#calc-vehicle"],
    ["Your quote", "#calc-quote"],
  ];
  await expect(navigation.getByRole("link")).toHaveCount(roadmapSteps.length);
  for (const [index, [label, href]] of roadmapSteps.entries()) {
    const link = navigation.getByRole("link").nth(index);
    await expect(link).toHaveAccessibleName(label);
    await expect(link).toHaveAttribute("href", href);
  }
  const routeProgress = navigation.getByRole("listitem").first();
  const routeLink = navigation.getByRole("link", { name: "Route & schedule", exact: true });
  await expect(routeProgress.getByText("Completed step:", { exact: true })).toHaveCount(0);
  await expect(routeLink).toHaveAttribute("aria-current", "step");
  await expect(navigation.locator('[aria-current="step"]')).toHaveCount(1);
  const route = page.getByRole("region", { name: "Route & Schedule", exact: true });
  const vehicle = page.getByRole("region", { name: "Car & package", exact: true });
  const map = page.getByRole("region", { name: "Route Map & Live Distance", exact: true });
  const quote = page.getByRole("complementary", { name: "Live journey estimate", exact: true });
  const distance = page.getByRole("region", { name: "Distance breakdown", exact: true });
  if (isMobile) {
    await expect(page.locator("#calc-map")).toHaveAttribute("data-open", "false");
    await expect(page.locator("#calc-distance")).toHaveAttribute("data-open", "false");
    await page.getByRole("link", { name: "Route map", exact: true }).click();
    await page.getByRole("button", { name: "How the distance is calculated", exact: true }).click();
  }
  for (const section of [route, vehicle, map, quote, distance]) await expect(section).toBeVisible();
  await expect(distance).toContainText("Uses road-route distances");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("button", { name: /^Next:/ })).toHaveCount(0);
  await expect(map).toHaveCount(1);
  await expect(quote).toHaveCount(1);
  await expect(map.getByRole("region", { name: "Distance breakdown", exact: true })).toHaveCount(0);

  const [routeBounds, mapBounds, vehicleBounds, quoteBounds, distanceBounds] = await Promise.all(
    [route, map, vehicle, quote, distance].map(boundsOf),
  );
  if (isMobile) {
    const navigationBounds = await boundsOf(navigation);
    expect(routeBounds.y).toBeGreaterThanOrEqual(navigationBounds.y + navigationBounds.height - 2);
    const ordered = [routeBounds, vehicleBounds, quoteBounds, mapBounds, distanceBounds];
    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index].y).toBeGreaterThanOrEqual(ordered[index - 1].y + ordered[index - 1].height - 2);
    }
    for (const bounds of ordered) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  } else {
    const journey = page.locator("#calc-journey");
    const journeyBounds = await boundsOf(journey);
    const mapColumn = await boundsOf(page.locator("#calc-map"));
    expect(journeyBounds.x).toBeGreaterThanOrEqual(mapColumn.x + mapColumn.width + 12);
    expect(Math.abs(mapColumn.y - journeyBounds.y)).toBeLessThanOrEqual(2);
    expect(mapColumn.height).toBeLessThanOrEqual(viewport.height);
    expect(routeBounds.x).toBeGreaterThanOrEqual(journeyBounds.x);
    expect(routeBounds.x + routeBounds.width).toBeLessThanOrEqual(journeyBounds.x + journeyBounds.width + 1);
    expect(Math.abs(vehicleBounds.x - routeBounds.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(vehicleBounds.width - routeBounds.width)).toBeLessThanOrEqual(2);
    expect(vehicleBounds.y).toBeGreaterThanOrEqual(routeBounds.y + routeBounds.height - 2);
    expect(Math.abs(quoteBounds.x - routeBounds.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(quoteBounds.width - routeBounds.width)).toBeLessThanOrEqual(2);
    expect(quoteBounds.y).toBeGreaterThanOrEqual(vehicleBounds.y + vehicleBounds.height - 2);
    expect(Math.abs(distanceBounds.x - routeBounds.x)).toBeLessThanOrEqual(2);
    expect(distanceBounds.y).toBeGreaterThanOrEqual(quoteBounds.y + quoteBounds.height - 2);
    expect(await journey.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.maxHeight === "none" && !["auto", "scroll", "hidden"].includes(style.overflowY)
        && element.scrollHeight <= element.clientHeight + 1;
    })).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("calculator-columns.png") });

  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Pickup date", { exact: true }).fill(date);
  await page.getByLabel("Pickup time", { exact: true }).fill("10:00");
  await expect(routeProgress.getByText("Completed step:", { exact: true })).toHaveCount(1);
  // Completion follows the required values, so clearing a previously valid
  // date must not leave a misleading completed marker or bookable action.
  await page.getByLabel("Pickup date", { exact: true }).fill("");
  await expect(routeProgress.getByText("Completed step:", { exact: true })).toHaveCount(0);
  await expect(quote.getByRole("button", { name: "Review & confirm on WhatsApp", exact: true })).toBeDisabled();
  await expect(routeLink).toHaveAttribute("aria-current", "step");
  await page.getByLabel("Pickup date", { exact: true }).fill(date);
  await expect(routeProgress.getByText("Completed step:", { exact: true })).toHaveCount(1);
  if (isMobile) await page.getByRole("button", { name: "Additional trip details", exact: true }).click();
  await page.getByLabel("Halt duration", { exact: true }).fill("2");
  await expect(page).toHaveURL(new RegExp(`date=${date}`));

  await navigation.getByRole("link", { name: "Car & package", exact: true }).click();
  await expect(page).toHaveURL(/#calc-vehicle$/);
  await expect(vehicle).toBeFocused();
  await expect(navigation.getByRole("link", { name: "Car & package", exact: true })).toHaveAttribute("aria-current", "step");
  await expect(routeLink).not.toHaveAttribute("aria-current", "step");
  await expect(navigation.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Select luxury vehicle:", exact: true })).toBeVisible();

  if (isMobile) await page.getByRole("link", { name: "Details", exact: true }).click();
  else await navigation.getByRole("link", { name: "Your quote", exact: true }).click();
  await expect(page).toHaveURL(/#calc-quote$/);
  await expect(quote).toBeFocused();
  await expect(navigation.getByRole("link", { name: "Your quote", exact: true })).toHaveAttribute("aria-current", "step");
  await expect(navigation.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(quote.getByRole("heading", { name: "Your quote", exact: true })).toBeInViewport();
  if (!isMobile) await expect(page.locator("#calc-map")).toBeInViewport({ ratio: 0.99 });
  expect(await quote.evaluate((element) => {
    const style = getComputedStyle(element);
    return !["sticky", "fixed", "absolute"].includes(style.position) && style.maxHeight === "none"
      && !["auto", "scroll", "hidden"].includes(style.overflowY)
      && element.scrollHeight <= element.clientHeight + 1;
  })).toBe(true);
  await expect(page.getByLabel("Pickup date", { exact: true })).toHaveValue(date);
  await expect(page.getByLabel("Pickup time", { exact: true })).toHaveValue("10:00");
  await expect(page.getByLabel("Halt duration", { exact: true })).toHaveValue("2");
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toHaveValue("Review pickup");
  await expect(page.getByRole("combobox", { name: "Final drop", exact: true })).toHaveValue("Review drop");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("calculator-quote.png") });
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({ path: testInfo.outputPath("calculator-all-in-one.png"), fullPage: true });
});
}
