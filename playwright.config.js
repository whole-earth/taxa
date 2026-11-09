import { defineConfig } from "@playwright/test";
import { previewBase as baseURL } from "./scripts/preview.mjs";
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results/playwright",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL,
    browserName: process.env.BROWSER === "webkit" ? "webkit" : "chromium",
    channel: process.env.BROWSER === "webkit" ? undefined : "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  webServer: process.env.PREVIEW_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
      },
});
