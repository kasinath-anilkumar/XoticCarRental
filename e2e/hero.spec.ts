import { expect, test, type Locator } from "@playwright/test";

const heroSelector = 'section[aria-label="Chauffeur-driven luxury journeys"]';

async function scrubHero(hero: Locator, progress: number) {
  const { distance, frame } = await hero.evaluate((element, target) => {
    const root = element as HTMLElement;
    const stage = root.firstElementChild as HTMLElement;
    const travel = root.offsetHeight - stage.offsetHeight;
    const start = root.getBoundingClientRect().top + window.scrollY;
    const leadIn = Math.max(0, stage.offsetHeight - innerHeight);
    window.scrollTo({ top: target === 0 ? start : start + leadIn + travel * target, behavior: "instant" });
    // Native scrolling rounds subpixels. On a short phone animation track,
    // that can put the real scroll position one frame beyond the ideal target.
    const actualProgress = Math.min(1, Math.max(0, (window.scrollY - start - leadIn) / travel));
    return { distance: travel, frame: Math.round(actualProgress * 179) };
  }, progress);
  expect(distance).toBeGreaterThan(0);
  await expect(hero).toHaveAttribute("data-motion", "true");
  await expect(hero).toHaveAttribute("data-frame", String(frame));
  await expect(hero.locator("canvas")).toHaveCSS("opacity", "1");
}

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

  const geometry = await hero.evaluate((element) => ({
    distance: (element as HTMLElement).offsetHeight - (element.firstElementChild as HTMLElement).offsetHeight,
    leadIn: Math.max(0, (element.firstElementChild as HTMLElement).offsetHeight - innerHeight),
  }));
  for (const [progress, frame] of [[0.5, 90], [1, 179], [0, 0]]) {
    await page.evaluate((position) => window.scrollTo({ top: position, behavior: "instant" }), progress === 0 ? 0 : geometry.leadIn + geometry.distance * progress);
    await expect(hero).toHaveAttribute("data-frame", String(frame));
    const position = await hero.locator(":scope > div").evaluate((stage) => ({
      actual: stage.getBoundingClientRect().top,
      expected: Math.max(-window.scrollY, Number.parseFloat(getComputedStyle(stage).top)),
    }));
    // A stage taller than the viewport scrolls into view before it pins.
    expect(Math.abs(position.actual - position.expected)).toBeLessThan(2);
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
    const leadIn = Math.max(0, (root.firstElementChild as HTMLElement).offsetHeight - innerHeight);
    const frames: number[] = [];
    await new Promise<void>((resolve) => {
      let start: number | undefined;
      const tick = (time: number) => {
        start ??= time;
        const progress = Math.min(1, (time - start) / 3000);
        window.scrollTo({ top: leadIn + distance * progress, behavior: "instant" });
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

for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 667, height: 375 }]) {
  test(`small-screen hero animates both ways and keeps actions reachable at ${viewport.width}x${viewport.height}`, async ({ page, browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const hero = page.locator(heroSelector);
    await expect(hero).toHaveAttribute("data-motion", "true");
    await expect(hero).toHaveAttribute("data-frame", "0");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    const heading = await hero.getByRole("heading", { level: 1 }).boundingBox();
    expect(heading!.x).toBeGreaterThanOrEqual(0);
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(viewport.width + 1);
    for (const label of ["Explore the fleet", "Plan your journey"]) {
      const action = hero.getByRole("link", { name: label });
      await expect(action).toBeInViewport();
      const bounds = await action.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    for (const progress of [0.5, 1, 0]) {
      await scrubHero(hero, progress);
      if (progress > 0) await expect(hero.locator("canvas")).toBeInViewport({ ratio: 0.75 });
    }

    if (viewport.width === 375 && browserName === "chromium") {
      const touch = await page.context().newCDPSession(page);
      try {
        await hero.evaluate((element) => window.scrollTo({ top: Math.max(0, (element.firstElementChild as HTMLElement).offsetHeight - innerHeight), behavior: "instant" }));
        const initialScroll = await page.evaluate(() => window.scrollY);
        // Timed touch moves exercise native scrolling; Chrome's synthetic
        // gesture command can emit no moves even on a plain scrollable page.
        const swipe = async (startY: number, distance: number) => {
          const x = viewport.width - 55;
          await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY, id: 1 }] });
          for (let step = 1; step <= 12; step += 1) {
            await page.waitForTimeout(20);
            await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: startY + distance * step / 12, id: 1 }] });
          }
          // Pause before lifting to avoid a momentum fling obscuring reversal.
          await page.waitForTimeout(100);
          await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        };
        await swipe(500, -240);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScroll + 100);
        await expect.poll(async () => Number(await hero.getAttribute("data-frame"))).toBeGreaterThan(0);
        const forwardFrame = Number(await hero.getAttribute("data-frame"));
        const forwardScroll = await page.evaluate(() => window.scrollY);
        await swipe(260, 240);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(forwardScroll - 100);
        await expect.poll(async () => Number(await hero.getAttribute("data-frame"))).toBeLessThan(forwardFrame);
        await expect(hero).toHaveAttribute("data-motion", "true");
        await scrubHero(hero, 0);
      } finally {
        await touch.detach();
      }
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    await page.screenshot({ path: testInfo.outputPath("hero-small-phone.png") });
    await hero.getByRole("link", { name: "Plan your journey" }).click();
    await expect(page.locator("#journey-search")).toBeInViewport();
    await expect(page.locator("#journey-search")).toBeFocused();
  });
}

test("resizing an active phone hero preserves animation across portrait and landscape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const hero = page.locator(heroSelector);
  await expect(hero).toHaveAttribute("data-motion", "true");
  for (const viewport of [{ width: 375, height: 667 }, { width: 667, height: 375 }, { width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await scrubHero(hero, 0.5);
    await page.setViewportSize(viewport);
    await expect(hero).toHaveAttribute("data-motion", "true");
    await expect(hero.locator("canvas")).toHaveCSS("opacity", "1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    await scrubHero(hero, 0.75);
    await scrubHero(hero, 0.25);
  }
  await scrubHero(hero, 0);
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

test("short desktop windows animate and keep the booking action reachable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 1024, height: 550 });
  await page.goto("/");
  const hero = page.locator(heroSelector);
  await expect(hero).toHaveAttribute("data-motion", "true");
  await expect(hero.getByRole("link", { name: "Plan your journey" })).toBeInViewport();
  for (const progress of [0.5, 1, 0]) await scrubHero(hero, progress);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1025);
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
