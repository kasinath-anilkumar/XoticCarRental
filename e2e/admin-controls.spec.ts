import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

let bundle: string;
test.beforeAll(async ({ browserName }, testInfo) => {
  const require = createRequire(path.resolve("package.json"));
  const { webpack } = require("next/dist/compiled/webpack/webpack");
  const directory = path.resolve(".data", `admin-control-tests-${browserName}-${testInfo.workerIndex}`);
  await mkdir(directory, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    webpack({ mode: "development", target: "web", devtool: false,
      entry: path.resolve("e2e/fixtures/admin-controls.tsx"),
      output: { path: directory, filename: "fixture.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": process.cwd() } },
      plugins: [new webpack.NormalModuleReplacementPlugin(/^\.\/actions$/, (resource: { context: string; request: string }) => {
        if (resource.context.replace(/\\/g, "/").endsWith("/app/admin/services")) resource.request = path.resolve("e2e/fixtures/admin-service-action.ts");
      })],
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.resolve("e2e/support/typescript-loader.cjs") }] },
    }, (error: Error | null, stats: { hasErrors(): boolean; toString(): string }) => {
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString())); else resolve();
    });
  });
  bundle = await readFile(path.join(directory, "fixture.js"), "utf8");
});

test.beforeEach(async ({ page }) => {
  await page.route("http://admin-controls.test/", (route) => route.fulfill({ contentType: "text/html", body: '<html lang="en"><head><title>Admin controls test</title><style>.hidden{display:none}.input{display:block}main{max-width:600px}ul{max-height:200px;overflow:auto}button{min-height:36px}output{display:block}</style></head><body><div id="root"></div></body></html>' }));
  await page.route("**/api/admin/options?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const currentPage = Number(params.get("page"));
    const query = params.get("q");
    const options = query ? [{ value: "found-id", label: `Saved ${query}` }] : Array.from({ length: 20 }, (_, index) => ({ value: `id-${(currentPage - 1) * 20 + index}`, label: `Saved record ${(currentPage - 1) * 20 + index}` }));
    return route.fulfill({ json: { options, page: currentPage, hasMore: !query && currentPage < 3 } });
  });
  await page.goto("http://admin-controls.test/");
  await page.addScriptTag({ content: bundle });
});

test("reference searches are lazy, paged and require a real selection", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/admin/options")) requests.push(request.url()); });
  await expect(page.getByRole("combobox", { name: "Service city", exact: true })).toBeVisible();
  await page.waitForTimeout(350);
  expect(requests).toHaveLength(0);
  const city = page.getByRole("combobox", { name: "Service city", exact: true });
  await city.click();
  await expect(page.locator("#references").getByRole("option")).toHaveCount(20);
  await page.getByRole("button", { name: "Next choices" }).click();
  await expect(page.locator("#references").getByRole("option").first()).toHaveText("Saved record 20");
  await city.fill("configured");
  await expect(page.locator("#references").getByRole("option")).toHaveCount(1);
  await page.getByRole("button", { name: "Save references" }).click();
  await expect(page.locator("#saved")).toBeEmpty();
  expect(await city.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
  await city.click();
  await city.fill("configured");
  await expect(page.locator("#references").getByRole("option")).toHaveCount(1);
  await city.press("ArrowDown");
  await city.press("Enter");
  await page.getByRole("button", { name: "Save references" }).click();
  await expect(page.locator("#saved")).toContainText('["city_id","found-id"]');
  await expect(page.locator("#saved")).toContainText('["occasion_ids","saved-occasion"]');
  await page.getByRole("button", { name: "Clear Service city" }).click();
  await city.fill("configured");
  await page.getByRole("option", { name: "Saved configured" }).click();
  await expect(page.locator('input[name="city_id"]')).toHaveValue("found-id");
});

test("multi-reference selection retains assigned IDs across searches and pages", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "Occasions", exact: true });
  await input.click();
  await page.getByRole("button", { name: "Next choices" }).click();
  await page.getByRole("option", { name: "Saved record 25", exact: true }).click();
  await input.fill("special");
  await page.getByRole("option", { name: "Saved special" }).click();
  await expect(page.locator('input[name="occasion_ids"]')).toHaveCount(3);
  await page.getByRole("button", { name: "Remove Already assigned" }).click();
  await expect(page.locator('input[name="occasion_ids"]')).toHaveCount(2);
  expect(await page.locator('input[name="occasion_ids"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["id-25", "found-id"]);
});

test("geocoder selection fills editable data and ignores stale responses", async ({ page }) => {
  await page.route("**/api/admin/geocode?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "old") await new Promise((resolve) => setTimeout(resolve, 650));
    await route.fulfill({ json: { results: [{ name: `${query} place`, state: "Configured region", detail: "Provider address", lat: 12.34, lng: 75.67, kind: "city" }] } });
  });
  const search = page.getByLabel("Find a place on the map");
  await search.fill("old");
  await page.waitForTimeout(350);
  await search.fill("current");
  await page.getByRole("button", { name: /current place/ }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("current place");
  await expect(page.getByLabel("State or region")).toHaveValue("Configured region");
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("12.34");
  await page.waitForTimeout(700);
  await expect(page.getByRole("button", { name: /old place/ })).toHaveCount(0);
  await page.getByLabel("Latitude", { exact: true }).fill("12.35");
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("12.35");
});

test("service editor stores configured questions and reference selections", async ({ page }) => {
  const editor = page.getByRole("region", { name: "Service editor" });
  const fields = { "Service name": "Configured service", "URL slug": "configured-service", "Short name": "Configured", "Kicker": "Available service", "Page heading": "Arrange a configured trip", "Card tagline": "A saved description", "Description": "Service details entered by staff.", "Includes heading": "Included services" };
  for (const [label, value] of Object.entries(fields)) await editor.getByLabel(label, { exact: true }).fill(value);
  const occasion = editor.getByRole("combobox", { name: "Pricing occasion" });
  await occasion.fill("occasion");
  await page.getByRole("option", { name: "Saved occasion" }).click();
  await editor.getByRole("button", { name: "Add question", exact: true }).click();
  await editor.getByLabel("Question 1 label", { exact: true }).fill("Pickup address");
  await editor.getByLabel("Question 1 key", { exact: true }).fill("pickup_address");
  await editor.getByLabel("Answer type", { exact: true }).selectOption("place");
  await editor.getByLabel("Required", { exact: true }).check();
  await editor.getByRole("button", { name: "Add question", exact: true }).click();
  await editor.getByLabel("Question 2 label", { exact: true }).fill("Vehicle category");
  await editor.getByLabel("Question 2 key", { exact: true }).fill("vehicle_category");
  await editor.getByLabel("Answer type", { exact: true }).nth(1).selectOption("select");
  await editor.getByLabel("Use fleet car types", { exact: true }).check();
  const definition = await editor.locator('input[name="definition"]').inputValue();
  expect(JSON.parse(definition).fields).toEqual([{ name: "pickup_address", label: "Pickup address", type: "place", required: true }, { name: "vehicle_category", label: "Vehicle category", type: "select", optionsSource: "carTypes" }]);
  await editor.getByRole("button", { name: "Create service", exact: true }).click();
  await expect(page.locator("#service-saved")).toContainText('["occasion_id","found-id"]');
  await editor.getByRole("button", { name: "Remove question 1", exact: true }).click();
  expect(JSON.parse(await editor.locator('input[name="definition"]').inputValue()).fields).toHaveLength(1);
});
