import { expect, test, type Locator, type Page } from "@playwright/test";

async function pressDocumentScrollKey(page: Page, key: "Control+End" | "Control+Home") {
  // Native keyboard scrolling can still be finishing after it reaches the boundary.
  // Wait for completion before sending an opposing key or wheel gesture.
  await page.evaluate(() => {
    document.documentElement.dataset.testScrollState = "scrolling";
    document.addEventListener("scrollend", () => {
      document.documentElement.dataset.testScrollState = "idle";
    }, { once: true });
  });
  await page.keyboard.press(key);
  await expect(page.locator("html")).toHaveAttribute("data-test-scroll-state", "idle");
}

async function expectHiddenScrollbar(container: Locator) {
  await expect(container).toHaveCSS("scrollbar-width", "none");
  expect(await container.evaluate((element) => getComputedStyle(element, "::-webkit-scrollbar").display)).toBe("none");
}

async function expectDocumentFlow(container: Locator) {
  await expect(container).toHaveCSS("max-height", "none");
  const nestedScrollers = await container.evaluate((root) => [root, ...root.querySelectorAll("*")]
    .filter((element) => element instanceof HTMLElement && element.getClientRects().length > 0)
    .filter((element) => {
      const style = getComputedStyle(element);
      return /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2;
    })
    .map((element) => element.tagName));
  expect(nestedScrollers).toEqual([]);
}

