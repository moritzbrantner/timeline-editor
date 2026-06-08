import { expect, test } from "@playwright/test";

import { getHarnessState, getTimelineEditor, scrubRulerTo } from "./playwright/support/workbench";

test("renders the workbench and supports basic timeline interaction", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page.locator("[data-slot='timeline-workbench']")).toBeVisible();
  await expect(getTimelineEditor(page)).toBeVisible();
  await expect(page.locator("[data-slot='timeline-editor-tracks']").last()).toBeVisible();

  const clip = page.getByRole("button", { name: /^Brief,/ });
  await expect(clip).toBeVisible();

  await clip.click();
  await expect.poll(async () => (await getHarnessState(page)).selectedItemId).toBe("brief");

  await scrubRulerTo(page, 0.5);
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(4_000);

  expect(pageErrors).toEqual([]);
});
