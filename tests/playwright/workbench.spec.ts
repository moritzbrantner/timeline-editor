import { expect, type Locator, type Page, test } from "@playwright/test";

type TimelineEditorHarnessState = {
  changes: string[];
  document: {
    currentTimeMs?: number;
    markers?: Array<{
      color?: string;
      id: string;
      label: string;
      timeMs: number;
    }>;
    itemGroups?: Array<{
      id: string;
      itemIds: string[];
      label: string;
    }>;
    tracks: Array<{
      id: string;
      items: Array<{
        durationMs: number;
        id: string;
        itemGroupId?: string;
        label: string;
        startMs: number;
        trackId: string;
      }>;
    }>;
  };
  selectedItemId: string | null;
  selectedItemIds: string[];
  range?: { startMs: number; endMs: number };
  frameRate?: number;
};

async function getHarnessState(page: Page) {
  return page.evaluate(
    () => window["__timelineEditorHarness"],
  ) as Promise<TimelineEditorHarnessState>;
}

function getClip(page: Page, name: string) {
  return page.locator(`[data-slot='timeline-editor-clip'][aria-label="${name}"]`);
}

function getTimelineEditor(page: Page) {
  return page.locator("[data-slot='timeline-editor']").last();
}

function getTimelineRuler(page: Page) {
  return page.locator("[data-slot='timeline-editor-ruler']").last();
}

function getTimelineRulerLane(page: Page) {
  return page.locator("[data-slot='timeline-editor-ruler-lane']").last();
}

function getTimelineTrack(page: Page, label: string) {
  return page.locator("[data-slot='timeline-editor-track']").filter({ hasText: label }).last();
}

async function selectContextMenuItem(page: Page, label: string, role = "menuitem") {
  const item = page.locator(`[role='${role}']`).filter({ hasText: label }).first();

  await item.hover();
  await page.keyboard.press("Enter");
}

async function getItem(page: Page, itemId: string) {
  const state = await getHarnessState(page);

  return state.document.tracks.flatMap((track) => track.items).find((item) => item.id === itemId);
}

async function getItems(page: Page) {
  const state = await getHarnessState(page);

  return state.document.tracks.flatMap((track) => track.items);
}

async function drag(locator: Locator, deltaX: number) {
  await locator.scrollIntoViewIfNeeded();

  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Cannot drag an element without a bounding box");
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await locator.page().mouse.move(startX, startY);
  await locator.page().mouse.down();
  await locator.page().mouse.move(startX + deltaX, startY, { steps: 4 });
  await locator.page().mouse.up();
}

async function scrubRulerTo(page: Page, fraction: number) {
  const lane = getTimelineRulerLane(page);
  const laneBox = await lane.boundingBox();
  expect(laneBox).not.toBeNull();

  await lane.click({
    position: {
      x: laneBox!.width * fraction,
      y: laneBox!.height / 2,
    },
  });
}

test("renders the timeline workbench", async ({ page }) => {
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

test("selects an item and scrubs the ruler", async ({ page }) => {
  await page.goto("/");

  const clip = getClip(page, "Brief");
  await clip.click();

  await expect.poll(async () => (await getHarnessState(page)).selectedItemId).toBe("brief");
  await expect(clip).toHaveAttribute("aria-pressed", "true");

  await scrubRulerTo(page, 0.5);

  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(4_000);
});

test("aligns timeline zero after the track names", async ({ page }) => {
  await page.goto("/");

  const laneBox = await getTimelineRulerLane(page).boundingBox();
  const clipBox = await getClip(page, "Brief").boundingBox();
  expect(laneBox).not.toBeNull();
  expect(clipBox).not.toBeNull();

  expect(Math.round(clipBox!.x - laneBox!.x)).toBe(80);
});

test("inserts an asset at the playhead", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.75);
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(6_000);
  await page.getByRole("button", { name: /Prototype/ }).click();

  await expect(getClip(page, "Prototype")).toBeVisible();
  await expect
    .poll(async () => (await getItems(page)).find((item) => item.label === "Prototype"))
    .toEqual(
      expect.objectContaining({
        durationMs: 1_000,
        label: "Prototype",
        startMs: 6_000,
        trackId: "planning",
      }),
    );
  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemId)
    .toMatch(/^prototype-/);
});

