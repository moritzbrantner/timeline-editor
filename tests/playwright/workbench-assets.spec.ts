import { expect, type Locator, test } from "@playwright/test";

import {
  clickAsset,
  getClip,
  getHarnessState,
  getItemCount,
  getItems,
  getTimelineEditor,
  getTimelineTrack,
  scrubRulerTo,
} from "./support/workbench";

test("inserts an asset at the playhead", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.75);
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(6_000);
  await clickAsset(page, /Prototype/, { expectedItemDelta: 1 });

  await expect(getClip(page, "Prototype")).toBeVisible();
  await expect
    .poll(async () => (await getItems(page)).filter((item) => item.label === "Prototype"))
    .toEqual([
      expect.objectContaining({
        durationMs: 1_000,
        label: "Prototype",
        startMs: 6_000,
        trackId: "planning",
      }),
    ]);
  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemId)
    .toMatch(/^prototype-/);
});

test("does not double-insert from a single asset click", async ({ page }) => {
  await page.goto("/");

  const initialItemCount = await getItemCount(page);
  await clickAsset(page, /Prototype/, { expectedItemDelta: 1 });

  await expect.poll(async () => await getItemCount(page)).toBe(initialItemCount + 1);
  await expect
    .poll(async () => (await getItems(page)).filter((item) => item.label === "Prototype"))
    .toHaveLength(1);
});

test("drags an asset from panel to timeline", async ({ page }) => {
  await page.goto("/");

  const initialItemCount = await getItemCount(page);
  const planningTrack = getTimelineTrack(page, "Planning");
  const trackBox = await planningTrack.boundingBox();
  expect(trackBox).not.toBeNull();

  await page.getByRole("button", { name: /Prototype/ }).dragTo(planningTrack, {
    targetPosition: {
      x: 240,
      y: trackBox!.height / 2,
    },
  });

  await expect.poll(async () => await getItemCount(page)).toBe(initialItemCount + 1);
  await expect
    .poll(async () => (await getItems(page)).find((item) => item.label === "Prototype"))
    .toEqual(
      expect.objectContaining({
        durationMs: 1_000,
        label: "Prototype",
        startMs: 1_200,
        trackId: "planning",
      }),
    );
});

test("drops an asset at snapped frame timestamp", async ({ page }) => {
  await page.goto("/?frameRate=25");

  const editor = getTimelineEditor(page);
  const planningTrack = getTimelineTrack(page, "Planning");
  const editorBox = await editor.boundingBox();
  const trackBox = await planningTrack.boundingBox();
  expect(editorBox).not.toBeNull();
  expect(trackBox).not.toBeNull();

  const clientX = editorBox!.x + 80 + 99;
  const clientY = trackBox!.y + trackBox!.height / 2;
  const dropped = await planningTrack.evaluate(
    (track, point) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-timeline-workbench-asset-id", "prototype");
      dataTransfer.setData("text/plain", "Prototype");

      track.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX: point.clientX,
          clientY: point.clientY,
          dataTransfer,
        }),
      );

      return !track.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          clientX: point.clientX,
          clientY: point.clientY,
          dataTransfer,
        }),
      );
    },
    { clientX, clientY },
  );

  expect(dropped).toBe(true);
  await expect
    .poll(async () => (await getItems(page)).find((item) => item.label === "Prototype"))
    .toEqual(
      expect.objectContaining({
        durationMs: 1_000,
        label: "Prototype",
        startMs: 440,
        trackId: "planning",
      }),
    );
});

