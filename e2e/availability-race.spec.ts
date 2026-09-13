import { expect, test } from "@playwright/test";

test("availability controls wait for hydration before accepting a date", async ({ page }) => {
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  let heldScripts = 0;
  const requests: string[] = [];

  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async (route) => {
    heldScripts += 1;
    await scriptsReady;
    await route.continue();
  });
  await page.route("**/api/availability?*", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ json: { available: true, nextFree: null, alternatives: [] } });
  });

  try {
    await page.goto("/cars/eclass", { waitUntil: "commit" });
    const from = page.getByLabel("From", { exact: true });
    const days = page.getByLabel("Days", { exact: true });
    const form = page.locator("form").filter({ has: from });
    // Streamed server HTML can be attached before Next reveals the route.
    const check = form.locator('button[type="submit"]');
    await expect(from).toBeAttached();
    await expect.poll(() => heldScripts).toBeGreaterThan(0);
    await expect(from).toBeDisabled();
    await expect(days).toBeDisabled();
    await expect(check).toBeDisabled();
    expect(requests).toHaveLength(0);

    releaseScripts();
    await expect(from).toBeEnabled();
    await expect(days).toBeEnabled();
    await expect(check).toBeEnabled();
    await from.fill(date);
    await days.fill("2");
    await check.click();
    await expect(page.getByText(`Free from ${date} for 2 days.`, { exact: false })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(Object.fromEntries(new URL(requests[0]).searchParams)).toEqual({
      car: "eclass", date, days: "2",
    });
  } finally {
    releaseScripts();
  }
});

test("editing the availability dates discards a late response for the previous request", async ({ page }) => {
  const firstDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const secondDate = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
  let releaseFirst!: () => void;
  let firstHandled!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const firstFinished = new Promise<void>((resolve) => { firstHandled = resolve; });
  let requests = 0;
  await page.route("**/api/availability?*", async (route) => {
    requests += 1;
    if (new URL(route.request().url()).searchParams.get("date") === firstDate) {
      await firstGate;
      try { await route.fulfill({ json: { available: true, nextFree: null, alternatives: [] } }); }
      catch { /* The old fetch is intentionally cancelled when the date changes. */ }
      finally { firstHandled(); }
    } else {
      await route.fulfill({ json: { available: false, nextFree: null, alternatives: [] } });
    }
  });
  await page.goto("/cars/eclass");
  const from = page.getByLabel("From", { exact: true });
  const form = page.locator("form").filter({ has: from });
  await from.fill(firstDate);
  await form.getByRole("button", { name: "Check", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await from.fill(secondDate);
  await form.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Not available then.", { exact: false })).toBeVisible();
  releaseFirst();
  await firstFinished;
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByText("Not available then.", { exact: false })).toBeVisible();
  await expect(page.getByText(`Free from ${secondDate}`, { exact: false })).toHaveCount(0);
});