test("drops an asset on the timeline at a snapped frame timestamp", async ({ page }) => {
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

test("shows asset drop feedback for compatible and incompatible tracks", async ({ page }) => {
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

test("drags an asset from the asset panel onto the timeline", async ({ page }) => {
  await page.goto("/");

  const planningTrack = getTimelineTrack(page, "Planning");
  const trackBox = await planningTrack.boundingBox();
  expect(trackBox).not.toBeNull();

  await page.getByRole("button", { name: /Prototype/ }).dragTo(planningTrack, {
    targetPosition: {
      x: 240,
      y: trackBox!.height / 2,
    },
  });

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

test("adds and removes whole tracks", async ({ page }) => {
  await page.goto("/");

  const initialEditorHeight = (await getTimelineEditor(page).boundingBox())?.height ?? 0;

  await page.getByRole("button", { name: "Add Track" }).click();
  await page.getByText("Review Track", { exact: true }).click();

  await expect(
    page
      .locator("[data-slot='timeline-editor-track']")
      .filter({ hasText: "Review Track 3" })
      .last(),
  ).toBeVisible();
  await expect
    .poll(async () => (await getTimelineEditor(page).boundingBox())?.height ?? 0)
    .toBeGreaterThan(initialEditorHeight);
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(["planning", "review", "review-track-3"]);

  const planningTrack = page
    .locator("[data-slot='timeline-editor-track']")
    .filter({ hasText: "Planning" })
    .last();
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

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
  await expect
    .poll(async () => (await getHarnessState(page)).document.tracks.map((track) => track.id))
    .toEqual(["review", "review-track-3"]);
  await expect.poll(async () => (await getHarnessState(page)).selectedItemIds).toEqual([]);
});

test("runs custom timeline context menu actions at the clicked time", async ({ page }) => {
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

test("changes frame rate through a custom timeline context menu", async ({ page }) => {
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
  await expect.poll(async () => (await getHarnessState(page)).changes).toContain("frame-rate:24");
});

test("zooms the timeline with ctrl mousewheel", async ({ page }) => {
  await page.goto("/");

  const ruler = getTimelineRuler(page);
  const initialBox = await ruler.boundingBox();
  const editorBox = await getTimelineEditor(page).boundingBox();
  expect(initialBox).not.toBeNull();
  expect(editorBox).not.toBeNull();

  const defaultAllowed = await getTimelineEditor(page).evaluate(
    (editor, clientX) =>
      editor.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX,
          ctrlKey: true,
          deltaY: -120,
        }),
      ),
    editorBox!.x + editorBox!.width / 2,
  );

  expect(defaultAllowed).toBe(false);
  await expect
    .poll(async () => (await ruler.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialBox!.width);
});

test("keeps horizontal timeline scroll on the editor scroller", async ({ page }) => {
  await page.goto("/?fixture=large");

  const scrollState = await getTimelineEditor(page).evaluate((editor) => {
    window.scrollTo(0, 0);
    editor.scrollLeft = 200;
    editor.dispatchEvent(new Event("scroll", { bubbles: true }));

    return {
      bodyScrollLeft: document.body.scrollLeft,
      documentScrollLeft: document.documentElement.scrollLeft,
      editorScrollLeft: editor.scrollLeft,
      windowScrollX: window.scrollX,
    };
  });

  expect(scrollState).toEqual({
    bodyScrollLeft: 0,
    documentScrollLeft: 0,
    editorScrollLeft: 200,
    windowScrollX: 0,
  });
});

test("maps normal timeline mousewheel to horizontal scrolling", async ({ page }) => {
  await page.goto("/?fixture=large");

  const scrollState = await getTimelineEditor(page).evaluate((editor) => {
    editor.scrollLeft = 0;
    const defaultAllowed = editor.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 180,
      }),
    );

    return {
      defaultAllowed,
      scrollLeft: editor.scrollLeft,
      scrollTop: editor.scrollTop,
    };
  });

  expect(scrollState.defaultAllowed).toBe(false);
  expect(scrollState.scrollLeft).toBe(180);
  expect(scrollState.scrollTop).toBe(0);
});

test("maps shift mousewheel to horizontal timeline scrolling", async ({ page }) => {
  await page.goto("/?fixture=large");

  const scrollState = await getTimelineEditor(page).evaluate((editor) => {
    editor.scrollLeft = 0;
    const defaultAllowed = editor.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 160,
        shiftKey: true,
      }),
    );

    return {
      defaultAllowed,
      scrollLeft: editor.scrollLeft,
    };
  });

  expect(scrollState.defaultAllowed).toBe(false);
  expect(scrollState.scrollLeft).toBe(160);
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

test("groups and ungroups timeline items", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.5);
  await page.getByRole("button", { name: /Handoff task/ }).click();
  await getClip(page, "Brief").click({ modifiers: ["Control"] });

  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemIds.sort())
    .toEqual(expect.arrayContaining(["brief", expect.stringMatching(/^handoff-task-/)]));

  await page.getByRole("button", { exact: true, name: "Group" }).click();

  await expect.poll(async () => (await getHarnessState(page)).document.itemGroups).toHaveLength(1);

  const groupedItems = await getItems(page);
  const handoffTask = groupedItems.find((item) => item.label === "Handoff task");
  const groupId = groupedItems.find((item) => item.id === "brief")?.itemGroupId;
  expect(groupId).toBeTruthy();
  expect(handoffTask?.itemGroupId).toBe(groupId);

  await getClip(page, "Brief").click();
  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemIds.sort())
    .toEqual(["brief", handoffTask!.id].sort());

  await drag(getClip(page, "Brief"), 80);

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(2_000);
  await expect.poll(async () => (await getItem(page, handoffTask!.id))?.startMs).toBe(5_000);

  await page.getByRole("button", { exact: true, name: "Ungroup" }).click();

  await expect
    .poll(async () => (await getHarnessState(page)).document.itemGroups ?? [])
    .toEqual([]);
  await expect.poll(async () => (await getItem(page, "brief"))?.itemGroupId).toBeUndefined();
  await expect
    .poll(async () => (await getItem(page, handoffTask!.id))?.itemGroupId)
    .toBeUndefined();

  await getClip(page, "Brief").click();
  await drag(getClip(page, "Brief"), 80);

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(3_000);
  await expect.poll(async () => (await getItem(page, handoffTask!.id))?.startMs).toBe(5_000);
});

