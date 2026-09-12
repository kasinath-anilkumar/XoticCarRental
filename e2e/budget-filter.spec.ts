import { expect, test } from "@playwright/test";

test("a custom budget preserves the pickup and sorting while resetting pagination", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pickup = "@10.0889,76.35,Selected live landmark";
  const query = new URLSearchParams({ from: pickup, sort: "low", page: "2" });
  await page.goto(`/cars?${query}`);

  if (isMobile) {
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("navigation", { name: "Filter categories" }).getByRole("button", { name: "Budget" }).click();
    await page.getByLabel("Maximum estimated amount (₹)").last().fill("500000.50");
    await page.getByRole("button", { name: "Show matching cars" }).click();
  } else {
    const budgetForm = page.getByRole("form", { name: "Budget filter" });
    await budgetForm.getByLabel("Maximum estimated amount (₹)").fill("500000.50");
    await budgetForm.getByRole("button", { name: "Apply budget" }).click();
  }

  await expect.poll(() => Number(new URL(page.url()).searchParams.get("budget"))).toBe(500000.5);
  const applied = new URL(page.url()).searchParams;
  expect(applied.get("page")).toBeNull();
  expect(applied.get("from")).toBe(pickup);
  expect(applied.get("sort")).toBe("low");
  await expect(page.getByRole("link", { name: /Up to ₹5,00,000.5/ })).toBeVisible();
});
