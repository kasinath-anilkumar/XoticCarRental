import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

// Execute the real shared helper against native browser focus/visibility.
// This fixture makes the streaming transition deterministic without a server delay.
const helper = transpileModule(readFileSync(resolve(process.cwd(), "lib/navigation-focus.ts"), "utf8"), {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
}).outputText;
type FocusWindow = Window & { testFocusTarget: (id: string) => boolean };

test("fragment focus waits for staged HTML and ignores hidden duplicate destinations", async ({ page }) => {
  await page.setContent('<main id="main"><input id="editing" aria-label="Editing field"></main><div hidden id="stage"><section id="destination" tabindex="-1">Streamed destination</section></div>');
  await page.addScriptTag({ content: `{const exports = {}; ${helper}; window.testFocusTarget = exports.focusPageTarget;}` });
  expect(await page.evaluate(() => (window as unknown as FocusWindow).testFocusTarget("destination"))).toBe(false);
  await expect(page.locator("#destination")).not.toBeFocused();
  await page.evaluate(() => {
    const stage = document.getElementById("stage")!;
    stage.hidden = false;
    stage.inert = true;
  });
  expect(await page.evaluate(() => (window as unknown as FocusWindow).testFocusTarget("destination"))).toBe(false);
  await page.evaluate(() => {
    const target = document.getElementById("destination")!;
    document.getElementById("main")!.append(target);
  });
  expect(await page.evaluate(() => (window as unknown as FocusWindow).testFocusTarget("destination"))).toBe(true);
  await expect(page.locator("#main #destination")).toBeFocused();

  await page.evaluate(() => {
    const stage = document.getElementById("stage")!;
    stage.append(document.getElementById("destination")!.cloneNode(true));
    document.body.prepend(stage);
    document.getElementById("editing")!.focus();
  });
  expect(await page.evaluate(() => (window as unknown as FocusWindow).testFocusTarget("destination"))).toBe(true);
  await expect(page.locator("#main #destination")).toBeFocused();
});

test("deferred fragment focus never interrupts a field the customer has started editing", async ({ page }) => {
  await page.setContent('<main id="main"><section id="destination" tabindex="-1">Destination</section><input id="editing" aria-label="Editing field"></main>');
  await page.addScriptTag({ content: `{const exports = {}; ${helper}; window.testFocusTarget = exports.focusPageTarget;}` });
  await page.evaluate(() => {
    (window as unknown as FocusWindow).testFocusTarget("destination");
    const input = document.getElementById("editing") as HTMLInputElement;
    input.focus();
    input.value = "In progress";
  });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole("textbox", { name: "Editing field" })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Editing field" })).toHaveValue("In progress");
});