test("clears selection from an empty timeline lane and previews playhead content", async ({
  page,
}) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.5);
  await page.getByRole("button", { name: /Handoff task/ }).click();
  await getClip(page, "Brief").click();

  await expect.poll(async () => (await getHarnessState(page)).selectedItemId).toBe("brief");
  const preview = page.locator("[data-slot='timeline-workbench-preview']").last();
  await expect(preview.getByText("Brief")).toBeVisible();

  const planningTrack = getTimelineTrack(page, "Planning");
  const planningTrackBox = await planningTrack.boundingBox();
  expect(planningTrackBox).not.toBeNull();

  await planningTrack.click({
    position: {
      x: planningTrackBox!.width - 12,
      y: planningTrackBox!.height / 2,
    },
  });

  await expect.poll(async () => (await getHarnessState(page)).selectedItemIds).toEqual([]);
  await expect(preview.getByText("Handoff task")).toBeVisible();
});

test("scrubs the preview by dragging an empty timeline lane", async ({ page }) => {
  await page.goto("/");

  const rulerLaneBox = await getTimelineRulerLane(page).boundingBox();
  const reviewTrackBox = await getTimelineTrack(page, "Review").boundingBox();
  expect(rulerLaneBox).not.toBeNull();
  expect(reviewTrackBox).not.toBeNull();

  const startX = rulerLaneBox!.x + rulerLaneBox!.width * 0.25;
  const endX = rulerLaneBox!.x + rulerLaneBox!.width * 0.75;
  const y = reviewTrackBox!.y + reviewTrackBox!.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 5 });
  await page.mouse.up();

  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(6_000);
  await expect(
    page.locator("[data-slot='timeline-workbench-preview']").last().getByText("0:06.0"),
  ).toBeVisible();
});

test("duplicates, deletes, undoes, and redoes from the toolbar", async ({ page }) => {
  await page.goto("/");

  await getClip(page, "Brief").click();
  await page.getByRole("button", { name: "Duplicate" }).click();

  await expect
    .poll(async () => await getItem(page, "brief-copy"))
    .toEqual(
      expect.objectContaining({
        durationMs: 2_000,
        startMs: 3_000,
      }),
    );

  await page.getByRole("button", { exact: true, name: "Delete" }).click();

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
  await expect.poll(async () => await getItem(page, "brief-copy")).toBeDefined();

  await page.getByRole("button", { name: "Undo" }).click();

  await expect
    .poll(async () => await getItem(page, "brief"))
    .toEqual(expect.objectContaining({ startMs: 1_000 }));

  await page.getByRole("button", { name: "Redo" }).click();

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
});

