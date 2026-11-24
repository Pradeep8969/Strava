import { expect, test } from "@playwright/test";

const screens = [
  ["Home", "/", "Namaste, athlete."],
  ["Maps", "/maps", null],
  ["Record", "/record", "Record activity"],
  ["Events", "/events", "Nepal events"],
  ["Activities", "/activities", "Activity journal"],
  ["Profile", "/profile", "Your space"],
] as const;

for (const width of [390, 768, 1440]) {
  for (const theme of ["light", "dark"]) {
    test(`bottom tabs navigate and stay visible at ${width}px ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await page
        .getByRole("button", { name: "Open settings", exact: true })
        .click();
      await page.getByRole("button", { name: theme, exact: true }).click();
      await page.getByRole("link", { name: "Go back" }).click();
      const bar = page.getByRole("tablist").filter({
        has: page.getByRole("tab", { name: "Home", exact: false }),
      });
      await expect(bar.getByRole("tab")).toHaveCount(6);
      for (const [name, path, title] of screens) {
        const tab = bar.getByRole("tab", { name, exact: false });
        await tab.click();
        await expect(page).toHaveURL(
          new RegExp(`${path === "/" ? "/" : path}$`),
        );
        const heading = title
          ? page.getByRole("heading", { name: title, exact: true })
          : page.getByRole("button", { name: "Search maps", exact: true });
        await expect(heading).toBeVisible();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(tab.getByText(name, { exact: true })).toHaveCSS(
          "color",
          theme === "light" ? "rgb(207, 66, 31)" : "rgb(255, 129, 92)",
        );
        const bounds = (await bar.boundingBox())!;
        expect(bounds.x).toBeCloseTo(0, 0);
        expect(bounds.width).toBeCloseTo(width, 0);
        // The tablist sits inside the bar's top/bottom safe-area padding.
        const barBottom = await bar.evaluate(
          (element) => element.parentElement!.getBoundingClientRect().bottom,
        );
        expect(barBottom).toBeCloseTo(844, 0);
        const tabs = await bar.getByRole("tab").all();
        let previousRight = 0;
        for (let i = 0; i < tabs.length; i++) {
          await expect(
            tabs[i].getByText(screens[i][0], { exact: true }),
          ).toBeVisible();
          const box = (await tabs[i].boundingBox())!;
          expect(box.width).toBeGreaterThanOrEqual(48);
          expect(box.height).toBeGreaterThanOrEqual(48);
          expect(box.x).toBeGreaterThanOrEqual(previousRight - 1);
          expect(box.y).toBeGreaterThanOrEqual(bounds.y);
          expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
          previousRight = box.x + box.width;
        }
        // Scroll the actual screen container, not the document or the tab bar.
        const viewport = title
          ? await heading.evaluate((element) => {
              let parent = element.parentElement;
              while (
                parent &&
                !["auto", "scroll"].includes(getComputedStyle(parent).overflowY)
              )
                parent = parent.parentElement;
              if (!parent) throw new Error("Screen ScrollView not found");
              parent.scrollTop = parent.scrollHeight;
              const rect = parent.getBoundingClientRect();
              return { bottom: rect.bottom, scrollTop: parent.scrollTop };
            })
          : null;
        if (viewport) expect(viewport.bottom).toBeLessThanOrEqual(bounds.y + 1);
        await expect(tab).toBeVisible();
        expect((await bar.boundingBox())!.y).toBeCloseTo(bounds.y, 0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
        ).toBe(false);
      }
      await page.screenshot({
        path: `artifacts/dedicated-maps-review/profile-${width}-${theme}.png`,
      });
      if (width === 1440) {
        // Inactive navigator headers remain mounted with aria-hidden.
        const activeBranding = await page
          .getByText("MADE FOR NEPAL", { exact: true })
          .evaluateAll(
            (elements) =>
              elements.filter(
                (element) => !element.closest('[aria-hidden="true"]'),
              ).length,
          );
        expect(activeBranding).toBeGreaterThan(0);
      }
    });
  }
}