test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1280, height: 650 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("hidden document tracks preserve keyboard and wheel scrolling", async ({ page }) => {
  await page.goto("/cars");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectHiddenScrollbar(page.locator("html"));
  await expectHiddenScrollbar(page.locator("body"));
  await pressDocumentScrollKey(page, "Control+End");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await expect(page.getByRole("contentinfo").getByRole("link").last()).toBeInViewport();
  await pressDocumentScrollKey(page, "Control+Home");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
  await page.mouse.move(30, 300);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test("expanded desktop filters use the page and keep their apply action keyboard reachable", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop filters use document flow; the mobile sheet is tested separately.");
  await page.goto("/cars");
  const filters = page.getByRole("form", { name: "Fleet filters", exact: true });
  for (const label of ["Vehicle type", "Passengers", "Budget", "Travel dates", "Sort"]) {
    await filters.locator("summary").filter({ hasText: new RegExp(`^${label}`) }).click();
  }
  await expectDocumentFlow(page.getByRole("complementary", { name: "Filters", exact: true }));
  const sort = filters.getByLabel("Sort order", { exact: true });
  await sort.focus();
  await sort.press("Tab");
  await expect(filters.getByRole("button", { name: "Clear all", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const apply = filters.getByRole("button", { name: "Apply filters", exact: true });
  await expect(apply).toBeFocused();
  await expect(apply).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  expect(new URL(page.url()).search).toBe("");
});

test("the mobile filter sheet exposes its scrollable region and keeps both ends reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "This is the bounded mobile filter sheet.");
  await page.goto("/cars");
  const trigger = page.getByRole("button", { name: "Filters", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Filters", exact: true });
  const options = dialog.getByRole("region", { name: "Filter options", exact: true });
  await expectHiddenScrollbar(options);
  await expect(options).toHaveAttribute("tabindex", "0");
  await expect(options).not.toHaveCSS("background-image", "none");
  await expect(dialog.getByText("Scroll to explore all filters", { exact: true })).toBeVisible();
  const pageTop = await page.evaluate(() => window.scrollY);
  await options.focus();
  await options.press("PageDown");
  await expect.poll(() => options.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
  await options.press("End");
  await expect.poll(() => options.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThanOrEqual(2);
  await expect(options.locator("summary").filter({ hasText: /^Sort/ })).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole("button", { name: "Show matching cars", exact: true })).toBeInViewport({ ratio: 1 });
  await options.press("Home");
  await expect.poll(() => options.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageTop);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("location suggestions retain keyboard selection beyond the hidden scrollbar", async ({ page }) => {
  const results = Array.from({ length: 8 }, (_, index) => ({
    token: `@10.${index + 1},76.35,Scroll destination ${index + 1}`,
    name: `Scroll destination ${index + 1}`,
    detail: `Result ${index + 1}, Kerala, India`,
    served: false,
    isAirport: false,
  }));
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { results } }));
  await page.goto("/services/wedding");
  const input = page.locator('input[role="combobox"][id$="-city"]');
  await input.fill("Scroll destination");
  const menuId = await input.getAttribute("aria-controls");
  expect(menuId).toBeTruthy();
  const menu = page.locator(`[id="${menuId}"]`);
  const last = page.getByRole("option", { name: /Scroll destination 8/ });
  await expect(last).toBeVisible();
  await expectHiddenScrollbar(menu);
  await expect(menu).not.toHaveCSS("background-image", "none");
  expect(await menu.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(20);
  await input.press("End");
  await expect(input).toHaveAttribute("aria-activedescendant", (await last.getAttribute("id"))!);
  await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(20);
  await expect.poll(() => last.evaluate((element) => {
    const item = element.getBoundingClientRect();
    const menu = element.closest('[role="listbox"]')!.getBoundingClientRect();
    return item.top >= menu.top - 1 && item.bottom <= menu.bottom + 1;
  })).toBe(true);
  // Native scroll offsets round to CSS pixels; a subpixel edge can remain
  // outside while the atomic one-pixel clipping and hit checks still pass.
  await expect(last).toBeInViewport({ ratio: 0.99 });
  expect(await last.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return Boolean(hit && element.contains(hit));
  })).toBe(true);
  await input.press("Enter");
  await expect(input).toHaveValue("Scroll destination 8");
  await expect(page.locator('input[type="hidden"][name="city"]')).toHaveValue(results[7].token);
});

test("the mobile navigation retains keyboard access to its last links", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The desktop navigation does not use a drawer.");
  // The compact menu fits a 560px window; use a short phone window to exercise overflow.
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/cars");
  const trigger = page.getByRole("button", { name: "Open menu", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Navigation menu", exact: true });
  const nav = dialog.getByRole("navigation", { name: "Mobile", exact: true });
  await expectHiddenScrollbar(nav);
  await expect(nav).not.toHaveCSS("background-image", "none");
  expect(await nav.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(20);
  await nav.focus();
  await nav.press("End");
  await expect.poll(() => nav.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThanOrEqual(2);
  await expect(nav.getByRole("link", { name: "Contact the team", exact: true })).toBeInViewport({ ratio: 1 });
  await nav.press("Home");
  await expect.poll(() => nav.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the complete summary receipt and customer form follow document scrolling", async ({ page, isMobile }) => {
  const date = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const query = new URLSearchParams({
    car: "eclass", pkg: "p8", trip: "local", date, time: "10:00", occ: "casual",
    stops: "@10.0889,76.35,Scroll review pickup~@9.97,76.29,Scroll review drop",
  });
  await page.goto(`/booking-summary?${query}`);
  const receipt = page.getByRole("complementary").filter({ has: page.getByRole("heading", { name: "Price breakdown", exact: true }) });
  await expect(receipt).toBeVisible();
  await expectDocumentFlow(receipt);
  await expectHiddenScrollbar(receipt);
  if (isMobile) {
    const vehicle = page.getByRole("region", { name: "Selected vehicle and package", exact: true });
    expect((await receipt.boundingBox())!.y).toBeLessThan((await vehicle.boundingBox())!.y);
  }
  const phone = receipt.getByRole("textbox", { name: "Phone", exact: true });
  await phone.focus();
  await phone.press("Tab");
  const send = receipt.getByRole("button", { name: "Send this quote on WhatsApp", exact: true });
  await expect(send).toBeFocused();
  await expect(send).toBeInViewport({ ratio: 1 });
  const call = receipt.getByRole("link", { name: /^Or call / });
  const beforeScroll = await page.evaluate(() => window.scrollY);
  const callBelowViewport = (await call.boundingBox())!.y + (await call.boundingBox())!.height > (page.viewportSize()?.height ?? 0);
  await send.press("Tab");
  await expect(call).toBeFocused();
  await expect(call).toBeInViewport({ ratio: 1 });
  if (callBelowViewport) await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll);
  expect(await receipt.evaluate((element) => element.scrollTop)).toBe(0);
});
