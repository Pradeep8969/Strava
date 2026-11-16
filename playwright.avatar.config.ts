import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "profile-avatar.spec.ts",
  timeout: 60000,
  workers: 2,
  outputDir: "artifacts/profile-avatar/results",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 412, height: 915 },
  },
  projects: [
    { name: "edge", use: { channel: "msedge" } },
    {
      name: "brave",
      use: {
        launchOptions: {
          executablePath:
            "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
        },
      },
    },
  ],
  webServer: {
    command: "node scripts/preview-server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
});
