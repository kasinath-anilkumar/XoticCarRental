import { defineConfig, devices } from "@playwright/test";

// Browser behavior can be verified without a production route or an auth bypass.
export default defineConfig({
  testDir: "./e2e", testMatch: "admin-controls.spec.ts", workers: 2,
  outputDir: ".data/admin-browser-results",
  timeout: 45_000, expect: { timeout: 10_000 }, reporter: "list",
  use: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined, screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
});
