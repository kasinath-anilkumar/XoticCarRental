import { expect, test } from "@playwright/test";

test("featured cars stay in one row with usable mobile carousel controls", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(isMobile ? { width: 320, height: 568 } : { width: 1280, height: 900 });
  await page.goto("/");
  const fleet = page.getByRole("region", { name: "Featured cars", exact: true });
  const cards = fleet.getByRole("article");
  await expect(cards).toHaveCount(3);
  const first = (await cards.nth(0).boundingBox())!;
  const second = (await cards.nth(1).boundingBox())!;
  expect(Math.abs(first.y - second.y)).toBeLessThan(2);
  const next = page.getByRole("button", { name: "Next Featured cars", exact: true });
  if (isMobile) {
    await expect(next).toBeEnabled();
    await fleet.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await next.click();
    await expect.poll(() => fleet.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(cards.nth(1)).toBeInViewport();
    await page.getByRole("button", { name: "Previous Featured cars", exact: true }).click();
    await expect.poll(() => fleet.evaluate((element) => element.scrollLeft)).toBeLessThan(2);
  } else {
    await expect(next).toBeHidden();
    expect(await fleet.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("mobile home action reaches search and search lands on matching inventory", async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pickup = { token: "@10.11,76.38,Mobile pickup", name: "Mobile pickup", detail: "Selected landmark", served: false, isAirport: false };
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { results: [pickup] } }));
  await page.goto("/");
  const action = page.getByRole("navigation", { name: "Quick actions", exact: true });
  await expect(action).toBeInViewport({ ratio: 1 });
  await action.getByRole("link", { name: "Find a car", exact: true }).click();
  const search = page.locator("#main #journey-search");
  await expect(search).toBeFocused();
  await expect(search.getByRole("combobox", { name: "Pickup location", exact: true })).toBeInViewport();
  await search.getByRole("combobox", { name: "Pickup location", exact: true }).fill(pickup.name);
  await page.getByRole("option", { name: /Mobile pickup/ }).click();
  const date = await page.evaluate(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  });
  await search.getByRole("button", { name: "Pickup date", exact: true }).click();
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await search.getByRole("button", { name: "See cars & prices", exact: true }).click();
  await expect(page.locator("#fleet-results")).toBeFocused();
  const url = new URL(page.url());
  expect(url.pathname).toBe("/cars");
  expect(url.hash).toBe("#fleet-results");
  expect(url.searchParams.get("from")).toBe(pickup.token);
  expect(url.searchParams.get("date")).toBe(date);
  await expect(page.getByRole("article").first()).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test("mobile deep links reveal content and footer groups stay accessible across resizing", async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#home-fleet");
  const fleet = page.locator("#home-fleet");
  await expect(fleet).toHaveAttribute("data-open", "true");
  await expect(fleet).toBeFocused();
  await expect(fleet.getByRole("article").first()).toBeVisible();
  const footer = page.getByRole("contentinfo");
  const company = footer.getByRole("button", { name: "Company", exact: true });
  await expect(company).toHaveAttribute("aria-expanded", "false");
  const contact = footer.getByRole("link", { name: "Contact", exact: true });
  await expect(contact).toBeHidden();
  await company.focus();
  await page.keyboard.press("Enter");
  await expect(company).toHaveAttribute("aria-expanded", "true");
  await expect(contact).toBeVisible();
  await company.press("Enter");
  await expect(contact).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(company).toBeHidden();
  await expect(contact).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
});
