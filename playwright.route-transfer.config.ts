import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Isolated automation profiles only. Never attach to the user's browser profile.
export default defineConfig(base, {
  testMatch: "route-transfer.spec.ts",
  projects: [
    { name: "Edge", use: { channel: "msedge" } },
    {
      name: "Brave",
      use: {
        channel: "chromium",
        launchOptions: {
          executablePath:
            process.env.BRAVE_EXECUTABLE ??
            "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        },
      },
    },
  ],
});
