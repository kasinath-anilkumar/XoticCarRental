import { expect, test } from "@playwright/test";

const phones = [{ width: 390, height: 844 }, { width: 320, height: 568 }];

test("mobile service pages lead with the enquiry and retain readable supporting details", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone content order and enquiry targets.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of phones) {
    await page.setViewportSize(viewport);
    for (const path of ["/services/wedding", "/services/wedding/kochi"]) {
      await page.goto(path);
      const enquiry = page.locator("#enquiry");
      const details = page.locator("#service-details");
      expect((await enquiry.boundingBox())!.y).toBeLessThan((await details.boundingBox())!.y);
      const toggle = details.getByRole("button", { name: "What’s included", exact: true });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(enquiry.locator('[name="customerPhone"]')).toBeVisible();
      await page.locator('a[href="#enquiry"]').first().click();
      await expect(enquiry).toBeFocused();
      await expect(page).toHaveURL(/#enquiry$/);
      expect(await enquiry.locator('[name="customerPhone"]').evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
      const date = enquiry.locator('input[type="date"]').first();
      const bounds = await date.boundingBox();
      expect(bounds!.width).toBeGreaterThan(100);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(details.locator("li").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    }
  }
});

test("mobile city pages show the fleet before tables and keep contextual route actions usable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone fleet order and fixed action.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of phones) {
    await page.setViewportSize(viewport);
    await page.goto("/cities/kochi");
    const fleet = page.locator("#city-fleet");
    const routes = page.locator("#city-routes");
    expect((await fleet.boundingBox())!.y).toBeLessThan((await routes.boundingBox())!.y);
    const next = fleet.getByRole("button", { name: "Next Cars in Kochi", exact: true });
    await expect(next).toBeVisible();
    await fleet.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await next.click();
    await expect.poll(() => fleet.locator("[data-scroll-viewport]").evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await page.getByRole("link", { name: "Route prices", exact: true }).click();
    await expect(routes).toBeFocused();
    await expect(page).toHaveURL(/#city-routes$/);
    await expect(routes.getByRole("table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});

test("mobile directory rows retain prices and package pagination returns to its results", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Compact phone listings.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of phones) {
    await page.setViewportSize(viewport);
    await page.goto("/cities");
    const row = page.getByRole("region", { name: "City directory", exact: true }).getByRole("article").first();
    expect((await row.boundingBox())!.height).toBeLessThan(300);
    await expect(row.getByText(/₹|Enquire for pricing/)).toBeVisible();
    await expect(row.getByRole("link", { name: "View cars", exact: true })).toBeVisible();
    await page.goto("/packages");
    await expect(page.locator("#packages > section")).toHaveCount(6);
    const next = page.getByRole("navigation", { name: "services pagination", exact: true }).getByRole("link", { name: "Next", exact: true });
    await next.click();
    await expect(page).toHaveURL(/page=2#packages$/);
    await expect(page.locator("#packages")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});

test("mobile gallery presents two photo columns and keeps preview actions touch sized", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone gallery density and dialog targets.");
  for (const viewport of phones) {
    await page.setViewportSize(viewport);
    await page.goto("/gallery");
    const photos = page.getByRole("button", { name: /^View .+, photo \d+$/ });
    await expect(photos).toHaveCount(12);
    const first = (await photos.nth(0).boundingBox())!;
    const second = (await photos.nth(1).boundingBox())!;
    expect(Math.abs(first.y - second.y)).toBeLessThan(2);
    expect(second.x).toBeGreaterThan(first.x + first.width);
    await photos.first().click();
    const preview = page.getByRole("dialog");
    await expect(preview).toBeVisible();
    const close = preview.getByRole("button", { name: "Close photo preview (Escape)", exact: true });
    const bounds = (await close.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(preview).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});

test("desktop service information remains expanded beside the enquiry", async ({ page, isMobile }) => {
  test.skip(isMobile, "Preserve the desktop information layout.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/services/wedding");
  const details = page.locator("#service-details");
  await expect(details.getByRole("button", { name: "What’s included", exact: true })).toBeHidden();
  await expect(details.locator("li").first()).toBeVisible();
  expect((await page.locator("#enquiry").boundingBox())!.x).toBeGreaterThan((await details.boundingBox())!.x);
});

test("mobile optional enquiry details reveal invalid values and retain collapsed answers on submission", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Optional mobile form disclosure and native validation.");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { window.open = () => null; });
  await page.route("**/api/places?*", (route) => route.fulfill({ json: {
    results: [{ token: "@10,76,Chosen service area", name: "Chosen service area", detail: "Search result", served: false, isAirport: false }],
  } }));
  const submissions: Array<{ answers: Record<string, string> }> = [];
  await page.route("**/api/enquiries/service", (route) => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ json: { recorded: true, leadId: "MOBILE-TEST", whatsappHref: "https://wa.me/919876543210?text=test" } });
  });
  await page.goto("/services/wedding");
  const enquiry = page.locator("#enquiry");
  const toggle = enquiry.getByRole("button", { name: /^Additional details/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await enquiry.locator('[name="customerPhone"]').fill("9876543210");
  await enquiry.locator('[name="date"]').fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));
  await enquiry.locator('input[role="combobox"][id$="-city"]').fill("Chosen service area");
  await page.getByRole("option", { name: /Chosen service area/ }).click();
  await toggle.click();
  const optionalNumber = enquiry.locator('input[type="number"][min]').first();
  const numberName = (await optionalNumber.getAttribute("name"))!;
  const minimum = Number(await optionalNumber.getAttribute("min"));
  const notes = enquiry.locator("textarea").first();
  const noteName = (await notes.getAttribute("name"))!;
  await notes.fill("Please retain these optional arrangements.");
  await optionalNumber.fill(String(minimum - 1));
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await enquiry.locator('button[type="submit"]').click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(optionalNumber).toBeFocused();
  await expect(enquiry.getByRole("alert")).toBeVisible();
  expect(submissions).toHaveLength(0);
  await optionalNumber.fill(String(minimum));
  await toggle.click();
  await expect(notes).toBeHidden();
  await enquiry.locator('button[type="submit"]').click();
  await expect(enquiry.getByText("Enquiry received — reference MOBILE-TEST", { exact: true })).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0].answers[numberName]).toBe(String(minimum));
  expect(submissions[0].answers[noteName]).toBe("Please retain these optional arrangements.");
});
