import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectCalendarFits(page: Page, calendar: Locator) {
  await expect(calendar.getByRole("grid")).toBeVisible();
  await expect.poll(() => calendar.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= window.innerWidth
      && box.top >= 0 && box.bottom <= window.innerHeight
      && element.scrollWidth <= element.clientWidth + 1
      && element.scrollHeight <= element.clientHeight + 1;
  })).toBe(true);
  const quickActions = page.getByRole("navigation", { name: "Quick actions", exact: true });
  await expect(quickActions).toBeVisible();
  await expect.poll(async () => {
    const popup = await calendar.boundingBox();
    const actions = await quickActions.boundingBox();
    return Boolean(popup && actions && popup.y + popup.height <= actions.y);
  }).toBe(true);
  // No row or navigation control may sit beneath another fixed element.
  expect(await calendar.locator("button:enabled").evaluateAll((buttons) => buttons.every((button) => {
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return Boolean(hit && button.contains(hit));
  }))).toBe(true);
}

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  test(`calendar fits ${viewport.width}px with reachable dates and restored focus`, async ({ page, isMobile }, testInfo) => {
    test.skip(!isMobile, "Mobile widths exercise the persistent bottom actions.");
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const pickup = page.getByRole("button", { name: "Pickup date", exact: true });
    await pickup.evaluate((element) => window.scrollTo({
      top: window.scrollY + element.getBoundingClientRect().top - window.innerHeight * 0.65,
      behavior: "instant",
    }));
    await pickup.click();
    const calendar = page.getByRole("dialog", { name: "Pickup date", exact: true });
    await expectCalendarFits(page, calendar);
    await expect.poll(() => calendar.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("calendar.png") });

    // Month navigation can change the calendar's height, and page scrolling
    // changes the anchor position. Both must keep every control in view.
    await calendar.getByRole("button", { name: /next month/i }).click();
    await page.evaluate(() => window.scrollBy({ top: 48, behavior: "instant" }));
    await expectCalendarFits(page, calendar);
    await page.keyboard.press("Escape");
    await expect(calendar).toHaveCount(0);
    await expect(pickup).toBeFocused();

    await pickup.click();
    await calendar.getByRole("button", { name: "Tomorrow", exact: true }).click();
    const expected = await page.evaluate(() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][tomorrow.getMonth()];
      return `${tomorrow.getDate()} ${month} ${tomorrow.getFullYear()}`;
    });
    await expect(pickup).toContainText(expected);
    await expect(pickup).toBeFocused();
    await expect(calendar).toHaveCount(0);

    // The second column must receive the same horizontal collision handling.
    const returnDate = page.getByRole("button", { name: "Return date (opt)", exact: true });
    await returnDate.click();
    const returnCalendar = page.getByRole("dialog", { name: "Return date (opt)", exact: true });
    await expectCalendarFits(page, returnCalendar);
    await page.keyboard.press("Escape");
    await expect(returnDate).toBeFocused();
  });
}
