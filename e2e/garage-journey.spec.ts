import { expect, test } from "@playwright/test";

// Synthetic road distances pin the billing contract, not real fares or road lengths.
const legKm = [60, 720, 730, 65];
const stops = ["@9.4981,76.3388,Alappuzha pickup", "@13.0827,80.2707,Chennai destination", "@9.4981,76.3388,Alappuzha client drop"];

for (const tripType of ["round", "oneway"]) {
  test(`${tripType} bills garage pickup destination drop and garage exactly once`, async ({ page, isMobile }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    let points: number[][] = [];
    await page.route("**/api/directions?*", async (route) => {
      const query = new URL(route.request().url()).searchParams;
      expect(query.get("scope")).toBe("vehicle");
      points = query.get("stops")!.split(";").map((point) => point.split(",").map(Number));
      await route.fulfill({ json: {
        routed: true, scope: "vehicle", km: 1575, minutes: 1800,
        legs: legKm.map((km) => ({ km, minutes: 450 })), path: points,
      } });
    });
    const query = new URLSearchParams({ car: "eclass", pkg: "p8", trip: tripType, stops: stops.join("~") });
    await page.goto(`/price-calculator?${query}`);
    if (isMobile) await page.getByRole("button", { name: "How the distance is calculated", exact: true }).click();
    const breakdown = page.getByRole("region", { name: "Distance breakdown", exact: true });
    await expect(breakdown).toContainText("1,575 km");
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual(points[4]);
    expect(points[1]).toEqual([9.4981, 76.3388]);
    expect(points[2]).toEqual([13.0827, 80.2707]);
    expect(points[3]).toEqual([9.4981, 76.3388]);
    const legs = breakdown.getByRole("listitem");
    await expect(legs).toHaveCount(4);
    const labels = [
      ["Garage", "Alappuzha pickup"], ["Alappuzha pickup", "Chennai destination"],
      ["Chennai destination", "Alappuzha client drop"], ["Alappuzha client drop", "Garage"],
    ];
    for (let index = 0; index < legKm.length; index += 1) {
      await expect(legs.nth(index)).toContainText(`${legKm[index]} km`);
      for (const label of labels[index]) await expect(legs.nth(index)).toContainText(label);
    }
    const quote = page.getByRole("complementary", { name: "Live journey estimate", exact: true });
    await expect(quote).not.toContainText("One-way driver return");
    await expect(quote).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
    await breakdown.screenshot({ path: testInfo.outputPath("garage-distance.png") });
  });
}

test("a two-stop round trip labels the destination and returns to pickup without adding an editable stop", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let points: number[][] = [];
  await page.route("**/api/directions?*", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get("scope")).toBe("vehicle");
    points = query.get("stops")!.split(";").map((point) => point.split(",").map(Number));
    await route.fulfill({ json: {
      routed: true, scope: "vehicle", km: 1575, minutes: 1800,
      legs: legKm.map((km) => ({ km, minutes: 450 })), path: points,
    } });
  });
  const query = new URLSearchParams({ car: "eclass", pkg: "p8", trip: "round", stops: stops.slice(0, 2).join("~") });
  await page.goto(`/price-calculator?${query}`);
  if (isMobile) await page.getByRole("button", { name: "How the distance is calculated", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Pickup location", exact: true })).toHaveValue("Alappuzha pickup");
  await expect(page.getByRole("combobox", { name: "Destination", exact: true })).toHaveValue("Chennai destination");
  await expect(page.getByRole("combobox", { name: "Final drop", exact: true })).toHaveCount(0);
  const editableStops = page.locator('#calc-route input[id^="calc-stop-"]');
  await expect(editableStops).toHaveCount(2);
  await expect(page.getByText("Your round trip returns to the pickup location after the destination.", { exact: true })).toBeVisible();

  const breakdown = page.getByRole("region", { name: "Distance breakdown", exact: true });
  await expect(breakdown).toContainText("1,575 km");
  expect(points).toHaveLength(5);
  expect(points[0]).toEqual(points[4]);
  expect(points[1]).toEqual([9.4981, 76.3388]);
  expect(points[2]).toEqual([13.0827, 80.2707]);
  expect(points[3]).toEqual(points[1]);
  const legs = breakdown.getByRole("listitem");
  await expect(legs).toHaveCount(4);
  await expect(legs.nth(2)).toContainText("Chennai destination");
  await expect(legs.nth(2)).toContainText("Alappuzha pickup");
  await expect(legs.nth(3)).toContainText("Alappuzha pickup");
  await expect(legs.nth(3)).toContainText("Garage");
  const quote = page.getByRole("complementary", { name: "Live journey estimate", exact: true });
  await expect(quote).toContainText("Alappuzha pickup → Chennai destination → Alappuzha pickup");
  expect(new URL(page.url()).searchParams.get("stops")?.split("~")).toHaveLength(2);

  const map = page.getByRole("region", { name: "Route Map & Live Distance", exact: true });
  if (isMobile) await page.getByRole("link", { name: "Route map", exact: true }).click();
  await map.scrollIntoViewIfNeeded();
  await expect(map.locator(".xotic-pin")).toHaveCount(3);
  await expect(editableStops).toHaveCount(2);
  await page.getByRole("button", { name: "Add another stop", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Final drop", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Destination", exact: true })).toHaveCount(0);
  await expect(editableStops).toHaveCount(3);
  await expect(page.getByText("Your round trip returns to the pickup location after the destination.", { exact: true })).toHaveCount(0);
});
