import { expect, test } from "@playwright/test";

const pickup = { token: "@10.0889,76.35,Selected live landmark", name: "Selected live landmark", detail: "Live search result", served: false, isAirport: false };

test("a searched pickup survives home, fleet and vehicle navigation without invented stops", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { results: [pickup] } }));
  await page.goto("/");
  await page.getByRole("combobox", { name: "Pickup location" }).fill("Selected live landmark");
  await page.getByRole("option", { name: /Selected live landmark/ }).click();
  await page.getByRole("button", { name: "See cars & prices" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBe(pickup.token);

  const carLink = page.getByRole("article").first().getByRole("link", { name: "Price & details" });
  await expect.poll(async () => new URL((await carLink.getAttribute("href"))!, page.url()).searchParams.get("from")).toBe(pickup.token);
  await carLink.click();
  const calculatorLink = page.getByRole("link", { name: isMobile ? "Price my route" : "Get exact price for my route", exact: true });
  await expect.poll(async () => new URL((await calculatorLink.getAttribute("href"))!, page.url()).searchParams.get("from")).toBe(pickup.token);
  await calculatorLink.click();
  await expect(page.getByRole("combobox", { name: "Pickup location" })).toHaveValue(pickup.name);
  await expect(page.getByRole("combobox", { name: "Final drop" })).toHaveValue("");
  await expect(page.getByLabel("Pickup date", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Pickup time", { exact: true })).toHaveValue("");
});

test("editing a selected service location clears its old coordinates and optional answers stay blank", async ({ page }) => {
  await page.addInitScript(() => { window.open = () => null; });
  const submissions: Array<{ answers: Record<string, string> }> = [];
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { results: [pickup] } }));
  await page.route("**/api/enquiries/service", async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ json: { recorded: false, whatsappHref: "https://wa.me/919876543210?text=test" } });
  });
  await page.goto("/services/wedding");
  await page.getByLabel("Phone", { exact: false }).fill("9876543210");
  await page.locator('[name="date"]').fill(new Date(Date.now() + 172_800_000).toISOString().slice(0, 10));
  const area = page.locator('input[role="combobox"][id$="-city"]');
  await area.fill(pickup.name);
  await page.getByRole("option", { name: /Selected live landmark/ }).click();
  await expect(page.locator('input[type="hidden"][name="city"]')).toHaveValue(pickup.token);
  await area.fill("Different place still being searched");
  await expect(page.locator('input[type="hidden"][name="city"]')).toHaveValue("");
  // Dismiss suggestions before using the submit action directly underneath.
  await area.press("Escape");
  await page.locator('form button[type="submit"]').click();
  expect(submissions).toHaveLength(0);

  await area.fill(pickup.name);
  await page.getByRole("option", { name: /Selected live landmark/ }).click();
  await page.locator('form button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].answers.city).toBe(pickup.token);
  expect(submissions[0].answers).not.toHaveProperty("budget");
  expect(submissions[0].answers).not.toHaveProperty("segment");
});
