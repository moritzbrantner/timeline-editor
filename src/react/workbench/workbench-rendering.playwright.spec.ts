import { expect, test } from "@playwright/test";

import {
  getClip,
  getHarnessState,
  getTimelineEditor,
  getTimelineRulerLane,
} from "./playwright/support/workbench";

test("renders default workbench shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Prototype/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Handoff task/ })).toBeVisible();
  await expect(page.getByText("Planning").last()).toBeVisible();
  await expect(page.getByText("Review").last()).toBeVisible();
  await expect(getClip(page, "Brief")).toBeVisible();
  await expect(
    page.locator("[data-slot='timeline-editor-marker'][title='Handoff']").last(),
  ).toBeVisible();
  await expect(getTimelineEditor(page)).toBeVisible();
});

test("aligns timeline zero after track headers", async ({ page }) => {
  await page.goto("/");

  const laneBox = await getTimelineRulerLane(page).boundingBox();
  const clipBox = await getClip(page, "Brief").boundingBox();
  expect(laneBox).not.toBeNull();
  expect(clipBox).not.toBeNull();

  expect(Math.round(clipBox!.x - laneBox!.x)).toBe(80);
});

test("virtualizes large timeline rows", async ({ page }) => {
  await page.goto("/?fixture=large");

  await expect(getTimelineEditor(page)).toHaveAttribute("data-slot", "timeline-editor");
  await expect.poll(async () => (await getHarnessState(page)).document.tracks.length).toBe(200);
  await expect(page.locator("[data-slot='timeline-editor-tracks']").last()).toHaveAttribute(
    "data-virtualized",
    "true",
  );
  await expect
    .poll(async () => page.locator("[data-slot='timeline-editor-track']").count())
    .toBeLessThan(20);
});
