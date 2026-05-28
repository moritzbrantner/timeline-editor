import { expect, test } from "@playwright/test";

import {
  clickClip,
  expectNoDocumentChange,
  expectNoItem,
  getClip,
  getHarnessState,
  getTimelineTrack,
  selectContextMenuItem,
} from "./playwright/support/workbench";

test("deletes a clip from its context menu with a real pointer click", async ({ page }) => {
  await page.goto("/");

  const clip = getClip(page, "Brief");
  await clip.scrollIntoViewIfNeeded();
  const clipBox = await clip.boundingBox();
  expect(clipBox).not.toBeNull();

  await page.mouse.click(clipBox!.x + clipBox!.width / 2, clipBox!.y + clipBox!.height / 2, {
    button: "right",
  });
  await selectContextMenuItem(page, "Delete");

  await expectNoItem(page, "brief");
  await expect(page.locator("[data-slot='timeline-editor-clip-menu']")).toBeHidden();
});

test("runs timeline context menu actions with a real pointer click", async ({ page }) => {
  await page.goto("/?timelineMenu=true");

  const planningTrack = getTimelineTrack(page, "Planning");
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    button: "right",
    position: {
      x: 160,
      y: planningTrackBox!.height / 2,
    },
  });
  await selectContextMenuItem(page, "Record timeline time");

  await expect
    .poll(async () => (await getHarnessState(page)).changes)
    .toContain("timeline-menu:200:planning");
});

test("changes timeline context menu radio items exactly once with a real pointer click", async ({
  page,
}) => {
  await page.goto("/?timelineMenu=true&frameRate=30");

  const planningTrack = getTimelineTrack(page, "Planning");
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    button: "right",
    position: {
      x: 160,
      y: planningTrackBox!.height / 2,
    },
  });
  await selectContextMenuItem(page, "24 fps", "menuitemradio");

  await expect.poll(async () => (await getHarnessState(page)).frameRate).toBe(24);
  await expect
    .poll(async () =>
      (await getHarnessState(page)).changes.filter((change) => change === "frame-rate:24"),
    )
    .toHaveLength(1);
});

test("removes a track from its context menu with a real pointer click", async ({ page }) => {
  await page.goto("/");

  const planningTrack = getTimelineTrack(page, "Planning");
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    button: "right",
    position: {
      x: planningTrackBox!.width - 12,
      y: planningTrackBox!.height / 2,
    },
  });
  await selectContextMenuItem(page, "Remove Track");

  await expectNoItem(page, "brief");
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(["review"]);
});

test("deletes the selected clip when workbench focus is outside the timeline editor", async ({
  page,
}) => {
  await page.goto("/");

  await clickClip(page, "Brief");
  await page.getByRole("button", { name: "Add Track" }).focus();
  await page.keyboard.press("Delete");

  await expectNoItem(page, "brief");
});

test("read-only mode blocks pointer menu delete and workbench-level delete", async ({ page }) => {
  await page.goto("/?readOnly=true");

  const before = await getHarnessState(page);
  const clip = getClip(page, "Brief");
  await clip.scrollIntoViewIfNeeded();
  const clipBox = await clip.boundingBox();
  expect(clipBox).not.toBeNull();

  await page.mouse.click(clipBox!.x + clipBox!.width / 2, clipBox!.y + clipBox!.height / 2, {
    button: "right",
  });
  await selectContextMenuItem(page, "Delete");
  await expectNoDocumentChange(page, before);

  await page.keyboard.press("Escape");
  await page.locator("[data-slot='timeline-workbench']").evaluate((workbench) => {
    if (workbench instanceof HTMLElement) {
      workbench.tabIndex = -1;
      workbench.focus();
    }
  });
  await page.keyboard.press("Delete");

  await expectNoDocumentChange(page, before);
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(before.document.tracks.map((track) => track.id));
});
