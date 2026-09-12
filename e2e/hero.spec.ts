import { expect, test } from "@playwright/test";

const heroSelector = 'section[aria-label="Chauffeur-driven luxury journeys"]';

test("hero scrubs all frames in both directions without eagerly downloading the sequence", async ({ page }, testInfo) => {
  const requests = new Set<string>();
  const errors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/exoticbanner/")) requests.add(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const hero = page.locator(heroSelector);
  await expect(hero).toHaveAttribute("data-frame-count", "180");
  await expect(hero).toHaveAttribute("data-frame", "0");
  expect(requests.size).toBeLessThanOrEqual(4);
  await page.screenshot({ path: testInfo.outputPath("hero-start.png") });

  const distance = await hero.evaluate((element) => (element as HTMLElement).offsetHeight - (element.firstElementChild as HTMLElement).offsetHeight);
  for (const [progress, frame] of [[0.5, 90], [1, 179], [0, 0]]) {
    await page.evaluate((position) => window.scrollTo({ top: position, behavior: "instant" }), distance * progress);
    await expect(hero).toHaveAttribute("data-frame", String(frame));
    const stage = await hero.locator(":scope > div").boundingBox();
    expect(Math.abs(stage?.y ?? 100)).toBeLessThan(2);
    if (progress === 0.5) await page.screenshot({ path: testInfo.outputPath("hero-middle.png") });
  }
  expect(requests.size).toBeLessThan(30);
  await hero.getByRole("link", { name: "Plan your journey" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#journey-search")).toBeInViewport();
  await expect(page.locator("#journey-search")).toBeFocused();
  expect(errors).toEqual([]);
});

test("reduced motion keeps a static hero and does not download sequence frames", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/exoticbanner/")) requests.push(request.url());
  });
  await page.goto("/");
  const hero = page.locator(heroSelector);
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(hero).not.toHaveAttribute("data-motion", "true");
  expect(await hero.evaluate((element) => element.clientHeight === element.firstElementChild?.clientHeight)).toBe(true);
  await hero.getByRole("link", { name: "Plan your journey" }).click();
  await expect(page.locator("#journey-search")).toBeInViewport();
  expect(requests).toEqual([]);
});

test("failed animation frames preserve the loaded poster and booking link", async ({ page }) => {
  await page.route("**/exoticbanner/*.jpg", (route) => route.abort());
  await page.goto("/");
  const hero = page.locator(heroSelector);
  const poster = hero.getByRole("img");
  await expect.poll(() => poster.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(hero.locator("canvas")).toHaveCSS("opacity", "0");
  await expect(hero).not.toHaveAttribute("data-motion", "true");
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await hero.getByRole("link", { name: "Plan your journey" }).click();
  await expect(page.locator("#journey-search")).toBeInViewport();
});

test("short phone hero keeps its heading and actions inside the screen width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  const hero = page.locator(heroSelector);
  await expect(hero).not.toHaveAttribute("data-motion", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const heading = await hero.getByRole("heading", { level: 1 }).boundingBox();
  expect(heading!.x + heading!.width).toBeLessThanOrEqual(320);
  await expect(hero.getByRole("link", { name: "Explore the fleet" })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("hero-small-phone.png") });
  await hero.getByRole("link", { name: "Plan your journey" }).click();
  await expect(page.locator("#journey-search")).toBeInViewport();
});

test("data saving leaves the animation disabled", async ({ page }) => {
  await page.addInitScript(() => {
    const connection = new EventTarget();
    Object.defineProperty(connection, "saveData", { value: true });
    Object.defineProperty(navigator, "connection", { value: connection });
  });
  await page.goto("/");
  const hero = page.locator(heroSelector);
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(hero).not.toHaveAttribute("data-motion", "true");
  await hero.getByRole("link", { name: "Plan your journey" }).click();
  await expect(page.locator("#journey-search")).toBeInViewport();
  await expect(hero).not.toHaveAttribute("data-frame", /\d/);
});
