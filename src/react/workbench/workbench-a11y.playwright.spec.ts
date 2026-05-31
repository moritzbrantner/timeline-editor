import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("workbench harness has no detectable axe accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add Track" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include("[data-slot='timeline-workbench']")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
