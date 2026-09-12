import { expect, test } from "@playwright/test";

test("the city directory combines configured state selection and search", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cities");
  const statePicker = page.getByLabel("State or territory");
  const state = await statePicker.locator('option:not([value="all"])').first().getAttribute("value");
  expect(state).toBeTruthy();
  await statePicker.selectOption(state!);
  const cards = page.getByRole("article");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const card of await cards.all()) await expect(card.getByText(state!, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /North India|South India|West India|East & Central/ })).toHaveCount(0);

  const search = page.getByRole("textbox", { name: "Search service cities or airports" });
  await search.fill("No published city matches this query");
  await expect(cards).toHaveCount(0);
  await expect(statePicker).toHaveValue(state!);
  await search.fill("");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const card of await cards.all()) await expect(card.getByText(state!, { exact: true })).toBeVisible();
});
