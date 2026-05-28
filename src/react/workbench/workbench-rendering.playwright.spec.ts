import { expect, test } from "@playwright/test";

import {
  clickClip,
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

test("renders timeline as the primary workbench canvas", async ({ page }) => {
  await page.goto("/");

  const timelineBox = await getTimelineEditor(page).boundingBox();
  const previewBox = await page.locator("[data-slot='timeline-workbench-preview']").boundingBox();
  expect(timelineBox).not.toBeNull();
  expect(previewBox).not.toBeNull();

  await expect(page.locator("[data-slot='timeline-workbench-assets']")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-inspector']")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-preview']")).toBeVisible();
  expect(timelineBox!.height).toBeGreaterThan(previewBox!.height);
});

test("supports default panel visibility toggles", async ({ page }) => {
  await page.goto("/?showAssetsPanel=false&showPreviewPanel=false&showInspectorPanel=false");

  await expect(page.locator("[data-slot='timeline-workbench-assets']")).toHaveCount(0);
  await expect(page.locator("[data-slot='timeline-workbench-preview']")).toHaveCount(0);
  await expect(page.locator("[data-slot='timeline-workbench-inspector']")).toHaveCount(0);
  await expect(getTimelineEditor(page)).toBeVisible();
});

test("omits an unconfigured empty assets panel", async ({ page }) => {
  await page.goto("/?assets=none");

  await expect(page.locator("[data-slot='timeline-workbench-assets']")).toHaveCount(0);
  await expect(getTimelineEditor(page)).toBeVisible();
});

test("shows compact preview state when no item is active", async ({ page }) => {
  await page.goto("/?fixture=no-active");

  const preview = page.locator("[data-slot='timeline-workbench-preview']");
  await expect(preview.getByText("0 active items")).toBeVisible();
  await expect(preview.getByText("0:07.5 / 0:08.0")).toBeVisible();
});

test("shows contextual toolbar actions for item selection", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Copy" })).toHaveCount(0);
  await clickClip(page, "Brief");
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Split" })).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Delete" })).toBeVisible();
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
