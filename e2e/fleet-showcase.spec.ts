import { expect, test } from "@playwright/test";

test("homepage fleet loads six more cars and resets when changing category", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const fleet = page.locator("#home-fleet");
  if (isMobile) await fleet.getByRole("button", { name: "Browse by vehicle type", exact: true }).click();
  const cards = fleet.getByRole("article");
  const allCategory = fleet.getByRole("button", { name: /^All Fleet/ });
  const total = Number((await allCategory.textContent())?.match(/\((\d+)\)/)?.[1]);
  expect(total).toBeGreaterThan(6);
  await expect(cards).toHaveCount(6);

  await fleet.getByRole("button", { name: "Show more cars", exact: true }).click();
  await expect(cards).toHaveCount(Math.min(12, total));
  await expect(fleet.getByRole("status")).toHaveText(`Showing ${Math.min(12, total)} of ${total} cars`);

  const category = fleet.locator("button[aria-pressed]").nth(1);
  const categoryCount = Number((await category.textContent())?.match(/\((\d+)\)/)?.[1]);
  await category.click();
  await expect(category).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(Math.min(6, categoryCount));

  await allCategory.click();
  await expect(cards).toHaveCount(6);
  await expect(fleet.getByRole("status")).toHaveText(`Showing 6 of ${total} cars`);
  await expect(fleet.getByRole("button", { name: "Show more cars", exact: true })).toBeEnabled();
});
