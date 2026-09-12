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
  // Staying at the top must not start a background download of all 180 files.
  await page.waitForTimeout(500);
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
  await hero.getByRole("link", { name: "Plan your journey" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#journey-search")).toBeInViewport();
  await expect(page.locator("#journey-search")).toBeFocused();
  expect(errors).toEqual([]);
});

test("continuous scrolling keeps advancing when frame downloads are delayed", async ({ page }) => {
  await page.route("**/exoticbanner/*.jpg", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 75));
    await route.continue();
  });
  await page.goto("/");
  const hero = page.locator(heroSelector);
  await expect(hero).toHaveAttribute("data-frame", "0");

  const painted = await hero.evaluate(async (element) => {
    const root = element as HTMLElement;
    const distance = root.offsetHeight - (root.firstElementChild as HTMLElement).offsetHeight;
    const frames: number[] = [];
    await new Promise<void>((resolve) => {
      let start: number | undefined;
      const tick = (time: number) => {
        start ??= time;
        const progress = Math.min(1, (time - start) / 3000);
        window.scrollTo({ top: distance * progress, behavior: "instant" });
        const frame = Number(root.dataset.frame);
        if (frames.at(-1) !== frame) frames.push(frame);
        if (progress < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return frames;
  });
  expect(painted.length).toBeGreaterThan(10);
  expect(painted.every((frame, index) => index === 0 || frame >= painted[index - 1])).toBe(true);
  await expect(hero).toHaveAttribute("data-frame", "179");
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

test("short desktop windows can scroll straight to the booking action", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 1024, height: 550 });
  await page.goto("/");
  const hero = page.locator(heroSelector);
  await expect(hero).not.toHaveAttribute("data-motion", "true");
  expect(await hero.evaluate((element) => element.clientHeight === element.firstElementChild?.clientHeight)).toBe(true);
  await hero.getByRole("link", { name: "Plan your journey" }).click();
  await expect(page.locator("#journey-search")).toBeInViewport();
});

test("late hero loading preserves the booking position and activates on returning to the top", async ({ page }) => {
  let release!: () => void;
  const downloads = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/exoticbanner/*.jpg", async (route) => {
    await downloads;
    await route.continue();
  });
  await page.goto("/");
  const hero = page.locator(heroSelector);
  const booking = page.locator("#journey-search");
  await hero.getByRole("link", { name: "Plan your journey" }).click();
  await expect(booking).toBeInViewport();
  // Let native anchor scrolling settle before releasing the first frame.
  await page.waitForTimeout(500);
  const before = await booking.boundingBox();
  release();
  await expect(hero).toHaveAttribute("data-frame", "0");
  await expect(hero).not.toHaveAttribute("data-motion", "true");
  expect(Math.abs((await booking.boundingBox())!.y - before!.y)).toBeLessThan(2);
  await expect(booking).toBeFocused();

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(hero).toHaveAttribute("data-motion", "true");
  await expect(hero.locator("canvas")).toHaveCSS("opacity", "1");
});