test("copies and pastes selected clips with keyboard shortcuts", async ({ page }) => {
  await page.goto("/");

  await getClip(page, "Brief").click();
  await scrubRulerTo(page, 0.75);
  await getTimelineEditor(page).focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+C" : "Control+C");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");

  await expect
    .poll(async () => await getItem(page, "brief-copy"))
    .toEqual(
      expect.objectContaining({
        durationMs: 2_000,
        startMs: 6_000,
        trackId: "planning",
      }),
    );
});

test("cuts and pastes selected clips with toolbar actions", async ({ page }) => {
  await page.goto("/");

  await getClip(page, "Brief").click();
  await page.getByRole("button", { name: "Cut" }).click();

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();

  await scrubRulerTo(page, 0.5);
  await page.getByRole("button", { name: "Paste" }).click();

  await expect
    .poll(async () => await getItem(page, "brief-copy"))
    .toEqual(expect.objectContaining({ startMs: 4_000 }));
});

test("splits a clip at the playhead and adds a marker", async ({ page }) => {
  await page.goto("/");

  await scrubRulerTo(page, 0.25);
  await getClip(page, "Brief").click();
  await page.getByRole("button", { name: "Split" }).click();

  await expect
    .poll(async () => await getItem(page, "brief"))
    .toEqual(
      expect.objectContaining({
        durationMs: 1_000,
        startMs: 1_000,
      }),
    );
  await expect
    .poll(async () => await getItem(page, "brief-part-2"))
    .toEqual(
      expect.objectContaining({
        durationMs: 1_000,
        startMs: 2_000,
      }),
    );

  await page.getByRole("button", { name: "Marker" }).click();

  await expect
    .poll(async () =>
      (await getHarnessState(page)).document.markers?.some((marker) => marker.timeMs === 2_000),
    )
    .toBe(true);
});

test("nudges selected clips and selects all with keyboard shortcuts", async ({ page }) => {
  await page.goto("/");

  await getClip(page, "Brief").click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press("ArrowRight");

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(1_100);

  await page.getByRole("button", { name: "Duplicate" }).click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");

  await expect
    .poll(async () => (await getHarnessState(page)).selectedItemIds.sort())
    .toEqual(["brief", "brief-copy"]);
});

test("nudges selected clips by frame when a framerate is set", async ({ page }) => {
  await page.goto("/?frameRate=25");

  await getClip(page, "Brief").click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press("ArrowRight");

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(1_040);
});

test("steps the playhead by frame controls when a framerate is set", async ({ page }) => {
  await page.goto("/?frameRate=25");

  await page.getByRole("button", { name: "Next frame" }).click();
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(1_040);

  await page.getByRole("button", { name: "Previous frame" }).click();
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(1_000);
});

test("draws frame ticks across timeline tracks", async ({ page }) => {
  await page.goto("/?frameRate=25");

  await expect
    .poll(async () => page.locator("[data-slot='timeline-editor-track-tick']").count())
    .toBeGreaterThan(0);
});

test("drags a clip with real browser pointer events", async ({ page }) => {
  await page.goto("/");

  await drag(getClip(page, "Brief"), 80);

  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(2_000);
});

test("resizes a clip using the end handle", async ({ page }) => {
  await page.goto("/");

  const endHandle = getClip(page, "Brief").locator("[data-slot='timeline-editor-resize-end']");
  await drag(endHandle, 80);

  await expect.poll(async () => (await getItem(page, "brief"))?.durationMs).toBe(3_000);
});

test("deletes the selected clip by keyboard", async ({ page }) => {
  await page.goto("/");

  await getClip(page, "Brief").click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press("Delete");

  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
});

test("edits, jumps to, and deletes a marker from the inspector", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-slot='timeline-editor-marker'][title='Handoff']").last().click();
  const inspector = page.locator("[data-slot='timeline-workbench-marker-inspector']");
  await expect(inspector).toBeVisible();

  await inspector.locator("[data-slot='timeline-workbench-marker-label']").fill("QA handoff");
  await inspector.locator("[data-slot='timeline-workbench-marker-time']").fill("5000");
  await inspector.locator("[data-slot='timeline-workbench-marker-color']").fill("#ff0000");

  await expect
    .poll(async () => (await getHarnessState(page)).document.markers?.[0])
    .toEqual(
      expect.objectContaining({
        color: "#ff0000",
        label: "QA handoff",
        timeMs: 5_000,
      }),
    );

  await inspector.getByRole("button", { name: "Jump" }).click();
  await expect.poll(async () => (await getHarnessState(page)).document.currentTimeMs).toBe(5_000);

  await inspector.getByRole("button", { name: "Delete" }).click();
  await expect.poll(async () => (await getHarnessState(page)).document.markers ?? []).toEqual([]);
});