test("shows allowed and incompatible drop feedback", async ({ page }) => {
  await page.goto("/");

  const planningTrack = getTimelineTrack(page, "Planning");
  const reviewTrack = getTimelineTrack(page, "Review");
  const editorBox = await getTimelineEditor(page).boundingBox();
  const planningBox = await planningTrack.boundingBox();
  const reviewBox = await reviewTrack.boundingBox();
  expect(editorBox).not.toBeNull();
  expect(planningBox).not.toBeNull();
  expect(reviewBox).not.toBeNull();

  const dispatchDragOver = async (
    trackLocator: Locator,
    assetId: string,
    clientX: number,
    clientY: number,
  ) =>
    trackLocator.evaluate(
      (track, point) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("application/x-timeline-workbench-asset-id", point.assetId);
        dataTransfer.setData("text/plain", point.assetId);

        return !track.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            clientX: point.clientX,
            clientY: point.clientY,
            dataTransfer,
          }),
        );
      },
      { assetId, clientX, clientY },
    );

  await dispatchDragOver(
    planningTrack,
    "prototype",
    editorBox!.x + 80 + 99,
    planningBox!.y + planningBox!.height / 2,
  );
  await expect(page.locator("[data-slot='timeline-workbench-drop-feedback']")).toHaveAttribute(
    "data-allowed",
    "true",
  );
  await expect(page.locator("[data-slot='timeline-workbench-drop-label']")).toContainText(
    "Drop Prototype",
  );

  await dispatchDragOver(
    reviewTrack,
    "handoff-task",
    editorBox!.x + 80 + 99,
    reviewBox!.y + reviewBox!.height / 2,
  );
  await expect(page.locator("[data-slot='timeline-workbench-drop-feedback']")).toHaveAttribute(
    "data-allowed",
    "false",
  );
  await expect(page.locator("[data-slot='timeline-workbench-drop-label']")).toContainText(
    "Incompatible Handoff task",
  );
});

test("imports a file asset through host callback", async ({ page }) => {
  await page.goto("/?importAssets=true");

  await page.locator("[data-slot='timeline-workbench-file-import']").setInputFiles({
    name: "screen-recording.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("fake video"),
  });

  await expect
    .poll(async () => (await getHarnessState(page)).imports)
    .toEqual([
      expect.objectContaining({
        fileName: "screen-recording.mp4",
        label: "screen-recording.mp4",
        mimeType: "video/mp4",
        type: "file",
      }),
    ]);
  await expect(page.getByRole("button", { name: /screen-recording\.mp4/ })).toBeVisible();

  await clickAsset(page, /screen-recording\.mp4/, { expectedItemDelta: 1 });

  await expect(getClip(page, "screen-recording.mp4")).toBeVisible();
  await expect
    .poll(async () => (await getItems(page)).find((item) => item.label === "screen-recording.mp4"))
    .toEqual(
      expect.objectContaining({
        durationMs: 750,
        label: "screen-recording.mp4",
        startMs: 1_000,
        trackId: "planning",
      }),
    );
});

test("hides import controls without importer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Import files" })).toBeHidden();
});

test("disables import in read-only mode", async ({ page }) => {
  await page.goto("/?importAssets=true&readOnly=true");

  await expect(page.getByRole("button", { name: "Import files" })).toBeDisabled();
  await expect(page.locator("[data-slot='timeline-workbench-file-import']")).toBeDisabled();
});

test("asset action click does not activate row behind it", async ({ page }) => {
  await page.goto("/?assetActions=true");

  const initialItemCount = await getItemCount(page);

  await page.getByRole("button", { name: "Delete Prototype" }).click();

  await expect
    .poll(async () => (await getHarnessState(page)).changes)
    .toContain("asset-action:delete:prototype");
  await expect.poll(async () => await getItemCount(page)).toBe(initialItemCount);
  await expect
    .poll(async () => (await getItems(page)).some((item) => item.label === "Prototype"))
    .toBe(false);
});

test("portal asset menu action does not click through into row", async ({ page }) => {
  await page.goto("/?assetActions=true");

  const initialItemCount = await getItemCount(page);

  await page.getByRole("button", { name: "Prototype menu" }).click();
  await page.getByRole("menuitem", { name: "Delete Prototype from menu" }).click();

  await expect
    .poll(async () => (await getHarnessState(page)).changes)
    .toContain("asset-action:delete-menu:prototype");
  await expect.poll(async () => await getItemCount(page)).toBe(initialItemCount);
  await expect
    .poll(async () => (await getItems(page)).some((item) => item.label === "Prototype"))
    .toBe(false);
});
