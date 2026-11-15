import { defineConfig } from "@playwright/test";
export default defineConfig({
  timeout: 90000,
  testDir: "./tests/browser",
  use: {
    baseURL: process.env.PREVIEW_URL ?? "http://127.0.0.1:4173",
    browserName: "chromium",
    channel: "msedge",
    viewport: { width: 412, height: 915 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: "list",
});
