import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "msedge" });
const times = [];
for (let i = 0; i < 5; i++) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/organizer");
  await page
    .getByRole("heading", { name: "Event management", exact: true })
    .waitFor();
  times.push(await page.evaluate(() => performance.now()));
  await context.close();
}
await browser.close();
const result = {
  scenario:
    "Cold browser context; local production build; direct /organizer; event management visible",
  times,
  median: [...times].sort((a, b) => a - b)[2],
};
mkdirSync("artifacts/phase55-review", { recursive: true });
writeFileSync(
  `artifacts/phase55-review/performance-${process.argv[2] || "after"}.json`,
  JSON.stringify(result, null, 2),
);
console.log(result);