test("updates snap settings from the toolbar menu", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Snap" }).click();
  const menu = page.locator("[data-slot='timeline-workbench-snap-menu']");
  await menu.getByLabel("Item edges").uncheck();
  await menu.getByLabel("Playhead").uncheck();

  await expect
    .poll(async () =>
      (await getHarnessState(page)).changes.filter((change) => change.startsWith("snap:")),
    )
    .toEqual(expect.arrayContaining([expect.stringContaining('"marker"')]));
  await expect
    .poll(async () => (await getHarnessState(page)).changes.at(-1) ?? "")
    .not.toContain("item-edge");
});

test("selects a timeline range and deletes overlapping items", async ({ page }) => {
  await page.goto("/");

  const lane = getTimelineRulerLane(page);
  const laneBox = await lane.boundingBox();
  expect(laneBox).not.toBeNull();

  await page.keyboard.down("Shift");
  await page.mouse.move(laneBox!.x + laneBox!.width * 0.1, laneBox!.y + laneBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(laneBox!.x + laneBox!.width * 0.5, laneBox!.y + laneBox!.height / 2, {
    steps: 4,
  });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect
    .poll(async () => (await getHarnessState(page)).range)
    .toEqual(expect.objectContaining({ startMs: 800, endMs: 4_000 }));
  await expect(page.locator("[data-slot='timeline-editor-range-overlay']").first()).toBeVisible();

  await page.getByRole("button", { name: "Delete Range" }).click();
  await expect.poll(async () => await getItem(page, "brief")).toBeUndefined();
});

test("inserts and closes a selected gap on the target track", async ({ page }) => {
  await page.goto("/");

  const planningTrack = getTimelineTrack(page, "Planning");
  const trackBox = await planningTrack.boundingBox();
  const laneBox = await getTimelineRulerLane(page).boundingBox();
  expect(trackBox).not.toBeNull();
  expect(laneBox).not.toBeNull();

  await page.keyboard.down("Shift");
  await page.mouse.move(laneBox!.x + 2, trackBox!.y + trackBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(laneBox!.x + 82, trackBox!.y + trackBox!.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await page.getByRole("button", { name: "Insert Gap" }).click();
  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(2_000);

  await page.getByRole("button", { name: "Close Gap" }).click();
  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(1_000);
});

test("controls track groups from the group row", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Track Groups" }).click();
  await page.getByRole("menuitem", { name: "Create Group From All Tracks" }).click();

  const groupRow = page.locator("[data-slot='timeline-editor-track-group']").last();
  await expect(groupRow).toContainText("2 tracks");

  await groupRow.getByRole("button", { name: "Collapse" }).click();
  await expect(getClip(page, "Brief")).toBeHidden();

  await groupRow.getByRole("button", { name: "Expand" }).click();
  await expect(getClip(page, "Brief")).toBeVisible();

  await groupRow.getByRole("button", { name: "Lock" }).click();
  await drag(getClip(page, "Brief"), 80);
  await expect.poll(async () => (await getItem(page, "brief"))?.startMs).toBe(1_000);
});

test("filters assets and shows selected-track compatibility", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Uses another compatible track").first()).toBeVisible();
  await getClip(page, "Brief").click();
  await expect(page.getByText("Fits selected track").first()).toBeVisible();

  await page.getByPlaceholder("Search assets").fill("Prototype");
  await expect(page.getByRole("button", { name: /Prototype/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Handoff task/ })).toBeHidden();

  await page.getByPlaceholder("Search assets").fill("");
  await page.getByLabel("Compatible with selected track").check();
  await page.locator("[data-slot='timeline-workbench-asset-kind-filter']").selectOption("task");
  await expect(page.getByRole("button", { name: /Handoff task/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Prototype/ })).toBeHidden();
});

test("read-only mode prevents mutations", async ({ page }) => {
  await page.goto("/?readOnly=true");

  await expect(getTimelineEditor(page)).toHaveAttribute("data-read-only", "true");

  await drag(getClip(page, "Brief"), 80);
  await getClip(page, "Brief").click();
  await getTimelineEditor(page).focus();
  await page.keyboard.press("Delete");

  const item = await getItem(page, "brief");
  expect(item).toEqual(expect.objectContaining({ startMs: 1_000 }));
});
