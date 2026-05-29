import { expect, test } from "@playwright/test";

import {
  clickClip,
  getClip,
  getHarnessState,
  getTimelineEditor,
  getTimelineRuler,
  getTimelineRulerLane,
  getTimelineTrack,
  selectContextMenuItem,
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
  expect(timelineBox!.y).toBeGreaterThan(previewBox!.y + previewBox!.height);
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

test("shows document state and marker action for empty selection with no markers", async ({
  page,
}) => {
  await page.goto("/?fixture=no-markers");

  const inspector = page.locator("[data-slot='timeline-workbench-inspector']");

  await expect(inspector.getByText("Document")).toBeVisible();
  await expect(inspector.getByText("2 tracks · 1 item")).toBeVisible();
  await expect(inspector.getByText("0 markers · playhead 0:01.0")).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Add" })).toBeVisible();
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

test("keeps a large virtualized workbench editable", async ({ page }) => {
  await page.goto("/?fixture=large&surface=workbench&showPreviewPanel=false");

  await expect.poll(async () => (await getHarnessState(page)).document.tracks.length).toBe(200);
  await expect(page.locator("[data-slot='timeline-editor-tracks']").last()).toHaveAttribute(
    "data-virtualized",
    "true",
  );

  await clickClip(page, "Item 21-1");
  await page.keyboard.press("Delete");
  await expect
    .poll(async () =>
      (await getHarnessState(page)).document.tracks
        .find((track) => track.id === "track-21")
        ?.items.some((item) => item.id === "track-21-item-1"),
    )
    .toBe(false);

  const track = getTimelineTrack(page, "Track 21");
  await track.click({ button: "right" });
  await selectContextMenuItem(page, "Remove Track");
  await expect.poll(async () => (await getHarnessState(page)).document.tracks.length).toBe(199);
});

test("keeps timeline ruler visible while scrolling tracks", async ({ page }) => {
  await page.goto("/?fixture=large");

  const editor = getTimelineEditor(page);
  const ruler = getTimelineRuler(page);
  const before = await ruler.boundingBox();
  expect(before).not.toBeNull();

  await editor.evaluate((element) => {
    element.scrollTop = 280;
  });

  const after = await ruler.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.round(after!.y)).toBe(Math.round(before!.y));

  const rulerOnTop = await page.evaluate(() => {
    const editor = document.querySelector("[data-slot='timeline-editor']");
    const ruler = document.querySelector("[data-slot='timeline-editor-ruler']");
    const editorBox = editor?.getBoundingClientRect();
    const box = ruler?.getBoundingClientRect();
    const target = box
      ? document.elementFromPoint(
          Math.min(box.right - 1, Math.max(box.left + 1, (editorBox?.left ?? box.left) + 120)),
          box.top + box.height / 2,
        )
      : null;

    return Boolean(target?.closest("[data-slot='timeline-editor-ruler']"));
  });
  expect(rulerOnTop).toBe(true);
});

test("keeps workbench panels usable on a small viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto("/");

  await expect(getTimelineEditor(page)).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-toolbar']")).toBeVisible();
  await expect(page.locator("[data-slot='timeline-workbench-inspector']")).toBeVisible();

  const editorBox = await getTimelineEditor(page).boundingBox();
  expect(editorBox).not.toBeNull();
  expect(editorBox!.width).toBeGreaterThan(160);
  expect(editorBox!.height).toBeGreaterThan(180);
});
