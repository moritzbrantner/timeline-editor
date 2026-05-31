import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  clickAsset,
  getClip,
  getHarnessState,
  getItemCount,
  getItems,
  getTimelineEditor,
  getTimelineTrack,
  scrubRulerTo,
} from "./playwright/support/workbench";

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

test("inserts a compatible asset by keyboard activation", async ({ page }) => {
  await page.goto("/");

  const initialItemCount = await getItemCount(page);
  const asset = page.getByRole("button", { name: /Prototype/ });

  await asset.focus();
  await page.keyboard.press("Enter");

  await expect.poll(async () => await getItemCount(page)).toBe(initialItemCount + 1);
  await expect(getClip(page, "Prototype")).toBeVisible();
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

test("drags an asset across timeline surfaces", async ({ page }) => {
  const getPageProblems = recordPageProblems(page);
  await page.goto("/");

  const initialItemCount = await getItemCount(page);
  const prototypeAsset = page.getByRole("button", { name: /Prototype/ });
  const planningTrack = getTimelineTrack(page, "Planning");
  const planningBox = await planningTrack.boundingBox();
  expect(planningBox).not.toBeNull();

  await prototypeAsset.dragTo(planningTrack, {
    targetPosition: {
      x: 240,
      y: planningBox!.height / 2,
    },
  });

  await expect.poll(async () => await getItemCount(page)).toBe(initialItemCount + 1);
  expect(getPageProblems()).toEqual([]);
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

test("consumes incompatible asset drops without mutating the document", async ({ page }) => {
  const getPageProblems = recordPageProblems(page);
  await page.goto("/");

  const beforeItems = await getItems(page);
  const reviewTrack = getTimelineTrack(page, "Review");
  const dropped = await reviewTrack.evaluate((track) => {
    const bounds = track.getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("application/x-timeline-workbench-asset-id", "handoff-task");
    dataTransfer.setData("text/plain", "Handoff task");

    return !track.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + 240,
        clientY: bounds.top + bounds.height / 2,
        dataTransfer,
      }),
    );
  });

  expect(dropped).toBe(true);
  await expect.poll(async () => await getItems(page)).toEqual(beforeItems);
  expect(getPageProblems()).toEqual([]);
});

test("ignores non-node drag leave targets", async ({ page }) => {
  const getPageProblems = recordPageProblems(page);
  await page.goto("/");

  const editor = getTimelineEditor(page);
  await editor.evaluate((element) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("application/x-timeline-workbench-asset-id", "prototype");

    const event = new DragEvent("dragleave", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });

    Object.defineProperty(event, "relatedTarget", { value: window });
    element.dispatchEvent(event);
  });

  expect(getPageProblems()).toEqual([]);
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

test("imports a URL asset through host callback", async ({ page }) => {
  await page.goto("/?importAssets=true&allowUrlImport=true");

  await page.getByLabel("Import asset URL").fill("https://example.test/media/url-scene.mp4");
  await page.getByRole("button", { name: "Import URL" }).click();

  await expect
    .poll(async () => (await getHarnessState(page)).imports)
    .toEqual([
      expect.objectContaining({
        label: "url-scene.mp4",
        type: "url",
        url: "https://example.test/media/url-scene.mp4",
      }),
    ]);
  await expect(page.getByRole("button", { name: /url-scene\.mp4/ })).toBeVisible();

  await clickAsset(page, /url-scene\.mp4/, { expectedItemDelta: 1 });

  await expect(getClip(page, "url-scene.mp4")).toBeVisible();
  await expect
    .poll(async () => (await getItems(page)).find((item) => item.label === "url-scene.mp4"))
    .toEqual(
      expect.objectContaining({
        durationMs: 750,
        label: "url-scene.mp4",
        startMs: 1_000,
        trackId: "planning",
      }),
    );
});

test("imports an audio file asset and previews it", async ({ page }) => {
  await page.goto("/?importAssets=true");
  const audioPath = path.resolve(process.cwd(), "examples/Me at the zoo [jNQXAC9IVRw].mp3");
  const audioFile = existsSync(audioPath)
    ? {
        name: "Me at the zoo [jNQXAC9IVRw].mp3",
        mimeType: "audio/mpeg",
        buffer: readFileSync(audioPath),
      }
    : {
        name: "audio-preview-fixture.mp3",
        mimeType: "audio/mpeg",
        buffer: Buffer.from("fake audio"),
      };

  await page.locator("[data-slot='timeline-workbench-file-import']").setInputFiles(audioFile);

  await expect
    .poll(async () => (await getHarnessState(page)).imports)
    .toEqual([
      expect.objectContaining({
        fileName: audioFile.name,
        label: audioFile.name,
        mimeType: "audio/mpeg",
        type: "file",
      }),
    ]);
  await expect(page.getByRole("button", { name: audioFile.name })).toBeVisible();

  await clickAsset(page, audioFile.name, { expectedItemDelta: 1 });

  await expect(getClip(page, audioFile.name)).toBeVisible();
  await expect
    .poll(async () => {
      const state = await getHarnessState(page);
      const item = state.document.tracks
        .flatMap((track) => track.items)
        .find((candidate) => candidate.label === audioFile.name) as
        | {
            kind?: string;
            data?: {
              mediaType?: string;
              source?: { label?: string; mimeType?: string; uri?: string };
            };
          }
        | undefined;

      return item
        ? {
            kind: item.kind,
            mediaType: item.data?.mediaType,
            sourceLabel: item.data?.source?.label,
            sourceMimeType: item.data?.source?.mimeType,
            hasSourceUri: Boolean(item.data?.source?.uri),
          }
        : undefined;
    })
    .toEqual({
      kind: "audio",
      mediaType: "audio",
      sourceLabel: audioFile.name,
      sourceMimeType: "audio/mpeg",
      hasSourceUri: true,
    });
  await expect
    .poll(async () => {
      const state = await getHarnessState(page);
      const selectedItem = state.document.tracks
        .flatMap((track) => track.items)
        .find((item) => item.id === state.selectedItemId);

      return selectedItem?.label;
    })
    .toBe(audioFile.name);
  await expect(page.locator("[data-slot='timeline-media-audio-preview-player']")).toHaveCount(0);
  await expect(page.locator("[data-slot='timeline-workbench-scene-audio']")).toHaveCount(1);
  await expect(page.getByText(audioFile.name).first()).toBeVisible();
});

test("hides import controls without importer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Import files" })).toBeHidden();
});

test("disables import in read-only mode", async ({ page }) => {
  await page.goto("/?importAssets=true&allowUrlImport=true&readOnly=true");

  await expect(page.getByRole("button", { name: "Import files" })).toBeDisabled();
  await expect(page.locator("[data-slot='timeline-workbench-file-import']")).toBeDisabled();
  await expect(page.getByLabel("Import asset URL")).toBeHidden();
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

function recordPageProblems(page: Page) {
  const problems: string[] = [];

  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(message.text());
    }
  });

  return () => problems;
}
